import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get all available technologies
 */
export const getAllTechnologies = query({
  args: {},
  handler: async (ctx) => {
    const technologies = await ctx.db.query("technologies").collect();
    return technologies;
  },
});

/**
 * Get technologies by track
 */
export const getTechnologiesByTrack = query({
  args: {
    track: v.union(
      v.literal("nano"),
      v.literal("grid"),
      v.literal("military"),
      v.literal("rare"),
      v.literal("propulsion"),
      v.literal("plasma")
    ),
  },
  handler: async (ctx, args) => {
    const technologies = await ctx.db
      .query("technologies")
      .withIndex("by_track", (q) => q.eq("track", args.track))
      .collect();

    return technologies;
  },
});

/**
 * Get a specific technology
 */
export const getTechnology = query({
  args: { technologyId: v.id("technologies") },
  handler: async (ctx, args) => {
    const technology = await ctx.db.get(args.technologyId);
    return technology;
  },
});

/**
 * Get player's researched technologies
 */
export const getPlayerTechnologies = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const playerTechs = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();

    return playerTechs;
  },
});

/**
 * Check if player has researched a specific technology
 */
export const hasPlayerResearchedTech = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    technologyId: v.id("technologies"),
  },
  handler: async (ctx, args) => {
    const playerTech = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .filter((q) => q.eq(q.field("technologyId"), args.technologyId))
      .first();

    return !!playerTech;
  },
});

/**
 * Get parts unlocked by a technology
 */
export const getPartsUnlockedByTech = query({
  args: { technologyId: v.id("technologies") },
  handler: async (ctx, args) => {
    const technology = await ctx.db.get(args.technologyId);

    if (!technology) {
      return [];
    }

    const parts = await Promise.all(
      technology.unlocksParts.map(partId => ctx.db.get(partId))
    );

    return parts.filter(p => p !== null);
  },
});

/**
 * Get all available technologies for a room
 * (All technologies in the pool - for research UI)
 */
export const getAvailableTechnologies = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx) => {
    // Get all technologies from the pool
    const allTechnologies = await ctx.db.query("technologies").collect();

    return allTechnologies;
  },
});

/**
 * Get player's researched technologies with full details
 * (For displaying player's research progress in UI)
 */
export const getPlayerResearchedTechs = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get player's technology records
    const playerTechs = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();

    // Get full technology details
    const technologies = await Promise.all(
      playerTechs.map(async (pt) => {
        const tech = await ctx.db.get(pt.technologyId);
        return {
          ...tech,
          acquiredInRound: pt.acquiredInRound,
        };
      })
    );

    return technologies.filter((t) => t !== null);
  },
});

/**
 * Get all parts unlocked by player's researched technologies
 * (For blueprint editor - shows which parts are available)
 */
export const getUnlockedParts = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get player's researched technologies
    const playerTechs = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();

    // Get technology details
    const technologies = await Promise.all(
      playerTechs.map((pt) => ctx.db.get(pt.technologyId))
    );

    // Collect all unlocked part IDs
    const unlockedPartIds = new Set<string>();
    technologies.forEach((tech) => {
      if (tech) {
        tech.unlocksParts.forEach((partId) => unlockedPartIds.add(partId));
      }
    });

    // Get part details
    const parts = await Promise.all(
      Array.from(unlockedPartIds).map((id) => ctx.db.get(id as any))
    );

    return parts.filter((p) => p !== null);
  },
});

/**
 * Get technology cost (for integration with Stream 4)
 * Returns the science cost for a specific technology
 */
export const getTechCost = query({
  args: { technologyId: v.id("technologies") },
  handler: async (ctx, args) => {
    const technology = await ctx.db.get(args.technologyId);

    if (!technology) {
      return null;
    }

    return {
      science: technology.cost,
      victoryPoints: technology.victoryPoints,
    };
  },
});

/**
 * Get total victory points from player's researched technologies
 * (For Stream 6 - Victory Points calculation)
 */
export const getTechVictoryPoints = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get player's researched technologies
    const playerTechs = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();

    // Get technology details and sum VP
    const technologies = await Promise.all(
      playerTechs.map((pt) => ctx.db.get(pt.technologyId))
    );

    const totalVP = technologies.reduce((sum, tech) => {
      return sum + (tech?.victoryPoints || 0);
    }, 0);

    return {
      totalVictoryPoints: totalVP,
      techCount: technologies.length,
      technologies: technologies.filter((t) => t !== null),
    };
  },
});

/**
 * Validate if player can research a technology
 * (For Stream 4 - Action validation)
 */
export const validateResearch = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    technologyId: v.id("technologies"),
  },
  handler: async (ctx, args) => {
    // Get technology
    const technology = await ctx.db.get(args.technologyId);
    if (!technology) {
      return { valid: false, reason: "Technology not found" };
    }

    // Check if already researched
    const existing = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .filter((q) => q.eq(q.field("technologyId"), args.technologyId))
      .first();

    if (existing) {
      return { valid: false, reason: "Technology already researched" };
    }

    // Get player resources
    const resources = await ctx.db
      .query("playerResources")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    if (!resources) {
      return { valid: false, reason: "Player resources not found" };
    }

    // Check if can afford
    if (resources.science < technology.cost) {
      return {
        valid: false,
        reason: `Not enough science (need ${technology.cost}, have ${resources.science})`,
      };
    }

    return {
      valid: true,
      cost: technology.cost,
      technology: technology.name,
    };
  },
});
