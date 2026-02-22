import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get all sectors for a room's galaxy map
 */
export const getSectors = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const sectors = await ctx.db
      .query("sectors")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    return sectors;
  },
});

/**
 * Get a single sector by position
 */
export const getSectorByPosition = query({
  args: {
    roomId: v.id("rooms"),
    q: v.number(),
    r: v.number(),
  },
  handler: async (ctx, args) => {
    const sector = await ctx.db
      .query("sectors")
      .withIndex("by_room_position", (q) =>
        q.eq("roomId", args.roomId).eq("position.q", args.q).eq("position.r", args.r)
      )
      .unique();

    return sector;
  },
});

/**
 * Get all ships in a sector
 */
export const getShipsInSector = query({
  args: {
    roomId: v.id("rooms"),
    sectorId: v.id("sectors"),
  },
  handler: async (ctx, args) => {
    const ships = await ctx.db
      .query("ships")
      .withIndex("by_room_sector", (q) =>
        q.eq("roomId", args.roomId).eq("sectorId", args.sectorId)
      )
      .collect();

    // Group ships by player
    const shipsByPlayer = ships.reduce((acc, ship) => {
      if (!acc[ship.playerId]) {
        acc[ship.playerId] = [];
      }
      acc[ship.playerId].push(ship);
      return acc;
    }, {} as Record<string, typeof ships>);

    return shipsByPlayer;
  },
});

/**
 * Get sector resources (population cubes, constructs) for a sector
 */
export const getSectorResources = query({
  args: {
    roomId: v.id("rooms"),
    sectorId: v.id("sectors"),
  },
  handler: async (ctx, args) => {
    const resources = await ctx.db
      .query("sectorResources")
      .withIndex("by_room_sector", (q) =>
        q.eq("roomId", args.roomId).eq("sectorId", args.sectorId)
      )
      .collect();

    return resources;
  },
});

/**
 * Get complete galaxy state (sectors + ships + resources)
 */
export const getGalaxyState = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    // Get all sectors
    const sectors = await ctx.db
      .query("sectors")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Get all ships in this room
    const allShips = await ctx.db
      .query("ships")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Get all sector resources
    const allResources = await ctx.db
      .query("sectorResources")
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .collect();

    // Build comprehensive galaxy state
    const galaxyState = sectors.map((sector) => {
      // Ships in this sector
      const shipsInSector = allShips.filter((s) => s.sectorId === sector._id);

      // Resources in this sector (by player)
      const resourcesInSector = allResources.filter((r) => r.sectorId === sector._id);

      // Group ships by player
      const shipsByPlayer: Record<string, number> = {};
      shipsInSector.forEach((ship) => {
        shipsByPlayer[ship.playerId] = (shipsByPlayer[ship.playerId] || 0) + 1;
      });

      // Calculate total influence disks
      const totalInfluenceDisks = resourcesInSector.reduce(
        (sum, r) => sum + r.influenceDisks,
        0
      );

      return {
        ...sector,
        shipsCount: shipsInSector.length,
        shipsByPlayer,
        influenceDisksPlaced: totalInfluenceDisks,
        resources: resourcesInSector,
      };
    });

    return galaxyState;
  },
});

/**
 * Get discovery tile details
 */
export const getDiscoveryTile = query({
  args: { discoveryTileId: v.id("discoveryTiles") },
  handler: async (ctx, args) => {
    const tile = await ctx.db.get(args.discoveryTileId);
    return tile;
  },
});
