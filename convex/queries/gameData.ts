/**
 * Eclipse: Second Dawn - Game Data Query Helpers
 *
 * Reusable query functions for accessing seeded game data.
 * These helpers provide consistent, optimized access patterns for actions.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

// ============================================================================
// FACTION QUERIES
// ============================================================================

/**
 * Get faction assigned to a player in a room
 */
export const getFactionByPlayer = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get player record
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .unique();

    if (!player || !player.factionId) {
      return null;
    }

    // Get faction details
    return await ctx.db.get(player.factionId);
  },
});

/**
 * Get faction by name
 */
export const getFactionByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("factions")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
  },
});

// ============================================================================
// TECHNOLOGY QUERIES
// ============================================================================

/**
 * Get technology by ID
 */
export const getTechnologyById = query({
  args: {
    techId: v.id("technologies"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.techId);
  },
});

/**
 * Get multiple technologies by IDs
 */
export const getTechnologiesByIds = query({
  args: {
    techIds: v.array(v.id("technologies")),
  },
  handler: async (ctx, args) => {
    return await Promise.all(args.techIds.map((id) => ctx.db.get(id)));
  },
});

/**
 * Get all technologies by track
 */
export const getTechnologiesByTrack = query({
  args: {
    track: v.union(
      v.literal("nano"),
      v.literal("grid"),
      v.literal("military"),
      v.literal("rare")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("technologies")
      .filter((q) => q.eq(q.field("track"), args.track))
      .collect();
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

    // Get full technology details
    return await Promise.all(
      playerTechs.map((pt) => ctx.db.get(pt.technologyId))
    );
  },
});

// ============================================================================
// SHIP PART QUERIES
// ============================================================================

/**
 * Get ship part by ID
 */
export const getPartById = query({
  args: {
    partId: v.id("parts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.partId);
  },
});

/**
 * Get multiple parts by IDs
 */
export const getPartsByIds = query({
  args: {
    partIds: v.array(v.id("parts")),
  },
  handler: async (ctx, args) => {
    return await Promise.all(args.partIds.map((id) => ctx.db.get(id)));
  },
});

/**
 * Get all parts unlocked by player's researched technologies
 */
export const getPlayerUnlockedParts = query({
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
    const techs = await Promise.all(
      playerTechs.map((pt) => ctx.db.get(pt.technologyId))
    );

    // Collect all unlocked part IDs
    const unlockedPartIds = new Set<string>();
    techs.forEach((tech) => {
      if (tech) {
        tech.unlocksParts.forEach((partId) => unlockedPartIds.add(partId));
      }
    });

    // Get part details
    return await Promise.all(
      Array.from(unlockedPartIds).map((id) => ctx.db.get(id as any))
    );
  },
});

/**
 * Get all parts of a specific type
 */
export const getPartsByType = query({
  args: {
    type: v.union(
      v.literal("cannon"),
      v.literal("missile"),
      v.literal("shield"),
      v.literal("computer"),
      v.literal("drive"),
      v.literal("hull"),
      v.literal("power_source")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("parts")
      .filter((q) => q.eq(q.field("type"), args.type))
      .collect();
  },
});

// ============================================================================
// VALIDATION QUERIES
// ============================================================================

/**
 * Validate if a player has unlocked a specific part
 * (checks if player has researched required technologies)
 */
export const validateTechUnlocked = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    partId: v.id("parts"),
  },
  handler: async (ctx, args) => {
    // Get part details
    const part = await ctx.db.get(args.partId);
    if (!part) {
      return { valid: false, reason: "Part not found" };
    }

    // If part has no tech requirements, it's always unlocked
    if (part.requiresTechnologyIds.length === 0) {
      return { valid: true, reason: "Starting part (no requirements)" };
    }

    // Get player's researched technologies
    const playerTechs = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();

    const playerTechIds = new Set(playerTechs.map((pt) => pt.technologyId));

    // Check if player has all required technologies
    const missingTechs = part.requiresTechnologyIds.filter(
      (techId) => !playerTechIds.has(techId)
    );

    if (missingTechs.length > 0) {
      // Get names of missing techs for error message
      const missingTechDetails = await Promise.all(
        missingTechs.map((id) => ctx.db.get(id))
      );
      const missingNames = missingTechDetails
        .map((t) => t?.name)
        .filter(Boolean)
        .join(", ");

      return {
        valid: false,
        reason: `Missing required technologies: ${missingNames}`,
        missingTechIds: missingTechs,
      };
    }

    return { valid: true, reason: "All requirements met" };
  },
});

/**
 * Validate if a blueprint is valid
 * (checks energy balance, slot limits, part compatibility)
 */
export const validateBlueprintValid = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    blueprintId: v.id("blueprints"),
  },
  handler: async (ctx, args) => {
    const blueprint = await ctx.db.get(args.blueprintId);
    if (!blueprint) {
      return { valid: false, errors: ["Blueprint not found"] };
    }

    const errors: string[] = [];

    // 1. Validate energy balance
    if (blueprint.energyUsed > blueprint.totalEnergy) {
      errors.push(
        `Insufficient energy: using ${blueprint.energyUsed} but only have ${blueprint.totalEnergy}`
      );
    }

    // 2. Validate player owns this blueprint
    if (blueprint.playerId !== args.playerId) {
      errors.push("Blueprint does not belong to player");
    }

    // 3. Validate room matches
    if (blueprint.roomId !== args.roomId) {
      errors.push("Blueprint not in this room");
    }

    // 4. Check if all parts are unlocked (optional, can be expensive)
    // Uncomment if needed:
    /*
    const allPartIds = [
      blueprint.parts.hull,
      blueprint.parts.powerSource,
      ...blueprint.parts.drives,
      ...blueprint.parts.computers,
      ...blueprint.parts.shields,
      ...blueprint.parts.weapons,
    ];

    for (const partId of allPartIds) {
      const validation = await validateTechUnlocked.handler(ctx, {
        roomId: args.roomId,
        playerId: args.playerId,
        partId,
      });

      if (!validation.valid) {
        errors.push(`Part not unlocked: ${validation.reason}`);
      }
    }
    */

    return {
      valid: errors.length === 0,
      errors,
      blueprint,
    };
  },
});

/**
 * Check if player has researched a specific technology
 */
export const hasPlayerResearchedTech = query({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    techId: v.id("technologies"),
  },
  handler: async (ctx, args) => {
    const playerTechs = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();

    return playerTechs.some((pt) => pt.technologyId === args.techId);
  },
});

// ============================================================================
// DICE QUERIES
// ============================================================================

/**
 * Get dice by type (for combat calculations)
 */
export const getDiceByType = query({
  args: {
    type: v.union(v.literal("yellow"), v.literal("orange"), v.literal("red")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dice")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .unique();
  },
});

// ============================================================================
// DISCOVERY & REPUTATION QUERIES
// ============================================================================

/**
 * Get all discovery tiles for a room
 */
export const getDiscoveryTiles = query({
  args: {
    roomId: v.optional(v.id("rooms")),
  },
  handler: async (ctx, args) => {
    if (args.roomId) {
      // Room-specific tiles would need roomId field in schema
      // For now, return all tiles
      return await ctx.db.query("discoveryTiles").collect();
    }
    return await ctx.db.query("discoveryTiles").collect();
  },
});

/**
 * Get all reputation tiles
 */
export const getReputationTiles = query({
  handler: async (ctx) => {
    return await ctx.db.query("reputationTiles").collect();
  },
});

/**
 * Get all ambassadors
 */
export const getAmbassadors = query({
  handler: async (ctx) => {
    return await ctx.db.query("ambassadors").collect();
  },
});
