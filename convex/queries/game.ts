/**
 * Eclipse: Second Dawn - Game State Queries
 *
 * Query current game state, turn information, and phase data
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get current game state for a room
 */
export const getGameState = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.db
      .query("gameState")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    return gameState;
  },
});

/**
 * Get all players in a room
 */
export const getPlayers = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    return players;
  },
});

/**
 * Get action log for current round
 */
export const getCurrentRoundActions = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.db
      .query("gameState")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!gameState) {
      return [];
    }

    const actions = await ctx.db
      .query("actionLog")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", args.roomId).eq("round", gameState.currentRound ?? 1)
      )
      .collect();

    return actions;
  },
});

/**
 * Get player's action count for current round
 */
export const getPlayerActionCount = query({
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
      return 0;
    }

    const actions = await ctx.db
      .query("actionLog")
      .withIndex("by_room_player_round", (q) =>
        q
          .eq("roomId", args.roomId)
          .eq("playerId", args.playerId)
          .eq("round", gameState.currentRound ?? 1)
      )
      .collect();

    return actions.length;
  },
});

/**
 * Get combat results for current round
 */
export const getCurrentRoundCombatResults = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.db
      .query("gameState")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!gameState) {
      return [];
    }

    const combatLogs = await ctx.db
      .query("combatLog")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", args.roomId).eq("round", gameState.currentRound ?? 1)
      )
      .collect();

    return combatLogs;
  },
});

/**
 * Get game results (final scores)
 */
export const getGameResults = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("gameResults")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    return results;
  },
});
