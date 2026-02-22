/**
 * Eclipse: Second Dawn - Room Queries
 *
 * Query room details, public lobby information, etc.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get room details including players
 */
export const getRoomDetails = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      return null;
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    return {
      room,
      players: players.map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        isHost: p.isHost,
        isReady: p.isReady,
        factionId: p.factionId,
      })),
    };
  },
});

/**
 * Get public rooms with detailed information
 */
export const getPublicRoomsDetailed = query({
  args: {},
  handler: async (ctx) => {
    // Get all public rooms that are waiting for players
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_public", (q) => q.eq("isPublic", true).eq("status", "waiting"))
      .collect();

    // Get player details for each room
    const roomsWithDetails = await Promise.all(
      rooms.map(async (room) => {
        const players = await ctx.db
          .query("players")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();

        const hostPlayer = players.find(p => p.isHost);

        return {
          roomId: room._id,
          roomCode: room.roomCode,
          roomName: room.roomName,
          currentPlayers: room.currentPlayers,
          maxPlayers: room.maxPlayers,
          startingShips: 1, // Default for Eclipse
          livesPerPlayer: 1, // Default for Eclipse
          hostName: hostPlayer?.playerName || "Unknown",
          hostLives: 1, // Default for Eclipse
          createdAt: room.createdAt,
        };
      })
    );

    // Sort by most recently created
    return roomsWithDetails.sort((a, b) => b.createdAt - a.createdAt);
  },
});
