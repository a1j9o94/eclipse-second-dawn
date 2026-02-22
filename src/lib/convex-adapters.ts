/**
 * Adapters to convert between Convex schema and frontend types
 */

import type { EclipseSector, PopulationSquare, WormholeEdge } from '../types/eclipse-sectors';
import type { Doc } from '../../convex/_generated/dataModel';

/**
 * Convert Convex sector to EclipseSector type
 */
export function convexSectorToEclipse(
  sector: Doc<"sectors"> & {
    shipsCount?: number;
    shipsByPlayer?: Record<string, number>;
    influenceDisksPlaced?: number;
    resources?: Doc<"sectorResources">[];
  }
): EclipseSector {
  // Convert planets to population squares
  const populationSquares: PopulationSquare[] = sector.planets.map(planet => ({
    type: planet.type === 'materials' ? 'materials' :
          planet.type === 'science' ? 'science' :
          planet.type === 'money' ? 'money' : 'gray',
    advanced: planet.isAdvanced,
    resources: planet.isAdvanced ? 2 : 1, // Advanced planets worth 2
  }));

  // Convert warpPortals to wormholes
  const wormholes: WormholeEdge[] = sector.warpPortals.map(direction => ({
    direction: direction as 0 | 1 | 2 | 3 | 4 | 5,
    type: 'normal' as const,
  }));

  // Determine sector ring based on type
  const ring = sector.type as EclipseSector['ring'];

  // Generate sector ID from position (for display)
  const sectorId = generateSectorId(sector.position.q, sector.position.r, sector.type);

  // Convert ships by player to ships array
  const ships = sector.shipsByPlayer
    ? Object.entries(sector.shipsByPlayer).map(([playerId, count]) => ({
        playerId,
        count,
        pinned: false, // TODO: Get from ship.usedThisRound
      }))
    : [];

  // Convert ancients
  const ancients = sector.hasAncient
    ? [{
        count: 1,
        type: (sector.ancientType || 'interceptor') as 'interceptor' | 'cruiser' | 'dreadnought' | 'starbase',
      }]
    : [];

  // Discovery tile
  const discoveryTile = sector.hasDiscoveryTile
    ? {
        id: (sector.discoveryTileId as string) || 'unknown',
        revealed: false,
        ancientCount: sector.hasAncient ? 1 : 0,
      }
    : undefined;

  return {
    id: sectorId,
    ring,
    explored: true, // If it exists in DB, it's explored
    orientation: sector.rotation as 0 | 1 | 2 | 3 | 4 | 5,
    coordinates: {
      q: sector.position.q,
      r: sector.position.r,
      s: -(sector.position.q + sector.position.r), // Cube coordinate constraint
    },
    populationSquares,
    wormholes,
    discoveryTile,
    controlledBy: sector.controlledBy,
    influenceDisk: sector.influenceDisksPlaced && sector.influenceDisksPlaced > 0
      ? sector.controlledBy
      : undefined,
    ships,
    ancients,
  };
}

/**
 * Convert array of Convex sectors to Eclipse sectors
 */
export function convexSectorsToEclipse(
  sectors: Array<Doc<"sectors"> & {
    shipsCount?: number;
    shipsByPlayer?: Record<string, number>;
    influenceDisksPlaced?: number;
    resources?: Doc<"sectorResources">[];
  }>
): EclipseSector[] {
  return sectors.map(convexSectorToEclipse);
}

/**
 * Generate sector ID from position and type
 *
 * Format matches Eclipse board game numbering:
 * - Center: 001
 * - Inner: 101-110
 * - Outer: 301-318
 * - Starting: 221-232
 */
function generateSectorId(q: number, r: number, type: string): string {
  // Use position hash for unique IDs
  const hash = ((q + 10) * 100) + (r + 10);

  switch (type) {
    case 'center':
      return '001';
    case 'inner':
      return `1${String(hash).slice(-2)}`;
    case 'outer':
      return `3${String(hash).slice(-2)}`;
    case 'starting':
      return `2${String(hash).slice(-2)}`;
    default:
      return String(hash);
  }
}

/**
 * Convert EclipseSector back to Convex format (for mutations)
 */
export function eclipseSectorToConvex(
  sector: EclipseSector
): Partial<Doc<"sectors">> {
  return {
    position: {
      q: sector.coordinates?.q || 0,
      r: sector.coordinates?.r || 0,
    },
    type: sector.ring === 'center' ? 'center' :
          sector.ring === 'inner' ? 'inner' :
          sector.ring === 'outer' ? 'outer' :
          sector.ring === 'starting' ? 'starting' : 'center',
    planets: sector.populationSquares.map(pop => ({
      type: pop.type === 'materials' ? 'materials' as const :
            pop.type === 'science' ? 'science' as const :
            pop.type === 'money' ? 'money' as const : 'materials' as const,
      isAdvanced: pop.advanced,
    })),
    warpPortals: sector.wormholes.map(wh => wh.direction),
    hasAncient: sector.ancients.length > 0,
    ancientType: sector.ancients.length > 0
      ? (sector.ancients[0].type === 'cruiser' ? 'cruiser' as const : 'guardian' as const)
      : undefined,
    hasDiscoveryTile: !!sector.discoveryTile,
    discoveryTileId: sector.discoveryTile?.id as any,
    controlledBy: sector.controlledBy,
    rotation: sector.orientation,
  };
}
