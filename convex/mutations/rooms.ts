/**
 * Eclipse: Second Dawn - Room Mutations
 *
 * Mutations for room creation, joining, and lobby management
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Generate a unique 6-character room code
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a unique player ID
 */
function generatePlayerId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * Create a new multiplayer room
 *
 * Creates a room and adds the host as the first player.
 * Returns roomId, roomCode (for sharing), and playerId (for the host).
 */
export const createRoom = mutation({
  args: {
    roomName: v.string(),
    isPublic: v.boolean(),
    playerName: v.string(),
    gameConfig: v.object({
      enableRiseOfTheAncients: v.optional(v.boolean()),
      enableShadowOfTheRift: v.optional(v.boolean()),
      victoryPointGoal: v.optional(v.number()),
      // Legacy roguelike fields for backward compatibility
      startingShips: v.optional(v.number()),
      livesPerPlayer: v.optional(v.number()),
      multiplayerLossPct: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const roomCode = generateRoomCode();
    const playerId = generatePlayerId();

    // Create the room
    const roomId = await ctx.db.insert("rooms", {
      roomCode,
      roomName: args.roomName,
      isPublic: args.isPublic,
      status: "waiting",
      maxPlayers: 6, // Eclipse supports 2-6 players
      currentPlayers: 1,
      gameConfig: args.gameConfig,
      createdAt: Date.now(),
    });

    // Add the host as the first player
    await ctx.db.insert("players", {
      roomId,
      playerId,
      playerName: args.playerName,
      isHost: true,
      isReady: false,
      joinedAt: Date.now(),
    });

    return { roomId, roomCode, playerId };
  },
});

/**
 * Join an existing room by room code
 *
 * Validates that the room exists, is waiting for players, and has space.
 * Returns roomId and a new playerId for the joining player.
 */
export const joinRoom = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize the room code (uppercase, trim whitespace)
    const normalizedCode = args.roomCode.trim().toUpperCase();

    // Find the room by code
    let room = await ctx.db
      .query("rooms")
      .withIndex("by_room_code", (q) => q.eq("roomCode", normalizedCode))
      .first();

    // Fallback: search across common statuses in case the index code changed
    if (!room) {
      const waiting = await ctx.db
        .query("rooms")
        .withIndex("by_status", (q) => q.eq("status", "waiting"))
        .collect();
      const match = waiting.find(
        (r) => r.roomCode.toUpperCase() === normalizedCode
      );
      room = match ?? null;
    }

    // Check if room exists but is already playing
    if (!room) {
      const playing = await ctx.db
        .query("rooms")
        .withIndex("by_status", (q) => q.eq("status", "playing"))
        .collect();
      const match2 = playing.find(
        (r) => r.roomCode.toUpperCase() === normalizedCode
      );
      if (match2) {
        throw new Error("Game already in progress");
      }
    }

    if (!room) {
      throw new Error("Room not found");
    }

    // Validate room status
    if (room.status !== "waiting") {
      throw new Error("Game already in progress");
    }

    // Validate room has space
    if (room.currentPlayers >= room.maxPlayers) {
      throw new Error("Room is full");
    }

    // Generate player ID and add to room
    const playerId = generatePlayerId();

    await ctx.db.insert("players", {
      roomId: room._id,
      playerId,
      playerName: args.playerName,
      isHost: false,
      isReady: false,
      joinedAt: Date.now(),
    });

    // Update room player count
    await ctx.db.patch(room._id, {
      currentPlayers: room.currentPlayers + 1,
    });

    return { roomId: room._id, playerId };
  },
});

/**
 * Toggle a player's ready status
 *
 * Used in the lobby to indicate players are ready to start.
 */
export const updatePlayerReady = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    isReady: v.boolean(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    await ctx.db.patch(player._id, { isReady: args.isReady });

    return player._id;
  },
});

/**
 * Set a player's faction
 *
 * Looks up the faction by name and sets the factionId on the player.
 */
export const setPlayerFaction = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    factionName: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the player
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    // Look up the faction by name
    const faction = await ctx.db
      .query("factions")
      .withIndex("by_name", (q) => q.eq("name", args.factionName))
      .first();

    if (!faction) {
      throw new Error(`Faction "${args.factionName}" not found`);
    }

    // Update player's faction
    await ctx.db.patch(player._id, { factionId: faction._id });

    return true;
  },
});

/**
 * Start the game
 *
 * Validates that the host is starting the game, sets room status to "playing",
 * initializes gameState, creates starting sectors, and sets up player resources.
 */
export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    // Verify the player is the host
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    if (!player?.isHost) {
      throw new Error("Only the host can start the game");
    }

    // Get all players in the room
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Validate minimum player count (2 players for Eclipse)
    if (players.length < 2) {
      throw new Error("Need at least 2 players to start");
    }

    // Check that all players are ready
    const allReady = players.every((p) => p.isReady);
    if (!allReady) {
      throw new Error("All players must be ready to start");
    }

    // Check that all players have selected a faction
    const allHaveFactions = players.every((p) => p.factionId !== undefined);
    if (!allHaveFactions) {
      throw new Error("All players must select a faction before starting");
    }

    // Update room status to playing
    await ctx.db.patch(args.roomId, { status: "playing" });

    // Shuffle player order and assign turn order
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledPlayers.length; i++) {
      const playerRecord = await ctx.db
        .query("players")
        .withIndex("by_room_and_player", (q) =>
          q.eq("roomId", args.roomId).eq("playerId", shuffledPlayers[i].playerId)
        )
        .first();
      if (playerRecord) {
        await ctx.db.patch(playerRecord._id, { turnOrder: i });
      }
    }

    // Initialize game state
    await ctx.db.insert("gameState", {
      roomId: args.roomId,
      currentRound: 1,
      currentPhase: "action",
      activePlayerId: shuffledPlayers[0].playerId,
      passedPlayers: [],
      activeCombats: [],
      roundStartTime: Date.now(),
      lastUpdate: Date.now(),
    });

    // Initialize player resources for each player
    for (const player of players) {
      // Get faction data for starting resources
      const faction = player.factionId ? await ctx.db.get(player.factionId) : null;

      const startingMaterials = faction?.startingMaterials ?? 5;
      const startingScience = faction?.startingScience ?? 3;
      const startingMoney = faction?.startingMoney ?? 15;

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

    // Create center sector (Galactic Center)
    await ctx.db.insert("sectors", {
      roomId: args.roomId,
      position: { q: 0, r: 0 },
      type: "center",
      planets: [],
      hasAncient: false,
      warpPortals: [0, 1, 2, 3, 4, 5], // All 6 sides have wormholes
      hasDiscoveryTile: false,
      rotation: 0,
    });

    // Create home sectors for each player at predefined positions
    // Positions are based on ring 2 coordinates, evenly spaced
    const homeSectorPositions: Record<number, Array<{ q: number; r: number }>> = {
      2: [
        { q: 0, r: -2 },  // North
        { q: 0, r: 2 },   // South
      ],
      3: [
        { q: 0, r: -2 },  // North
        { q: 2, r: 0 },   // Southeast
        { q: -2, r: 2 },  // Southwest
      ],
      4: [
        { q: 0, r: -2 },  // North
        { q: 2, r: 0 },   // East
        { q: 0, r: 2 },   // South
        { q: -2, r: 0 },  // West
      ],
      5: [
        { q: 0, r: -2 },  // North
        { q: 2, r: -1 },  // Northeast
        { q: 2, r: 0 },   // Southeast
        { q: 0, r: 2 },   // South
        { q: -2, r: 0 },  // West
      ],
      6: [
        { q: 0, r: -2 },  // North
        { q: 2, r: -1 },  // Northeast
        { q: 2, r: 0 },   // East
        { q: 0, r: 2 },   // South
        { q: -2, r: 2 },  // Southwest
        { q: -2, r: 0 },  // West
      ],
    };

    const positions = homeSectorPositions[players.length] || homeSectorPositions[2];

    for (let i = 0; i < players.length; i++) {
      const position = positions[i];

      await ctx.db.insert("sectors", {
        roomId: args.roomId,
        position,
        type: "starting",
        planets: [
          { type: "materials", isAdvanced: false },
          { type: "materials", isAdvanced: false },
          { type: "money", isAdvanced: false },
        ],
        hasAncient: false,
        warpPortals: [0, 3], // Wormholes on opposite sides
        hasDiscoveryTile: false,
        controlledBy: shuffledPlayers[i].playerId,
        rotation: 0,
      });
    }

    return true;
  },
});
