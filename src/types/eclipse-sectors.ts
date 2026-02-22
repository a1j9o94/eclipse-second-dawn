/**
 * Eclipse: Second Dawn for the Galaxy - Sector Type Definitions
 *
 * Based on the official Eclipse board game rules
 */

export type SectorRing = 'center' | 'inner' | 'middle' | 'outer' | 'starting' | 'guardian';

export type PopulationType = 'gray' | 'money' | 'science' | 'materials';

export interface PopulationSquare {
  type: PopulationType;
  advanced: boolean; // Requires advanced tech (has star symbol)
  resources: number; // Resource production value
}

export interface WormholeEdge {
  direction: 0 | 1 | 2 | 3 | 4 | 5; // 0=top, clockwise
  type: 'normal' | 'special'; // Special for wormhole generator tech
}

export interface DiscoveryTile {
  id: string;
  revealed: boolean;
  type?: 'artifact' | 'reputation' | 'credits' | 'science' | 'materials';
  value?: number;
  ancientCount: number; // Number of ancient ships guarding this discovery
}

export interface EclipseSector {
  // Identification
  id: string; // e.g., "101", "201", "301", "001", "221", "271"
  ring: SectorRing;

  // Tile state
  explored: boolean; // Face-up (explored) or face-down (in stack)
  orientation: 0 | 1 | 2 | 3 | 4 | 5; // Rotation when placed (0 = no rotation)

  // Position (for placed sectors)
  coordinates?: {
    q: number;
    r: number;
    s: number;
  };

  // Sector contents
  populationSquares: PopulationSquare[];
  wormholes: WormholeEdge[];
  discoveryTile?: DiscoveryTile;

  // Control
  controlledBy?: string; // playerId
  influenceDisk?: string; // playerId who placed influence

  // Ships present
  ships: {
    playerId: string;
    count: number;
    pinned: boolean; // Pinned ships can't move
  }[];

  // Ancients (NPCs)
  ancients: {
    count: number;
    type: 'interceptor' | 'cruiser' | 'dreadnought' | 'starbase';
  }[];
}

/**
 * Sector numbering system from Eclipse:
 * - Center: 001
 * - Inner: 101-110
 * - Middle: 201-211, 214, 281
 * - Outer: 301-318, 381-382
 * - Starting: 221-232
 * - Guardian: 271-274
 */
export const SECTOR_NUMBERS = {
  center: ['001'],
  inner: ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110'],
  middle: ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '214', '281'],
  outer: [
    '301', '302', '303', '304', '305', '306', '307', '308', '309', '310',
    '311', '312', '313', '314', '315', '316', '317', '318', '381', '382'
  ],
  starting: ['221', '222', '223', '224', '225', '226', '227', '228', '229', '230', '231', '232'],
  guardian: ['271', '272', '273', '274']
} as const;

/**
 * Starting sector assignments by player count and faction
 */
export const STARTING_SECTORS_BY_PLAYER_COUNT: Record<number, string[]> = {
  2: ['221', '222'],
  3: ['221', '222', '223'],
  4: ['221', '222', '223', '224'],
  5: ['221', '222', '223', '224', '225'],
  6: ['221', '222', '223', '224', '225', '226']
};

/**
 * Outer sector stack sizes by player count
 */
export const OUTER_STACK_SIZE: Record<number, number> = {
  2: 6,
  3: 9,
  4: 12,
  5: 15,
  6: 18
};

/**
 * Helper to determine sector ring from ID
 */
export function getSectorRing(sectorId: string): SectorRing {
  if ((SECTOR_NUMBERS.center as readonly string[]).includes(sectorId)) return 'center';
  if ((SECTOR_NUMBERS.inner as readonly string[]).includes(sectorId)) return 'inner';
  if ((SECTOR_NUMBERS.middle as readonly string[]).includes(sectorId)) return 'middle';
  if ((SECTOR_NUMBERS.outer as readonly string[]).includes(sectorId)) return 'outer';
  if ((SECTOR_NUMBERS.starting as readonly string[]).includes(sectorId)) return 'starting';
  if ((SECTOR_NUMBERS.guardian as readonly string[]).includes(sectorId)) return 'guardian';
  throw new Error(`Unknown sector ID: ${sectorId}`);
}

/**
 * Check if wormhole connection exists between two sectors
 */
export function hasWormholeConnection(
  sector1: EclipseSector,
  sector2: EclipseSector
): boolean {
  if (!sector1.coordinates || !sector2.coordinates) return false;

  // Calculate relative direction from sector1 to sector2
  const dq = sector2.coordinates.q - sector1.coordinates.q;
  const dr = sector2.coordinates.r - sector1.coordinates.r;

  // Determine hex edge direction (0-5)
  let direction: number;
  if (dq === 1 && dr === -1) direction = 0; // NE
  else if (dq === 1 && dr === 0) direction = 1; // E
  else if (dq === 0 && dr === 1) direction = 2; // SE
  else if (dq === -1 && dr === 1) direction = 3; // SW
  else if (dq === -1 && dr === 0) direction = 4; // W
  else if (dq === 0 && dr === -1) direction = 5; // NW
  else return false; // Not adjacent

  // Check if sector1 has wormhole on edge facing sector2
  const oppositeDirection = (direction + 3) % 6;
  const hasOutgoing = sector1.wormholes.some(
    wh => ((wh.direction + sector1.orientation) % 6) === direction
  );
  const hasIncoming = sector2.wormholes.some(
    wh => ((wh.direction + sector2.orientation) % 6) === oppositeDirection
  );

  return hasOutgoing && hasIncoming;
}

/**
 * Calculate total resource production for a sector
 */
export function getSectorProduction(sector: EclipseSector): {
  money: number;
  science: number;
  materials: number;
} {
  const production = { money: 0, science: 0, materials: 0 };

  sector.populationSquares.forEach(square => {
    if (square.type === 'money') production.money += square.resources;
    else if (square.type === 'science') production.science += square.resources;
    else if (square.type === 'materials') production.materials += square.resources;
    // Gray squares can be assigned to any resource type (handled by player choice)
  });

  return production;
}
