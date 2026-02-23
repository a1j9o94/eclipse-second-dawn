/**
 * Eclipse: Second Dawn - End-of-Game Scoring
 *
 * Calculates final victory points and determines winner
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { logInfo, roomTag } from "../helpers/log";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Helper function to calculate final scores
 * Can be called from mutations
 */
export async function calculateScores(ctx: MutationCtx, roomId: Id<"rooms">) {
    // Get all players
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    if (players.length === 0) {
      throw new Error("No players found in room");
    }

    const playerScores: Array<{
      playerId: string;
      playerName: string;
      factionName: string;
      victoryPoints: number;
      breakdown: {
        sectors: number;
        technologies: number;
        reputation: number;
        discovery: number;
      };
    }> = [];

    // Calculate VP for each player
    for (const player of players) {
      let totalVP = 0;
      const breakdown = {
        sectors: 0,
        technologies: 0,
        reputation: 0,
        discovery: 0,
      };

      // 1. VP from controlled sectors (1 VP per sector with at least one planet)
      const controlledSectors = await ctx.db
        .query("sectors")
        .withIndex("by_controller", (q) =>
          q.eq("roomId", roomId).eq("controlledBy", player.playerId)
        )
        .collect();

      for (const sector of controlledSectors) {
        if (sector.planets.length > 0) {
          breakdown.sectors += 1;
        }
      }

      // 2. VP from researched technologies
      const playerTechs = await ctx.db
        .query("playerTechnologies")
        .withIndex("by_room_player", (q) =>
          q.eq("roomId", roomId).eq("playerId", player.playerId)
        )
        .collect();

      for (const playerTech of playerTechs) {
        const tech = await ctx.db.get(playerTech.technologyId);
        if (tech) {
          breakdown.technologies += tech.victoryPoints;
        }
      }

      // 3. VP from reputation tiles
      const reputationTiles = await ctx.db
        .query("playerReputationTiles")
        .withIndex("by_room_player", (q) =>
          q.eq("roomId", roomId).eq("playerId", player.playerId)
        )
        .collect();

      for (const repTile of reputationTiles) {
        const tile = await ctx.db.get(repTile.reputationTileId);
        if (tile) {
          breakdown.reputation += tile.victoryPoints;
        }
      }

      // 4. VP from kept discovery tiles
      const discoveryTiles = await ctx.db
        .query("playerDiscoveryTiles")
        .withIndex("by_room_player_kept", (q) =>
          q.eq("roomId", roomId).eq("playerId", player.playerId).eq("isKept", true)
        )
        .collect();

      for (const discTile of discoveryTiles) {
        const tile = await ctx.db.get(discTile.discoveryTileId);
        if (tile) {
          breakdown.discovery += tile.victoryPoints;
        }
      }

      // Sum up all VP
      totalVP = breakdown.sectors + breakdown.technologies + breakdown.reputation + breakdown.discovery;

      // Get faction name
      let factionName = "Unknown";
      if (player.factionId) {
        const faction = await ctx.db.get(player.factionId);
        if (faction) {
          factionName = faction.name;
        }
      }

      playerScores.push({
        playerId: player.playerId,
        playerName: player.playerName,
        factionName,
        victoryPoints: totalVP,
        breakdown,
      });

      // Update player resources with final VP
      const resources = await ctx.db
        .query("playerResources")
        .withIndex("by_room_player", (q) =>
          q.eq("roomId", roomId).eq("playerId", player.playerId)
        )
        .first();

      if (resources) {
        await ctx.db.patch(resources._id, {
          victoryPoints: totalVP,
        });
      }
    }

    // Sort by VP (descending) and assign ranks
    playerScores.sort((a, b) => b.victoryPoints - a.victoryPoints);

    const rankings = playerScores.map((score, index) => ({
      playerId: score.playerId,
      playerName: score.playerName,
      factionName: score.factionName,
      victoryPoints: score.victoryPoints,
      rank: index + 1,
    }));

    // Get game metadata
    const gameState = await ctx.db
      .query("gameState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .first();

    const totalRounds = gameState?.currentRound ?? 9;
    const startTime = gameState?.roundStartTime ?? Date.now();
    const duration = Date.now() - startTime;

    // Store game results
    const existingResults = await ctx.db
      .query("gameResults")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .first();

    if (existingResults) {
      await ctx.db.patch(existingResults._id, {
        rankings,
        totalRounds,
        duration,
        finishedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("gameResults", {
        roomId: roomId,
        rankings,
        totalRounds,
        duration,
        finishedAt: Date.now(),
      });
    }

    // Update game state to finished
    if (gameState) {
      await ctx.db.patch(gameState._id, {
        currentPhase: "finished",
        lastUpdate: Date.now(),
      });
    }

    // Update room status
    const room = await ctx.db.get(roomId);
    if (room) {
      await ctx.db.patch(roomId, {
        status: "finished",
      });
    }

    logInfo('scoring', 'game finished', {
      tag: roomTag(roomId as unknown as string),
      winner: rankings[0].playerName,
      winnerVP: rankings[0].victoryPoints,
      totalPlayers: rankings.length,
    });

    return {
      success: true,
      winner: rankings[0],
      rankings,
      playerScores, // Include breakdown for display
    };
}

/**
 * Calculate final scores and create game results
 * Called when game reaches final round (round 9)
 */
export const calculateFinalScores = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    return await calculateScores(ctx, args.roomId);
  },
});

export default {
  calculateFinalScores,
  calculateScores,
};
