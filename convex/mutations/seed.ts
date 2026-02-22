/**
 * Eclipse: Second Dawn - Database Seeding Mutations
 *
 * Functions to populate the database with game configuration data.
 * These mutations should be called when:
 * 1. First initializing the application (one-time seed for static data)
 * 2. Creating a new game room (per-game seed for dynamic data)
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  technologies,
  parts,
  factions,
  discoveryTiles,
  reputationTiles,
  ambassadors,
  dice,
} from "../seedData";

// ============================================================================
// ONE-TIME SEEDS (Global data, seed once per database)
// ============================================================================

/**
 * Seed all factions (one-time, global)
 * Call this once when setting up the database.
 */
// Helper function for seeding factions
async function seedFactionsImpl(ctx: any) {
  // Check if factions already exist
  const existingFactions = await ctx.db.query("factions").collect();
  if (existingFactions.length > 0) {
    console.log("Factions already seeded, skipping...");
    return { success: true, message: "Factions already exist", count: existingFactions.length };
  }

  const factionIds: Record<string, string> = {};

  for (const faction of factions) {
    const id = await ctx.db.insert("factions", {
        name: faction.name,
        description: faction.description,

        // Starting resources
        startingMaterials: faction.startingMaterials,
        startingScience: faction.startingScience,
        startingMoney: faction.startingMoney,

        // Capacities
        maxInfluenceDisks: faction.maxInfluenceDisks,
        influenceCosts: faction.influenceCosts,
        maxColonyShips: faction.maxColonyShips,
        maxReputationTiles: faction.maxReputationTiles,
        maxAmbassadors: faction.maxAmbassadors,

        // Mechanics
        actionCount: faction.actionCount,
        tradeRatio: faction.tradeRatio,
        defaultBlueprintIds: faction.defaultBlueprints,

        // Abilities
        specialAbilities: faction.specialAbilities,
      });

      factionIds[faction.name] = id;
    }

  console.log(`✅ Seeded ${factions.length} factions`);
  return { success: true, count: factions.length, factionIds };
}

export const seedFactions = mutation({
  handler: async (ctx) => seedFactionsImpl(ctx),
});

/**
 * Seed all dice types (one-time, global)
 */
async function seedDiceImpl(ctx: any) {
  const existingDice = await ctx.db.query("dice").collect();
  if (existingDice.length > 0) {
    console.log("Dice already seeded, skipping...");
    return { success: true, message: "Dice already exist", count: existingDice.length };
  }

  for (const die of dice) {
    await ctx.db.insert("dice", {
      type: die.type,
      sides: die.sides,
    });
  }

  console.log(`✅ Seeded ${dice.length} dice types`);
  return { success: true, count: dice.length };
}

export const seedDice = mutation({
  handler: async (ctx) => seedDiceImpl(ctx),
});

/**
 * Seed all ship parts (one-time, global)
 * Parts reference technologies, so seed technologies first.
 */
async function seedPartsImpl(ctx: any) {
  const existingParts = await ctx.db.query("parts").collect();
    if (existingParts.length > 0) {
      console.log("Parts already seeded, skipping...");
      return { success: true, message: "Parts already exist", count: existingParts.length };
    }

    // Get all technologies to resolve references
    const allTechs = await ctx.db.query("technologies").collect();
    const techByName = new Map(allTechs.map((t: any) => [t.name, t._id]));

    for (const part of parts) {
      // Resolve technology requirements
      const requiresTechnologyIds = part.requiresTechnologies
        .map((techName) => techByName.get(techName))
        .filter((id) => id !== undefined) as any[];

      await ctx.db.insert("parts", {
        name: part.name,
        type: part.type,

        // Combat stats
        diceType: part.diceType,
        diceCount: part.diceCount,

        // Effects
        energyProduction: part.energyProduction,
        energyCost: part.energyCost,
        initiativeBonus: part.initiativeBonus,
        hullValue: part.hullValue,
        driveSpeed: part.driveSpeed,

        // Special effects
        effect: part.effect,
        effectData: part.effectData,

        // Requirements
        requiresTechnologyIds,
      });
    }

  console.log(`✅ Seeded ${parts.length} ship parts`);
  return { success: true, count: parts.length };
}

export const seedParts = mutation({
  handler: async (ctx) => seedPartsImpl(ctx),
});

/**
 * Seed all technologies (one-time, global)
 * Note: Technologies reference parts via unlocksParts, which are resolved later.
 */
async function seedTechnologiesImpl(ctx: any) {
  const existingTechs = await ctx.db.query("technologies").collect();
    if (existingTechs.length > 0) {
      console.log("Technologies already seeded, skipping...");
      return { success: true, message: "Technologies already exist", count: existingTechs.length };
    }

    for (const tech of technologies) {
      await ctx.db.insert("technologies", {
        name: tech.name,
        track: tech.track,
        tier: tech.tier,
        cost: tech.maxCost, // Use max cost as base

        // Effects
        effect: tech.effect,
        effectData: tech.effectData,

        // Unlocks (part names, not IDs - will be resolved by queries)
        unlocksParts: [], // Parts haven't been created yet
        victoryPoints: tech.victoryPoints,

        // Visual
        position: tech.position,
      });
    }

  console.log(`✅ Seeded ${technologies.length} technologies`);
  return { success: true, count: technologies.length };
}

export const seedTechnologies = mutation({
  handler: async (ctx) => seedTechnologiesImpl(ctx),
});

/**
 * Update technology->part references after both are seeded
 */
async function linkTechnologiesToPartsImpl(ctx: any) {
  const allTechs = await ctx.db.query("technologies").collect();
    const allParts = await ctx.db.query("parts").collect();
    const partByName = new Map(allParts.map((p: any) => [p.name, p._id]));

    let updated = 0;

    for (const tech of allTechs) {
      // Find corresponding seed data
      const seedTech = technologies.find((t) => t.name === tech.name);
      if (!seedTech) continue;

      // Resolve part IDs
      const unlocksPartIds = seedTech.unlocksParts
        .map((partName) => partByName.get(partName))
        .filter((id) => id !== undefined) as any[];

      if (unlocksPartIds.length > 0) {
        await ctx.db.patch(tech._id, { unlocksParts: unlocksPartIds as any });
        updated++;
      }
    }

  console.log(`✅ Linked ${updated} technologies to their parts`);
  return { success: true, updated };
}

export const linkTechnologiesToParts = mutation({
  handler: async (ctx) => linkTechnologiesToPartsImpl(ctx),
});

// ============================================================================
// PER-GAME SEEDS (Create new instances for each game)
// ============================================================================

/**
 * Seed discovery tiles for a specific game
 */
async function seedDiscoveryTilesImpl(ctx: any, _args: any) {
  const tileIds = [];

    for (const tile of discoveryTiles) {
      // Create 'count' instances of each tile type
      for (let i = 0; i < tile.count; i++) {
        const id = await ctx.db.insert("discoveryTiles", {
          type: tile.type as any,

          // Immediate effects
          moneyBonus: tile.moneyBonus,
          scienceBonus: tile.scienceBonus,
          materialsBonus: tile.materialsBonus,

          // Special effects (would need to resolve tech/part IDs in real implementation)
          grantsTechnologyId: undefined, // TODO: resolve from tile.grantsTechnology
          grantsPartId: undefined, // TODO: resolve from tile.grantsPart

          victoryPoints: tile.victoryPoints,
          effect: tile.effect,
          effectData: tile.effectData,
        });

        tileIds.push(id);
      }
    }

  console.log(`✅ Seeded ${tileIds.length} discovery tiles`);
  return { success: true, count: tileIds.length, tileIds };
}

export const seedDiscoveryTiles = mutation({
  args: {
    roomId: v.optional(v.id("rooms")), // Optional - can seed globally or per-room
  },
  handler: async (ctx, args) => seedDiscoveryTilesImpl(ctx, args),
});

/**
 * Seed reputation tiles (global pool)
 */
async function seedReputationTilesImpl(ctx: any) {
  const existingTiles = await ctx.db.query("reputationTiles").collect();
    if (existingTiles.length > 0) {
      console.log("Reputation tiles already seeded, skipping...");
      return { success: true, message: "Reputation tiles already exist", count: existingTiles.length };
    }

    for (const tile of reputationTiles) {
      await ctx.db.insert("reputationTiles", {
        victoryPoints: tile.victoryPoints,
        count: tile.count,
      });
    }

  console.log(`✅ Seeded ${reputationTiles.length} reputation tile types`);
  return { success: true, count: reputationTiles.length };
}

export const seedReputationTiles = mutation({
  handler: async (ctx) => seedReputationTilesImpl(ctx),
});

/**
 * Seed ambassadors (global pool)
 */
async function seedAmbassadorsImpl(ctx: any) {
  const existingAmbassadors = await ctx.db.query("ambassadors").collect();
    if (existingAmbassadors.length > 0) {
      console.log("Ambassadors already seeded, skipping...");
      return { success: true, message: "Ambassadors already exist", count: existingAmbassadors.length };
    }

    for (const ambassador of ambassadors) {
      await ctx.db.insert("ambassadors", {
        name: ambassador.name,
        effect: ambassador.effect,
        effectData: ambassador.effectData,
        count: ambassador.count,
      });
    }

  console.log(`✅ Seeded ${ambassadors.length} ambassador types`);
  return { success: true, count: ambassadors.length };
}

export const seedAmbassadors = mutation({
  handler: async (ctx) => seedAmbassadorsImpl(ctx),
});

// ============================================================================
// MASTER INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize all global game data (run once per database)
 * This should be called when setting up a new Convex deployment.
 */
export const initializeGlobalGameData = mutation({
  handler: async (ctx) => {
    console.log("🚀 Initializing Eclipse: Second Dawn global game data...");

    const results = {
      factions: await seedFactionsImpl(ctx),
      dice: await seedDiceImpl(ctx),
      technologies: await seedTechnologiesImpl(ctx),
      parts: await seedPartsImpl(ctx),
      reputationTiles: await seedReputationTilesImpl(ctx),
      ambassadors: await seedAmbassadorsImpl(ctx),
    };

    // Link technologies to parts after both are created
    const linkResult = await linkTechnologiesToPartsImpl(ctx);

    console.log("✅ Global game data initialized!");
    console.log(`  - Factions: ${results.factions.count}`);
    console.log(`  - Technologies: ${results.technologies.count}`);
    console.log(`  - Parts: ${results.parts.count}`);
    console.log(`  - Dice: ${results.dice.count}`);
    console.log(`  - Reputation Tiles: ${results.reputationTiles.count}`);
    console.log(`  - Ambassadors: ${results.ambassadors.count}`);
    console.log(`  - Tech->Part links: ${linkResult.updated}`);

    return {
      success: true,
      results,
      linkResult,
    };
  },
});

/**
 * Initialize data for a new game room
 * This creates room-specific instances of discovery tiles, etc.
 */
export const initializeGameRoom = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    console.log(`🎮 Initializing game room: ${args.roomId}`);

    // Seed discovery tiles for this room
    const discoveryResult = await seedDiscoveryTilesImpl(ctx, { roomId: args.roomId });

    console.log(`✅ Game room ${args.roomId} initialized!`);
    console.log(`  - Discovery Tiles: ${discoveryResult.count}`);

    return {
      success: true,
      roomId: args.roomId,
      discoveryTiles: discoveryResult.count,
    };
  },
});

/**
 * Clear all seeded data (for testing/development)
 * WARNING: This deletes all game configuration data!
 */
export const clearAllSeedData = mutation({
  handler: async (ctx) => {
    console.log("⚠️  Clearing all seed data...");

    // Delete all records from seed tables
    const tables = [
      "factions",
      "technologies",
      "parts",
      "dice",
      "discoveryTiles",
      "reputationTiles",
      "ambassadors",
    ] as const;

    const deleted: Record<string, number> = {};

    for (const table of tables) {
      const records = await ctx.db.query(table).collect();
      for (const record of records) {
        await ctx.db.delete(record._id);
      }
      deleted[table] = records.length;
    }

    console.log("🗑️  All seed data cleared!");
    return { success: true, deleted };
  },
});
