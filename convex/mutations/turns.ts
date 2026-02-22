// Turn management mutations for Eclipse board game
// Handles phase progression, turn order, and round management

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  initializeTurnState,
  advancePhase,
  processUpkeep,
  processIncome,
  type TurnState,
} from "../engine/turns";
import { logInfo, roomTag } from "../helpers/log";

/**
 * Initialize turn system for a new game
 * Called when game starts (after all players ready)
 */
export const initializeTurns = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    // Get all players in room
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    if (players.length < 2) {
      throw new Error("Need at least 2 players to start");
    }

    // Sort by turnOrder (or joinedAt if no turnOrder set)
    const sortedPlayers = players.sort((a, b) => {
      if (a.turnOrder !== undefined && b.turnOrder !== undefined) {
        return a.turnOrder - b.turnOrder;
      }
      return a.joinedAt - b.joinedAt;
    });

    const playerIds = sortedPlayers.map(p => p.playerId);

    // Initialize turn state
    const turnState = initializeTurnState(playerIds, 1, 0);

    // Update gameState table
    const existingGameState = await ctx.db
      .query("gameState")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (existingGameState) {
      await ctx.db.patch(existingGameState._id, {
        currentRound: 1,
        currentPhase: "action",
        activePlayerId: turnState.playerOrder[0],
        passedPlayers: [],
        roundStartTime: Date.now(),
        lastUpdate: Date.now(),
      });
    } else {
      await ctx.db.insert("gameState", {
        roomId: args.roomId,
        currentRound: 1,
        currentPhase: "action",
        activePlayerId: turnState.playerOrder[0],
        passedPlayers: [],
        activeCombats: [],
        roundStartTime: Date.now(),
        lastUpdate: Date.now(),
      });
    }

    // Initialize player resources for all players
    for (const player of players) {
      const existingResources = await ctx.db
        .query("playerResources")
        .withIndex("by_room_player", (q) =>
          q.eq("roomId", args.roomId).eq("playerId", player.playerId)
        )
        .first();

      // Get faction to determine starting resources
      const factionId = player.factionId;
      let startingMaterials = 4;
      let startingScience = 2;
      let startingMoney = 2;

      if (factionId) {
        const faction = await ctx.db.get(factionId);
        if (faction) {
          startingMaterials = faction.startingMaterials;
          startingScience = faction.startingScience;
          startingMoney = faction.startingMoney;
        }
      }

      if (!existingResources) {
        await ctx.db.insert("playerResources", {
          roomId: args.roomId,
          playerId: player.playerId,
          materials: startingMaterials,
          science: startingScience,
          money: startingMoney,
          materialsTrack: 0,
          scienceTrack: 0,
          moneyTrack: 0,
          usedInfluenceDisks: 0,
          usedColonyShips: 0,
          victoryPoints: 0,
          hasPassed: false,
        });
      }
    }

    logInfo('turns', 'initialized', {
      tag: roomTag(args.roomId as unknown as string),
      players: playerIds.length,
      startingPlayer: turnState.playerOrder[0],
    });

    return { success: true, turnState };
  },
});

/**
 * Advance to the next phase
 * Called when current phase is complete
 */
export const advanceToNextPhase = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.db
      .query("gameState")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!gameState) {
      throw new Error("Game state not found");
    }

    const currentPhase = gameState.currentPhase;

    // Reconstruct turn state from database
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const sortedPlayers = players.sort((a, b) => {
      if (a.turnOrder !== undefined && b.turnOrder !== undefined) {
        return a.turnOrder - b.turnOrder;
      }
      return a.joinedAt - b.joinedAt;
    });

    const playerIds = sortedPlayers.map(p => p.playerId);
    const currentPlayerIndex = playerIds.indexOf(gameState.activePlayerId || playerIds[0]);

    const turnState: TurnState = {
      roundNum: gameState.currentRound,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      phase: gameState.currentPhase as any,
      currentPlayerIndex,
      playerOrder: playerIds,
      playerActions: {},
      passedPlayers: gameState.passedPlayers || [],
      allPlayersPassed: (gameState.passedPlayers || []).length === playerIds.length,
    };

    // Initialize player actions from database
    for (const playerId of playerIds) {
      const resources = await ctx.db
        .query("playerResources")
        .withIndex("by_room_player", (q) =>
          q.eq("roomId", args.roomId).eq("playerId", playerId)
        )
        .first();

      const faction = players.find(p => p.playerId === playerId)?.factionId;
      let maxInfluence = 16;
      if (faction) {
        const factionData = await ctx.db.get(faction);
        if (factionData) maxInfluence = factionData.maxInfluenceDisks;
      }

      turnState.playerActions[playerId] = {
        playerId,
        influenceAvailable: resources ? maxInfluence - resources.usedInfluenceDisks : maxInfluence,
        hasPassedThisRound: resources?.hasPassed || false,
        actionsThisRound: [],
        canReact: false,
      };
    }

    // Advance phase
    const newTurnState = advancePhase(turnState);

    // Handle phase-specific logic
    const newPhase = newTurnState.phase;
    const newRound = newTurnState.roundNum;

    // Process upkeep if entering upkeep phase
    if (newPhase === 'upkeep') {
      processUpkeep(newTurnState);

      // Reset all player influence usage
      for (const playerId of playerIds) {
        const resources = await ctx.db
          .query("playerResources")
          .withIndex("by_room_player", (q) =>
            q.eq("roomId", args.roomId).eq("playerId", playerId)
          )
          .first();

        if (resources) {
          await ctx.db.patch(resources._id, {
            usedInfluenceDisks: 0,
            hasPassed: false,
          });
        }
      }
    }

    // Process income if entering income phase (after upkeep)
    if (currentPhase === 'upkeep' && newPhase !== 'upkeep') {
      // Income phase - distribute resources
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const playerStates: Record<string, { resources: any; economy?: any }> = {};

      for (const playerId of playerIds) {
        const resources = await ctx.db
          .query("playerResources")
          .withIndex("by_room_player", (q) =>
            q.eq("roomId", args.roomId).eq("playerId", playerId)
          )
          .first();

        if (resources) {
          playerStates[playerId] = {
            resources: {
              credits: resources.money,
              materials: resources.materials,
              science: resources.science,
            },
          };
        }
      }

      const newResources = processIncome(turnState, playerStates);

      for (const playerId of playerIds) {
        const resources = await ctx.db
          .query("playerResources")
          .withIndex("by_room_player", (q) =>
            q.eq("roomId", args.roomId).eq("playerId", playerId)
          )
          .first();

        if (resources && newResources[playerId]) {
          await ctx.db.patch(resources._id, {
            money: newResources[playerId].credits,
            materials: newResources[playerId].materials,
            science: newResources[playerId].science,
          });
        }
      }
    }

    // Update gameState
    const nextPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;

    // Map GamePhase "end" to schema's "finished"
    const dbPhase = newPhase === 'end' ? 'finished' : newPhase;

    await ctx.db.patch(gameState._id, {
      currentRound: newRound,
      currentPhase: dbPhase as any,
      activePlayerId: newPhase === 'action' ? playerIds[nextPlayerIndex] : gameState.activePlayerId,
      passedPlayers: newPhase === 'action' ? [] : gameState.passedPlayers,
      lastUpdate: Date.now(),
    });

    logInfo('turns', 'phase advanced', {
      tag: roomTag(args.roomId as unknown as string),
      from: currentPhase,
      to: newPhase,
      round: newRound,
    });

    return { success: true, newPhase, newRound };
  },
});

/**
 * Pass turn (player is done with actions for this round)
 */
export const passTurn = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.db
      .query("gameState")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!gameState) {
      throw new Error("Game state not found");
    }

    if (gameState.currentPhase !== 'action') {
      throw new Error("Can only pass during action phase");
    }

    // Mark player as passed
    const resources = await ctx.db
      .query("playerResources")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    if (resources) {
      await ctx.db.patch(resources._id, {
        hasPassed: true,
      });
    }

    // Add to passed players list
    const passedPlayers = [...(gameState.passedPlayers || [])];
    if (!passedPlayers.includes(args.playerId)) {
      passedPlayers.push(args.playerId);
    }

    // Get total player count
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Check if all players have passed
    const allPassed = passedPlayers.length === players.length;

    // Move to next active player
    const sortedPlayers = players.sort((a, b) => {
      if (a.turnOrder !== undefined && b.turnOrder !== undefined) {
        return a.turnOrder - b.turnOrder;
      }
      return a.joinedAt - b.joinedAt;
    });

    const playerIds = sortedPlayers.map(p => p.playerId);
    let nextPlayerIndex = playerIds.indexOf(gameState.activePlayerId || playerIds[0]);

    // Find next player who hasn't passed
    if (!allPassed) {
      let attempts = 0;
      do {
        nextPlayerIndex = (nextPlayerIndex + 1) % playerIds.length;
        attempts++;
      } while (
        passedPlayers.includes(playerIds[nextPlayerIndex]) &&
        attempts < playerIds.length
      );
    }

    await ctx.db.patch(gameState._id, {
      passedPlayers,
      activePlayerId: playerIds[nextPlayerIndex],
      lastUpdate: Date.now(),
    });

    // Log action
    const actionNumber = await ctx.db
      .query("actionLog")
      .withIndex("by_room_player_round", (q) =>
        q.eq("roomId", args.roomId)
         .eq("playerId", args.playerId)
         .eq("round", gameState.currentRound)
      )
      .collect();

    await ctx.db.insert("actionLog", {
      roomId: args.roomId,
      playerId: args.playerId,
      round: gameState.currentRound,
      actionNumber: actionNumber.length + 1,
      actionType: "pass",
      materialsDelta: 0,
      scienceDelta: 0,
      moneyDelta: 0,
      timestamp: Date.now(),
    });

    logInfo('turns', 'player passed', {
      tag: roomTag(args.roomId as unknown as string),
      playerId: args.playerId,
      allPassed,
    });

    return { success: true, allPassed, nextPlayer: playerIds[nextPlayerIndex] };
  },
});

export default {
  initializeTurns,
  advanceToNextPhase,
  passTurn,
};
