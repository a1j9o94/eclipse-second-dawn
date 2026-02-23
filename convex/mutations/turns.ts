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
import { simulateCombat, type ShipSnap } from "../engine/combat";
import { calculateScores } from "./scoring";

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
      roundNum: gameState.currentRound ?? 1,
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

    // Process combat if entering combat phase
    if (newPhase === 'combat') {
      // Find all sectors with ships from multiple players
      const sectors = await ctx.db
        .query("sectors")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();

      for (const sector of sectors) {
        const shipsInSector = await ctx.db
          .query("ships")
          .withIndex("by_room_sector", (q) =>
            q.eq("roomId", args.roomId).eq("sectorId", sector._id)
          )
          .collect();

        // Group ships by player
        const shipsByPlayer: Record<string, typeof shipsInSector> = {};
        for (const ship of shipsInSector) {
          if (!ship.isDestroyed) {
            if (!shipsByPlayer[ship.playerId]) {
              shipsByPlayer[ship.playerId] = [];
            }
            shipsByPlayer[ship.playerId].push(ship);
          }
        }

        const playerIds = Object.keys(shipsByPlayer);

        // If there are ships from 2+ players in this sector, run combat
        if (playerIds.length >= 2) {
          // For simplicity, take first two players (in a full implementation, handle multi-player combat)
          const playerAId = playerIds[0];
          const playerBId = playerIds[1];

          // Convert ships to ShipSnap format for combat simulation
          const buildShipSnap = async (ship: typeof shipsInSector[0]): Promise<ShipSnap> => {
            const blueprint = await ctx.db.get(ship.blueprintId);
            if (!blueprint) {
              throw new Error(`Blueprint not found for ship ${ship._id}`);
            }

            // Get all parts
            const allParts = [
              blueprint.parts.hull,
              blueprint.parts.powerSource,
              ...blueprint.parts.drives,
              ...blueprint.parts.computers,
              ...blueprint.parts.shields,
              ...blueprint.parts.weapons,
            ];

            const parts = await Promise.all(
              allParts.map(async (partId) => {
                const part = await ctx.db.get(partId);
                return part;
              })
            );

            // Build weapon list
            const weapons = parts
              .filter((p) => p && (p.type === 'cannon' || p.type === 'missile'))
              .map((w) => {
                if (!w) return null;
                const faces = [];
                if (w.diceType && w.diceCount > 0) {
                  // Simplified dice faces (would need proper dice table lookup)
                  for (let i = 0; i < 6; i++) {
                    faces.push({ roll: i + 1, dmg: 1 });
                  }
                }
                return {
                  name: w.name,
                  dice: w.diceCount,
                  dmgPerHit: 1,
                  faces,
                };
              })
              .filter((w): w is NonNullable<typeof w> => w !== null);

            // Calculate stats
            const computerBonus = parts
              .filter((p) => p && p.type === 'computer')
              .reduce((sum, c) => sum + (c?.initiativeBonus || 0), 0);

            const shieldTier = parts
              .filter((p) => p && p.type === 'shield')
              .length;

            return {
              frame: { id: blueprint.shipType, name: blueprint.name },
              weapons,
              riftDice: 0, // TODO: Add rift cannon support
              stats: {
                init: blueprint.initiative,
                hullCap: blueprint.hull,
                valid: blueprint.isValid,
                aim: computerBonus,
                shieldTier,
                regen: 0,
              },
              hull: blueprint.hull - ship.damage,
              alive: !ship.isDestroyed,
              partIds: allParts.map(String),
            };
          };

          const fleetA = await Promise.all(
            shipsByPlayer[playerAId].map(buildShipSnap)
          );
          const fleetB = await Promise.all(
            shipsByPlayer[playerBId].map(buildShipSnap)
          );

          // Generate a deterministic seed from room + round + sector
          const seed = `${args.roomId}-${gameState.currentRound}-${sector._id}`;

          // Run combat simulation
          const result = simulateCombat({
            seed,
            playerAId,
            playerBId,
            fleetA,
            fleetB,
          });

          // Convert roundLog to combat events
          const events = result.roundLog.map((logEntry, index) => ({
            type: logEntry.includes('💥') ? 'destroyed' as const :
                  logEntry.includes('→') ? 'attack' as const :
                  'initiative' as const,
            playerId: logEntry.includes('🟦') ? playerAId : playerBId,
            data: logEntry,
            timestamp: Date.now() + index,
          }));

          // Store combat log
          await ctx.db.insert("combatLog", {
            roomId: args.roomId,
            sectorId: sector._id,
            round: gameState.currentRound ?? 1,
            attackerId: playerAId,
            defenderId: playerBId,
            events,
            winner: result.winnerPlayerId,
            completedAt: Date.now(),
          });

          // Update ships based on final state
          const updateFleet = async (fleet: ShipSnap[], playerId: string) => {
            const playerShips = shipsByPlayer[playerId];
            for (let i = 0; i < Math.min(fleet.length, playerShips.length); i++) {
              const finalShip = fleet[i];
              const dbShip = playerShips[i];
              await ctx.db.patch(dbShip._id, {
                damage: finalShip.stats.hullCap - finalShip.hull,
                isDestroyed: !finalShip.alive,
              });
            }
          };

          await updateFleet(result.finalA, playerAId);
          await updateFleet(result.finalB, playerBId);

          logInfo('combat', 'simulated', {
            tag: roomTag(args.roomId as unknown as string),
            sector: sector._id,
            winner: result.winnerPlayerId,
          });
        }
      }
    }

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

    // Check if game should end (after round 9 cleanup)
    const maxRounds = 9; // Standard Eclipse game length
    if (gameState.currentRound === maxRounds && newPhase === 'end') {
      // Trigger final scoring
      await calculateScores(ctx, args.roomId);

      logInfo('turns', 'game ended', {
        tag: roomTag(args.roomId as unknown as string),
        finalRound: gameState.currentRound,
      });

      return { success: true, newPhase: 'finished', newRound };
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
         .eq("round", gameState.currentRound ?? 1)
      )
      .collect();

    await ctx.db.insert("actionLog", {
      roomId: args.roomId,
      playerId: args.playerId,
      round: gameState.currentRound ?? 1,
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
