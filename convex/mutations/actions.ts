// Action mutations for Eclipse board game
// Handles all 6 player actions: Explore, Influence, Research, Upgrade, Build, Move

import { mutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { logInfo, roomTag } from "../helpers/log";
import {
  canAfford,
  spendResources,
  placeInfluenceOnAction,
  placeInfluenceOnSector,
  type Cost,
} from "../engine/resources";
import {
  dbToPlayerEconomy,
  playerEconomyToDbUpdates,
  hasAvailableInfluence,
  DEFAULT_FACTION_ECONOMY,
  type PlayerResourcesDB,
  type FactionEconomyData,
} from "../helpers/economy";

/**
 * Helper to validate player's turn
 */
async function validatePlayerTurn(
  ctx: MutationCtx,
  roomId: string,
  playerId: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ valid: boolean; reason?: string; gameState?: any; resources?: any }> {
  const gameState = await ctx.db
    .query("gameState")
    .withIndex("by_room", (q) => q.eq("roomId", roomId as any))
    .first();

  if (!gameState) {
    return { valid: false, reason: "Game state not found" };
  }

  if (gameState.currentPhase !== 'action') {
    return { valid: false, reason: `Cannot take actions during ${gameState.currentPhase} phase` };
  }

  if (gameState.activePlayerId !== playerId) {
    return { valid: false, reason: "Not your turn" };
  }

  const resources = await ctx.db
    .query("playerResources")
    .withIndex("by_room_player", (q) =>
      q.eq("roomId", roomId as any).eq("playerId", playerId)
    )
    .first();

  if (!resources) {
    return { valid: false, reason: "Player resources not found" };
  }

  if (resources.hasPassed) {
    return { valid: false, reason: "Player has already passed" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { valid: true, gameState, resources } as any;
}

/**
 * Helper to advance turn to next player
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function advanceTurn(ctx: MutationCtx, roomId: string, gameState: any) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", roomId as any))
    .collect();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedPlayers = players.sort((a: any, b: any) => {
    if (a.turnOrder !== undefined && b.turnOrder !== undefined) {
      return a.turnOrder - b.turnOrder;
    }
    return a.joinedAt - b.joinedAt;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerIds = sortedPlayers.map((p: any) => p.playerId);
  const currentIndex = playerIds.indexOf(gameState.activePlayerId || playerIds[0]);
  const passedPlayers = gameState.passedPlayers || [];

  // Find next player who hasn't passed
  let nextIndex = currentIndex;
  let attempts = 0;

  do {
    nextIndex = (nextIndex + 1) % playerIds.length;
    attempts++;
  } while (
    passedPlayers.includes(playerIds[nextIndex]) &&
    attempts < playerIds.length
  );

  await ctx.db.patch(gameState._id, {
    activePlayerId: playerIds[nextIndex],
    lastUpdate: Date.now(),
  });

  return playerIds[nextIndex];
}

/**
 * Explore action - draw and place a new sector tile
 */
export const explore = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    position: v.object({
      q: v.number(),
      r: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Validate turn
    const validation = await validatePlayerTurn(ctx, args.roomId as unknown as string, args.playerId);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const { gameState, resources } = validation;

    // Get player's faction for economy data
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    let factionData: FactionEconomyData = DEFAULT_FACTION_ECONOMY;
    if (player?.factionId) {
      const faction = await ctx.db.get(player.factionId);
      if (faction) {
        factionData = {
          maxInfluenceDisks: faction.maxInfluenceDisks,
          maxColonyShips: faction.maxColonyShips,
          tradeRatio: faction.tradeRatio,
        };
      }
    }

    // Count influence disks on sectors
    const sectorResources = await ctx.db
      .query("sectorResources")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();
    const influenceOnSectors = sectorResources.reduce((sum, sr) => sum + sr.influenceDisks, 0);

    // Convert to PlayerEconomy
    const economy = dbToPlayerEconomy(
      resources as unknown as PlayerResourcesDB,
      factionData,
      influenceOnSectors
    );

    // Validate influence availability using Resources engine
    if (!hasAvailableInfluence(economy)) {
      throw new Error("No influence disks available");
    }

    // Use influence for action (placing on sector happens via placeInfluenceOnSector)
    let updatedEconomy = placeInfluenceOnAction(economy);

    // Check if sector already exists at this position
    const existingSector = await ctx.db
      .query("sectors")
      .withIndex("by_room_position", (q) =>
        q.eq("roomId", args.roomId)
         .eq("position.q", args.position.q)
         .eq("position.r", args.position.r)
      )
      .first();

    if (existingSector) {
      throw new Error("Sector already exists at this position");
    }

    // TODO: Draw random sector tile from deck
    // For now, create a basic sector
    const sectorId = await ctx.db.insert("sectors", {
      roomId: args.roomId,
      position: args.position,
      type: "outer",
      planets: [
        { type: "materials", isAdvanced: false },
        { type: "science", isAdvanced: false },
      ],
      hasAncient: false,
      warpPortals: [],
      hasDiscoveryTile: Math.random() > 0.5,
      controlledBy: args.playerId,
      rotation: 0,
    });

    // Place influence disk in the sector (1 for action, 1 for sector control)
    await ctx.db.insert("sectorResources", {
      roomId: args.roomId,
      sectorId,
      playerId: args.playerId,
      populationCubes: { materials: 0, science: 0, money: 0 },
      hasMonolith: false,
      hasOrbital: false,
      hasStarbase: false,
      influenceDisks: 1,
    });

    // Use another influence disk for sector control
    updatedEconomy = placeInfluenceOnSector(updatedEconomy);

    // Update database with new economy state
    await ctx.db.patch(resources._id, playerEconomyToDbUpdates(updatedEconomy));

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
      actionType: "explore",
      targetSectorId: sectorId,
      materialsDelta: 0,
      scienceDelta: 0,
      moneyDelta: 0,
      timestamp: Date.now(),
    });

    // Advance to next player
    const nextPlayer = await advanceTurn(ctx, args.roomId as unknown as string, gameState);

    logInfo('action', 'explore completed', {
      tag: roomTag(args.roomId as unknown as string),
      playerId: args.playerId,
      position: args.position,
      nextPlayer,
    });

    return { success: true, sectorId, nextPlayer };
  },
});

/**
 * Influence action - manage influence disks and refresh colony ships
 */
export const influence = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    retrieveFrom: v.optional(v.array(v.id("sectors"))), // sectors to retrieve influence from
    placeTo: v.optional(v.array(v.id("sectors"))),      // sectors to place influence in
  },
  handler: async (ctx, args) => {
    // Validate turn
    const validation = await validatePlayerTurn(ctx, args.roomId as unknown as string, args.playerId);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const { gameState, resources } = validation;

    // Get player's faction for economy data
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    let factionData: FactionEconomyData = DEFAULT_FACTION_ECONOMY;
    if (player?.factionId) {
      const faction = await ctx.db.get(player.factionId);
      if (faction) {
        factionData = {
          maxInfluenceDisks: faction.maxInfluenceDisks,
          maxColonyShips: faction.maxColonyShips,
          tradeRatio: faction.tradeRatio,
        };
      }
    }

    // Count influence disks on sectors
    const sectorResources = await ctx.db
      .query("sectorResources")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();
    const influenceOnSectors = sectorResources.reduce((sum, sr) => sum + sr.influenceDisks, 0);

    // Convert to PlayerEconomy
    const economy = dbToPlayerEconomy(
      resources as unknown as PlayerResourcesDB,
      factionData,
      influenceOnSectors
    );

    // Validate influence availability using Resources engine
    if (!hasAvailableInfluence(economy)) {
      throw new Error("No influence disks available");
    }

    // Use influence for this action
    const updatedEconomy = placeInfluenceOnAction(economy);

    // Retrieve influence disks from sectors (up to 2)
    const retrieveFrom = args.retrieveFrom || [];
    let retrieved = 0;

    for (const sectorId of retrieveFrom.slice(0, 2)) {
      const sectorResource = await ctx.db
        .query("sectorResources")
        .withIndex("by_room_sector_player", (q) =>
          q.eq("roomId", args.roomId)
           .eq("sectorId", sectorId)
           .eq("playerId", args.playerId)
        )
        .first();

      if (sectorResource && sectorResource.influenceDisks > 0) {
        await ctx.db.patch(sectorResource._id, {
          influenceDisks: sectorResource.influenceDisks - 1,
        });
        retrieved++;
      }
    }

    // Place influence disks in sectors (up to 2)
    const placeTo = args.placeTo || [];
    let placed = 0;

    for (const sectorId of placeTo.slice(0, 2)) {
      const sectorResource = await ctx.db
        .query("sectorResources")
        .withIndex("by_room_sector_player", (q) =>
          q.eq("roomId", args.roomId)
           .eq("sectorId", sectorId)
           .eq("playerId", args.playerId)
        )
        .first();

      if (sectorResource) {
        await ctx.db.patch(sectorResource._id, {
          influenceDisks: sectorResource.influenceDisks + 1,
        });
      } else {
        // Create sector resource entry if it doesn't exist
        await ctx.db.insert("sectorResources", {
          roomId: args.roomId,
          sectorId,
          playerId: args.playerId,
          populationCubes: { materials: 0, science: 0, money: 0 },
          hasMonolith: false,
          hasOrbital: false,
          hasStarbase: false,
          influenceDisks: 1,
        });
      }
      placed++;
    }

    // Refresh colony ships (reset used count)
    const refreshCount = Math.min(2, resources.usedColonyShips);

    // Update database with new economy state
    await ctx.db.patch(resources._id, {
      ...playerEconomyToDbUpdates(updatedEconomy),
      usedColonyShips: resources.usedColonyShips - refreshCount,
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
      actionType: "influence",
      materialsDelta: 0,
      scienceDelta: 0,
      moneyDelta: 0,
      timestamp: Date.now(),
    });

    // Advance to next player
    const nextPlayer = await advanceTurn(ctx, args.roomId as unknown as string, gameState);

    logInfo('action', 'influence completed', {
      tag: roomTag(args.roomId as unknown as string),
      playerId: args.playerId,
      retrieved,
      placed,
      refreshedShips: refreshCount,
      nextPlayer,
    });

    return { success: true, retrieved, placed, refreshedShips: refreshCount, nextPlayer };
  },
});

/**
 * Research action - purchase a technology
 */
export const research = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    technologyId: v.id("technologies"),
  },
  handler: async (ctx, args) => {
    // Validate turn
    const validation = await validatePlayerTurn(ctx, args.roomId as unknown as string, args.playerId);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const { gameState, resources } = validation;

    // Get technology
    const technology = await ctx.db.get(args.technologyId);
    if (!technology) {
      throw new Error("Technology not found");
    }

    // Check if already researched
    const existing = await ctx.db
      .query("playerTechnologies")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();

    if (existing.some(t => t.technologyId === args.technologyId)) {
      throw new Error("Technology already researched");
    }

    // Get player's faction for economy data
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    let factionData: FactionEconomyData = DEFAULT_FACTION_ECONOMY;
    if (player?.factionId) {
      const faction = await ctx.db.get(player.factionId);
      if (faction) {
        factionData = {
          maxInfluenceDisks: faction.maxInfluenceDisks,
          maxColonyShips: faction.maxColonyShips,
          tradeRatio: faction.tradeRatio,
        };
      }
    }

    // Count influence disks on sectors
    const sectorResources = await ctx.db
      .query("sectorResources")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();
    const influenceOnSectors = sectorResources.reduce((sum, sr) => sum + sr.influenceDisks, 0);

    // Convert to PlayerEconomy
    const economy = dbToPlayerEconomy(
      resources as unknown as PlayerResourcesDB,
      factionData,
      influenceOnSectors
    );

    // Validate resources using Resources engine
    const cost: Cost = { science: technology.cost };
    if (!canAfford(economy, cost)) {
      throw new Error(`Not enough science (need ${technology.cost}, have ${economy.resources.science})`);
    }

    if (!hasAvailableInfluence(economy)) {
      throw new Error("No influence disks available");
    }

    // Execute research action with Resources engine
    let updatedEconomy = spendResources(economy, cost);
    updatedEconomy = placeInfluenceOnAction(updatedEconomy);

    // Update database with new economy state
    await ctx.db.patch(resources._id, {
      ...playerEconomyToDbUpdates(updatedEconomy),
      victoryPoints: resources.victoryPoints + technology.victoryPoints,
    });

    // Add technology to player
    await ctx.db.insert("playerTechnologies", {
      roomId: args.roomId,
      playerId: args.playerId,
      technologyId: args.technologyId,
      acquiredInRound: gameState.currentRound,
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
      actionType: "research",
      technologyId: args.technologyId,
      materialsDelta: 0,
      scienceDelta: -technology.cost,
      moneyDelta: 0,
      timestamp: Date.now(),
    });

    // Advance to next player
    const nextPlayer = await advanceTurn(ctx, args.roomId as unknown as string, gameState);

    logInfo('action', 'research completed', {
      tag: roomTag(args.roomId as unknown as string),
      playerId: args.playerId,
      technologyId: args.technologyId,
      cost: technology.cost,
      nextPlayer,
    });

    return { success: true, technology: technology.name, nextPlayer };
  },
});

/**
 * Build action - construct a ship or structure
 */
export const build = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    blueprintId: v.id("blueprints"),
    sectorId: v.id("sectors"),
  },
  handler: async (ctx, args) => {
    // Validate turn
    const validation = await validatePlayerTurn(ctx, args.roomId as unknown as string, args.playerId);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const { gameState, resources } = validation;

    // Get blueprint
    const blueprint = await ctx.db.get(args.blueprintId);
    if (!blueprint) {
      throw new Error("Blueprint not found");
    }

    if (blueprint.playerId !== args.playerId) {
      throw new Error("Blueprint does not belong to player");
    }

    if (!blueprint.isValid) {
      throw new Error("Blueprint is not valid");
    }

    // Get player's faction for economy data
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    let factionData: FactionEconomyData = DEFAULT_FACTION_ECONOMY;
    if (player?.factionId) {
      const faction = await ctx.db.get(player.factionId);
      if (faction) {
        factionData = {
          maxInfluenceDisks: faction.maxInfluenceDisks,
          maxColonyShips: faction.maxColonyShips,
          tradeRatio: faction.tradeRatio,
        };
      }
    }

    // Count influence disks on sectors
    const sectorResources = await ctx.db
      .query("sectorResources")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();
    const influenceOnSectors = sectorResources.reduce((sum, sr) => sum + sr.influenceDisks, 0);

    // Convert to PlayerEconomy
    const economy = dbToPlayerEconomy(
      resources as unknown as PlayerResourcesDB,
      factionData,
      influenceOnSectors
    );

    // Calculate costs
    const materialCost = blueprint.materialCost;
    const moneyCost = 0; // TODO: Calculate based on ship type

    // Validate resources using Resources engine
    const cost: Cost = { materials: materialCost, money: moneyCost };
    if (!canAfford(economy, cost)) {
      throw new Error(`Not enough resources (need ${materialCost} materials, ${moneyCost} money)`);
    }

    if (!hasAvailableInfluence(economy)) {
      throw new Error("No influence disks available");
    }

    // Execute build action with Resources engine
    let updatedEconomy = spendResources(economy, cost);
    updatedEconomy = placeInfluenceOnAction(updatedEconomy);

    // Update database with new economy state
    await ctx.db.patch(resources._id, playerEconomyToDbUpdates(updatedEconomy));

    // Create ship
    const shipId = await ctx.db.insert("ships", {
      roomId: args.roomId,
      playerId: args.playerId,
      blueprintId: args.blueprintId,
      sectorId: args.sectorId,
      isDestroyed: false,
      damage: 0,
      hasRetreated: false,
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
      actionType: "build",
      blueprintId: args.blueprintId,
      targetSectorId: args.sectorId,
      materialsDelta: -materialCost,
      scienceDelta: 0,
      moneyDelta: -moneyCost,
      timestamp: Date.now(),
    });

    // Advance to next player
    const nextPlayer = await advanceTurn(ctx, args.roomId as unknown as string, gameState);

    logInfo('action', 'build completed', {
      tag: roomTag(args.roomId as unknown as string),
      playerId: args.playerId,
      shipType: blueprint.shipType,
      shipId,
      nextPlayer,
    });

    return { success: true, shipId, nextPlayer };
  },
});

/**
 * Upgrade action - modify a blueprint
 */
export const upgrade = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    blueprintId: v.id("blueprints"),
    removeParts: v.array(v.id("parts")),
    addParts: v.array(v.id("parts")),
  },
  handler: async (ctx, args) => {
    // Validate turn
    const validation = await validatePlayerTurn(ctx, args.roomId as unknown as string, args.playerId);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const { gameState, resources } = validation;

    // Get blueprint
    const blueprint = await ctx.db.get(args.blueprintId);
    if (!blueprint) {
      throw new Error("Blueprint not found");
    }

    if (blueprint.playerId !== args.playerId) {
      throw new Error("Blueprint does not belong to player");
    }

    // Get player's faction for economy data
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    let factionData: FactionEconomyData = DEFAULT_FACTION_ECONOMY;
    if (player?.factionId) {
      const faction = await ctx.db.get(player.factionId);
      if (faction) {
        factionData = {
          maxInfluenceDisks: faction.maxInfluenceDisks,
          maxColonyShips: faction.maxColonyShips,
          tradeRatio: faction.tradeRatio,
        };
      }
    }

    // Count influence disks on sectors
    const sectorResources = await ctx.db
      .query("sectorResources")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();
    const influenceOnSectors = sectorResources.reduce((sum, sr) => sum + sr.influenceDisks, 0);

    // Convert to PlayerEconomy
    const economy = dbToPlayerEconomy(
      resources as unknown as PlayerResourcesDB,
      factionData,
      influenceOnSectors
    );

    // Calculate material cost (1 per part removed, 0 for swaps)
    const materialCost = Math.max(0, args.removeParts.length - args.addParts.length);

    // Validate resources using Resources engine
    const cost: Cost = { materials: materialCost };
    if (!canAfford(economy, cost)) {
      throw new Error(`Not enough materials (need ${materialCost}, have ${economy.resources.materials})`);
    }

    if (!hasAvailableInfluence(economy)) {
      throw new Error("No influence disks available");
    }

    // Execute upgrade action with Resources engine
    let updatedEconomy = spendResources(economy, cost);
    updatedEconomy = placeInfluenceOnAction(updatedEconomy);

    // Update database with new economy state
    // TODO: Actually update blueprint parts
    await ctx.db.patch(resources._id, playerEconomyToDbUpdates(updatedEconomy));

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
      actionType: "upgrade",
      blueprintId: args.blueprintId,
      materialsDelta: -materialCost,
      scienceDelta: 0,
      moneyDelta: 0,
      timestamp: Date.now(),
    });

    // Advance to next player
    const nextPlayer = await advanceTurn(ctx, args.roomId as unknown as string, gameState);

    logInfo('action', 'upgrade completed', {
      tag: roomTag(args.roomId as unknown as string),
      playerId: args.playerId,
      blueprintId: args.blueprintId,
      removed: args.removeParts.length,
      added: args.addParts.length,
      nextPlayer,
    });

    return { success: true, nextPlayer };
  },
});

/**
 * Move action - move a ship to an adjacent sector
 */
export const move = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    shipId: v.id("ships"),
    toSectorId: v.id("sectors"),
  },
  handler: async (ctx, args) => {
    // Validate turn
    const validation = await validatePlayerTurn(ctx, args.roomId as unknown as string, args.playerId);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const { gameState, resources } = validation;

    // Get ship
    const ship = await ctx.db.get(args.shipId);
    if (!ship) {
      throw new Error("Ship not found");
    }

    if (ship.playerId !== args.playerId) {
      throw new Error("Ship does not belong to player");
    }

    if (ship.isDestroyed) {
      throw new Error("Ship is destroyed");
    }

    if (ship.usedThisRound) {
      throw new Error("Ship has already moved this round");
    }

    // Get current and target sectors
    const fromSector = await ctx.db.get(ship.sectorId);
    const toSector = await ctx.db.get(args.toSectorId);

    if (!fromSector || !toSector) {
      throw new Error("Sector not found");
    }

    // Get player's faction for economy data
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    let factionData: FactionEconomyData = DEFAULT_FACTION_ECONOMY;
    if (player?.factionId) {
      const faction = await ctx.db.get(player.factionId);
      if (faction) {
        factionData = {
          maxInfluenceDisks: faction.maxInfluenceDisks,
          maxColonyShips: faction.maxColonyShips,
          tradeRatio: faction.tradeRatio,
        };
      }
    }

    // Count influence disks on sectors
    const sectorResources = await ctx.db
      .query("sectorResources")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .collect();
    const influenceOnSectors = sectorResources.reduce((sum, sr) => sum + sr.influenceDisks, 0);

    // Convert to PlayerEconomy
    const economy = dbToPlayerEconomy(
      resources as unknown as PlayerResourcesDB,
      factionData,
      influenceOnSectors
    );

    // Validate influence availability using Resources engine
    if (!hasAvailableInfluence(economy)) {
      throw new Error("No influence disks available");
    }

    // TODO: Validate adjacency
    // For now, allow any move

    // Use influence for this action
    const updatedEconomy = placeInfluenceOnAction(economy);

    // Update ship location
    await ctx.db.patch(ship._id, {
      sectorId: args.toSectorId,
      usedThisRound: true,
    });

    // Update database with new economy state
    await ctx.db.patch(resources._id, playerEconomyToDbUpdates(updatedEconomy));

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
      actionType: "move",
      targetSectorId: args.toSectorId,
      materialsDelta: 0,
      scienceDelta: 0,
      moneyDelta: 0,
      timestamp: Date.now(),
    });

    // Advance to next player
    const nextPlayer = await advanceTurn(ctx, args.roomId as unknown as string, gameState);

    logInfo('action', 'move completed', {
      tag: roomTag(args.roomId as unknown as string),
      playerId: args.playerId,
      shipId: args.shipId,
      from: fromSector.position,
      to: toSector.position,
      nextPlayer,
    });

    return { success: true, nextPlayer };
  },
});

export default {
  explore,
  influence,
  research,
  build,
  upgrade,
  move,
};
