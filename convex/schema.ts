import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Eclipse: Second Dawn - Complete Data Schema
 *
 * Design Decisions:
 * 1. Normalization: Game configuration (factions, technologies, parts) separated from game state
 * 2. Player-specific state tracked in dedicated tables with roomId+playerId composite keys
 * 3. Denormalized arrays for quick lookups (e.g., technologyIds on players)
 * 4. String enums for type safety on game phases, resource types, etc.
 * 5. Sector ownership and control tracked separately for influence mechanics
 */

export default defineSchema({
  // ============================================================================
  // ROOM & LOBBY
  // ============================================================================

  rooms: defineTable({
    roomCode: v.string(),
    roomName: v.string(),
    isPublic: v.boolean(),
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished")
    ),
    maxPlayers: v.number(), // 2-6 players
    currentPlayers: v.number(),
    gameConfig: v.object({
      enableRiseOfTheAncients: v.optional(v.boolean()),
      enableShadowOfTheRift: v.optional(v.boolean()),
      victoryPointGoal: v.optional(v.number()), // default varies by player count
      // Legacy roguelike fields
      startingShips: v.optional(v.number()),
      livesPerPlayer: v.optional(v.number()),
      multiplayerLossPct: v.optional(v.number()),
    }),
    createdAt: v.number(),
  })
    .index("by_room_code", ["roomCode"])
    .index("by_status", ["status"])
    .index("by_public", ["isPublic", "status"]),

  players: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(), // auth/session ID
    playerName: v.string(),
    factionId: v.optional(v.id("factions")),
    isHost: v.boolean(),
    isReady: v.boolean(),
    turnOrder: v.optional(v.number()), // 0-indexed position in turn order
    joinedAt: v.number(),
    // Legacy roguelike fields
    lives: v.optional(v.number()),
    faction: v.optional(v.string()),
  })
    .index("by_room", ["roomId"])
    .index("by_player_id", ["playerId"])
    .index("by_room_and_player", ["roomId", "playerId"]),

  // ============================================================================
  // GAME STATE
  // ============================================================================

  gameState: defineTable({
    roomId: v.id("rooms"),
    currentRound: v.optional(v.number()), // 1-9 rounds
    currentPhase: v.optional(v.union(
      v.literal("setup"),
      v.literal("action"),
      v.literal("combat"),
      v.literal("upkeep"),
      v.literal("cleanup"),
      v.literal("finished")
    )),
    activePlayerId: v.optional(v.string()), // current player during action phase
    passedPlayers: v.optional(v.array(v.string())), // playerIds who have passed this round

    // Combat tracking
    activeCombats: v.optional(v.array(
      v.object({
        sectorId: v.id("sectors"),
        attackerId: v.string(),
        defenderId: v.string(),
        combatPhase: v.union(
          v.literal("positioning"),
          v.literal("rolling"),
          v.literal("retreat_check"),
          v.literal("resolved")
        ),
      })
    )),

    // Round tracking
    roundStartTime: v.optional(v.number()),
    lastUpdate: v.optional(v.number()),

    // Legacy roguelike fields (temporary for migration)
    combatQueue: v.optional(v.any()),
    currentTurn: v.optional(v.string()),
    gamePhase: v.optional(v.string()),
    playerStates: v.optional(v.any()),
    roundNum: v.optional(v.number()),
    matchResult: v.optional(v.any()),
    roundSeed: v.optional(v.string()),
    acks: v.optional(v.any()),
  }).index("by_room", ["roomId"]),

  // ============================================================================
  // STATIC GAME CONFIGURATION (seeded at game start)
  // ============================================================================

  factions: defineTable({
    name: v.string(), // "Terran", "Hydran", "Planta", etc.
    description: v.string(),

    // Starting resources
    startingMaterials: v.number(),
    startingScience: v.number(),
    startingMoney: v.number(),

    // Capacities
    maxInfluenceDisks: v.number(), // 13-16 depending on faction
    influenceCosts: v.array(v.number()), // [1,2,3...] cost per disk
    maxColonyShips: v.number(),
    maxReputationTiles: v.number(),
    maxAmbassadors: v.number(),

    // Faction-specific mechanics
    actionCount: v.string(), // e.g., "3,4,4" (actions per round at different player counts)
    tradeRatio: v.number(), // base 2:1, some factions have 3:2
    defaultBlueprintIds: v.array(v.string()), // starting ship designs

    // Special abilities (stored as JSON for flexibility)
    specialAbilities: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        effect: v.string(), // JSON string of effect data
      })
    ),
  })
    .index("by_name", ["name"]),

  technologies: defineTable({
    name: v.string(),
    track: v.union(
      v.literal("military"),
      v.literal("grid"),
      v.literal("nano"),
      v.literal("rare"),
      v.literal("propulsion"),
      v.literal("plasma")
    ),
    tier: v.number(), // 1, 2, or 3
    cost: v.number(), // science cost

    // Effects
    effect: v.string(), // description
    effectData: v.optional(v.string()), // JSON for programmatic effects

    // Unlocks
    unlocksParts: v.array(v.id("parts")), // which parts this tech unlocks
    victoryPoints: v.number(), // 0-5 VP

    // Visual
    position: v.object({ x: v.number(), y: v.number() }), // position on tech board
  })
    .index("by_track", ["track"])
    .index("by_track_tier", ["track", "tier"]),

  parts: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("cannon"),
      v.literal("missile"),
      v.literal("shield"),
      v.literal("computer"),
      v.literal("drive"),
      v.literal("hull"),
      v.literal("power_source"),
      v.literal("armor")
    ),

    // Combat stats
    diceType: v.optional(v.union(v.literal("yellow"), v.literal("orange"), v.literal("red"))),
    diceCount: v.number(), // 0 for non-weapons

    // Effects
    energyProduction: v.number(), // for power sources
    energyCost: v.number(), // energy required to use
    initiativeBonus: v.number(),
    hullValue: v.number(), // damage absorption
    driveSpeed: v.number(), // movement range

    // Special effects
    effect: v.optional(v.string()),
    effectData: v.optional(v.string()), // JSON

    // Requirements
    requiresTechnologyIds: v.array(v.id("technologies")),
  })
    .index("by_type", ["type"]),

  dice: defineTable({
    type: v.union(v.literal("yellow"), v.literal("orange"), v.literal("red")),
    sides: v.array(v.number()), // [0,0,0,1,1,2] for yellow, etc.
  }).index("by_type", ["type"]),

  // ============================================================================
  // MAP & SECTORS
  // ============================================================================

  sectors: defineTable({
    roomId: v.id("rooms"),
    position: v.object({
      q: v.number(), // axial hex coordinates
      r: v.number(),
    }),

    type: v.union(
      v.literal("center"),
      v.literal("inner"),
      v.literal("outer"),
      v.literal("starting")
    ),

    // Sector tile properties
    planets: v.array(
      v.object({
        type: v.union(v.literal("materials"), v.literal("science"), v.literal("money")),
        isAdvanced: v.boolean(), // pink vs. brown
      })
    ),

    // Ancient presence (for Rise of the Ancients expansion)
    hasAncient: v.boolean(),
    ancientType: v.optional(v.union(v.literal("cruiser"), v.literal("guardian"))),

    // Wormholes
    warpPortals: v.array(v.number()), // [0-5] sides with warp portals

    // Discovery
    hasDiscoveryTile: v.boolean(),
    discoveryTileId: v.optional(v.id("discoveryTiles")),

    // Ownership
    controlledBy: v.optional(v.string()), // playerId

    // Visual
    rotation: v.number(), // 0-5 (60-degree increments)
  })
    .index("by_room", ["roomId"])
    .index("by_room_position", ["roomId", "position.q", "position.r"])
    .index("by_controller", ["roomId", "controlledBy"]),

  // Sector resources are per-player per-sector
  sectorResources: defineTable({
    roomId: v.id("rooms"),
    sectorId: v.id("sectors"),
    playerId: v.string(),

    // Population cubes placed
    populationCubes: v.object({
      materials: v.number(),
      science: v.number(),
      money: v.number(),
    }),

    // Constructs
    hasMonolith: v.boolean(),
    hasOrbital: v.boolean(),
    hasStarbase: v.boolean(),

    // Control
    influenceDisks: v.number(), // number of influence disks in this sector
  })
    .index("by_room_sector", ["roomId", "sectorId"])
    .index("by_room_player", ["roomId", "playerId"])
    .index("by_room_sector_player", ["roomId", "sectorId", "playerId"]),

  discoveryTiles: defineTable({
    type: v.union(
      v.literal("money"),
      v.literal("science"),
      v.literal("materials"),
      v.literal("reputation"),
      v.literal("technology"),
      v.literal("ship_part"),
      v.literal("colony_ship"),
      v.literal("ancient_tech"),
      v.literal("wormhole_generator")
    ),

    // Immediate effects
    moneyBonus: v.number(),
    scienceBonus: v.number(),
    materialsBonus: v.number(),

    // Special effects
    grantsTechnologyId: v.optional(v.id("technologies")),
    grantsPartId: v.optional(v.id("parts")),

    victoryPoints: v.number(),
    effect: v.optional(v.string()),
    effectData: v.optional(v.string()), // JSON
  }),

  reputationTiles: defineTable({
    victoryPoints: v.number(), // 2, 3, 4, 5
    count: v.number(), // how many of this VP value exist
  }).index("by_vp", ["victoryPoints"]),

  ambassadors: defineTable({
    name: v.string(),
    effect: v.string(),
    effectData: v.optional(v.string()), // JSON
    count: v.number(), // total available
  }),

  // ============================================================================
  // PLAYER STATE
  // ============================================================================

  playerResources: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),

    // Economy
    materials: v.number(),
    science: v.number(),
    money: v.number(),

    // Production tracks (0-7 position on each track)
    materialsTrack: v.number(),
    scienceTrack: v.number(),
    moneyTrack: v.number(),

    // Capacities
    usedInfluenceDisks: v.number(),
    usedColonyShips: v.number(),

    // Victory points
    victoryPoints: v.number(),

    // Status
    hasPassed: v.boolean(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_player", ["roomId", "playerId"]),

  playerTechnologies: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    technologyId: v.id("technologies"),
    acquiredInRound: v.number(),
  })
    .index("by_room_player", ["roomId", "playerId"])
    .index("by_room_tech", ["roomId", "technologyId"]),

  playerReputationTiles: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    reputationTileId: v.id("reputationTiles"),
    acquiredInRound: v.number(),
  })
    .index("by_room_player", ["roomId", "playerId"]),

  playerAmbassadors: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    ambassadorId: v.id("ambassadors"),
    acquiredInRound: v.number(),
  })
    .index("by_room_player", ["roomId", "playerId"]),

  playerDiscoveryTiles: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    discoveryTileId: v.id("discoveryTiles"),

    // Discovery tiles can be kept or immediately used
    isKept: v.boolean(),
    isUsed: v.boolean(),
    acquiredInRound: v.number(),
  })
    .index("by_room_player", ["roomId", "playerId"])
    .index("by_room_player_kept", ["roomId", "playerId", "isKept"]),

  // ============================================================================
  // SHIPS & BLUEPRINTS
  // ============================================================================

  blueprints: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),

    shipType: v.union(
      v.literal("interceptor"),
      v.literal("cruiser"),
      v.literal("dreadnought"),
      v.literal("starbase")
    ),

    // Ship stats
    name: v.string(), // custom name

    // Parts equipped (by slot)
    parts: v.object({
      hull: v.id("parts"),
      powerSource: v.id("parts"),
      drives: v.array(v.id("parts")), // 0-3 depending on ship type
      computers: v.array(v.id("parts")), // 0-2
      shields: v.array(v.id("parts")), // 0-3
      weapons: v.array(v.id("parts")), // 0-4 (cannons + missiles)
    }),

    // Derived stats (cached for performance)
    totalEnergy: v.number(),
    energyUsed: v.number(),
    initiative: v.number(),
    hull: v.number(),
    movement: v.number(),

    // Build cost
    materialCost: v.number(),

    // Validation
    isValid: v.boolean(),
    isPinned: v.boolean(), // whether this is an active design
  })
    .index("by_room_player", ["roomId", "playerId"])
    .index("by_room_player_type", ["roomId", "playerId", "shipType"])
    .index("by_room_player_pinned", ["roomId", "playerId", "isPinned"]),

  ships: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    blueprintId: v.id("blueprints"),

    // Location
    sectorId: v.id("sectors"),

    // Ship state
    isDestroyed: v.boolean(),
    damage: v.number(), // current damage taken

    // Combat state
    hasRetreated: v.boolean(),
    usedThisRound: v.optional(v.boolean()), // for movement tracking
  })
    .index("by_room", ["roomId"])
    .index("by_room_player", ["roomId", "playerId"])
    .index("by_room_sector", ["roomId", "sectorId"])
    .index("by_blueprint", ["blueprintId"]),

  // ============================================================================
  // COMBAT & ACTIONS
  // ============================================================================

  combatLog: defineTable({
    roomId: v.id("rooms"),
    sectorId: v.id("sectors"),
    round: v.number(),

    attackerId: v.string(),
    defenderId: v.string(),

    // Combat events
    events: v.array(
      v.object({
        type: v.union(
          v.literal("initiative"),
          v.literal("attack"),
          v.literal("damage"),
          v.literal("retreat"),
          v.literal("destroyed")
        ),
        playerId: v.string(),
        shipId: v.optional(v.id("ships")),
        data: v.string(), // JSON event data
        timestamp: v.number(),
      })
    ),

    winner: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_room_round", ["roomId", "round"])
    .index("by_room_sector", ["roomId", "sectorId"]),

  actionLog: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    round: v.number(),
    actionNumber: v.number(), // which action in the round (1, 2, 3, etc.)

    actionType: v.union(
      v.literal("explore"),
      v.literal("influence"),
      v.literal("research"),
      v.literal("upgrade"),
      v.literal("build"),
      v.literal("move"),
      v.literal("pass")
    ),

    // Action-specific data
    targetSectorId: v.optional(v.id("sectors")),
    technologyId: v.optional(v.id("technologies")),
    blueprintId: v.optional(v.id("blueprints")),

    // Resource changes
    materialsDelta: v.number(),
    scienceDelta: v.number(),
    moneyDelta: v.number(),

    timestamp: v.number(),
  })
    .index("by_room_round", ["roomId", "round"])
    .index("by_room_player", ["roomId", "playerId"])
    .index("by_room_player_round", ["roomId", "playerId", "round"]),

  // ============================================================================
  // ARCHIVES & GAME HISTORY
  // ============================================================================

  gameResults: defineTable({
    roomId: v.id("rooms"),

    // Final standings
    rankings: v.array(
      v.object({
        playerId: v.string(),
        playerName: v.string(),
        factionName: v.string(),
        victoryPoints: v.number(),
        rank: v.number(),
      })
    ),

    // Game metadata
    totalRounds: v.number(),
    duration: v.number(), // milliseconds
    finishedAt: v.number(),
  }).index("by_room", ["roomId"]),
});
