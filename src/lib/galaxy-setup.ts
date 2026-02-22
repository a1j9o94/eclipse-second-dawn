import type { EclipseSector } from '../types/eclipse-sectors';
import { SECTOR_NUMBERS, STARTING_SECTORS_BY_PLAYER_COUNT, OUTER_STACK_SIZE } from '../types/eclipse-sectors';
import { Hex, GridGenerator } from 'react-hexgrid';

/**
 * Galaxy setup utilities for Eclipse: Second Dawn
 *
 * Handles variable galaxy size based on player count
 */

export interface GalaxyConfig {
  playerCount: 2 | 3 | 4 | 5 | 6;
  useGuardians: boolean;
  customOuterCount?: number;
}

export interface GalaxySetup {
  placedSectors: EclipseSector[]; // Sectors with coordinates
  innerStack: string[]; // Face-down sector IDs
  middleStack: string[];
  outerStack: string[];
}

/**
 * Calculate hex coordinates for a ring of hexes around the center
 */
function generateRingCoordinates(ring: number): Array<{ q: number; r: number; s: number }> {
  if (ring === 0) {
    return [{ q: 0, r: 0, s: 0 }];
  }

  const centerHex = new Hex(0, 0, 0);
  const hexes = GridGenerator.ring(centerHex, ring);

  return hexes.map((hex: Hex) => ({
    q: hex.q,
    r: hex.r,
    s: hex.s
  }));
}

/**
 * Get starting sector positions for players
 *
 * Evenly spaced around the galactic center in ring 1
 */
function getStartingSectorPositions(playerCount: number): Array<{ q: number; r: number; s: number }> {
  const ring1 = generateRingCoordinates(1); // 6 positions

  // Select evenly spaced positions
  const step = Math.floor(6 / playerCount);
  const positions: Array<{ q: number; r: number; s: number }> = [];

  for (let i = 0; i < playerCount; i++) {
    positions.push(ring1[i * step]);
  }

  return positions;
}

/**
 * Initialize galaxy for a new game
 *
 * 2 players: ~21 sectors (center + 2 rings)
 * 3-4 players: ~37 sectors (center + 3 rings)
 * 5-6 players: ~54 sectors (center + 4 rings)
 */
export function initializeGalaxy(config: GalaxyConfig): GalaxySetup {
  const { playerCount, useGuardians, customOuterCount } = config;

  const placedSectors: EclipseSector[] = [];

  // 1. Place Galactic Center
  const center: EclipseSector = {
    id: '001',
    ring: 'center',
    explored: true,
    orientation: 0,
    coordinates: { q: 0, r: 0, s: 0 },
    populationSquares: [],
    wormholes: [
      { direction: 0, type: 'normal' },
      { direction: 1, type: 'normal' },
      { direction: 2, type: 'normal' },
      { direction: 3, type: 'normal' },
      { direction: 4, type: 'normal' },
      { direction: 5, type: 'normal' }
    ],
    ships: [],
    ancients: []
  };
  placedSectors.push(center);

  // 2. Place Starting Sectors
  const startingPositions = getStartingSectorPositions(playerCount);
  const startingSectorIds = STARTING_SECTORS_BY_PLAYER_COUNT[playerCount];

  startingSectorIds.forEach((sectorId, index) => {
    const startingSector: EclipseSector = {
      id: sectorId,
      ring: 'starting',
      explored: true,
      orientation: 0,
      coordinates: startingPositions[index],
      populationSquares: [
        { type: 'gray', advanced: false, resources: 2 },
        { type: 'gray', advanced: false, resources: 1 },
        { type: 'money', advanced: false, resources: 1 }
      ],
      wormholes: [
        { direction: 0, type: 'normal' },
        { direction: 3, type: 'normal' }
      ],
      ships: [],
      ancients: []
    };
    placedSectors.push(startingSector);
  });

  // 3. Place Guardian Sectors (optional)
  if (useGuardians) {
    // Guardian sectors go in specific positions in ring 2
    const ring2 = generateRingCoordinates(2);
    const guardianPositions = [ring2[1], ring2[4], ring2[7], ring2[10]]; // Evenly spaced

    SECTOR_NUMBERS.guardian.forEach((sectorId, index) => {
      if (index < guardianPositions.length) {
        const guardianSector: EclipseSector = {
          id: sectorId,
          ring: 'guardian',
          explored: true,
          orientation: 0,
          coordinates: guardianPositions[index],
          populationSquares: [
            { type: 'materials', advanced: true, resources: 3 },
            { type: 'science', advanced: true, resources: 2 }
          ],
          wormholes: [
            { direction: 1, type: 'normal' },
            { direction: 3, type: 'normal' },
            { direction: 5, type: 'normal' }
          ],
          discoveryTile: {
            id: `disc-guardian-${index}`,
            revealed: false,
            ancientCount: 2
          },
          ships: [],
          ancients: [
            { count: 1, type: 'dreadnought' },
            { count: 1, type: 'cruiser' }
          ]
        };
        placedSectors.push(guardianSector);
      }
    });
  }

  // 4. Create sector stacks (face-down)
  const innerStack = [...SECTOR_NUMBERS.inner];
  const middleStack = [...SECTOR_NUMBERS.middle];
  const outerCount = customOuterCount || OUTER_STACK_SIZE[playerCount];
  const outerStack = SECTOR_NUMBERS.outer.slice(0, outerCount);

  // Shuffle stacks
  shuffleArray(innerStack);
  shuffleArray(middleStack);
  shuffleArray(outerStack);

  return {
    placedSectors,
    innerStack,
    middleStack,
    outerStack
  };
}

/**
 * Get expected total sector count by player count
 */
export function getExpectedSectorCount(playerCount: number, useGuardians: boolean): number {
  // Center + Starting sectors + Guardians (optional)
  const placed = 1 + playerCount + (useGuardians ? 4 : 0);

  // 2 players: Center + 2 starting + small stacks
  // 3-4 players: Center + 3-4 starting + medium stacks
  // 5-6 players: Center + 5-6 starting + full stacks

  return placed; // Only placed sectors initially
}

/**
 * Get maximum galaxy rings by player count
 */
export function getMaxRings(playerCount: number): number {
  if (playerCount <= 2) return 3; // Center + 2 rings
  if (playerCount <= 4) return 4; // Center + 3 rings
  return 5; // Center + 4 rings
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Find adjacent empty hex positions for exploration
 */
export function getAdjacentPositions(
  coordinates: { q: number; r: number; s: number },
  occupied: Set<string>
): Array<{ q: number; r: number; s: number; direction: number }> {
  const { q, r, s } = coordinates;

  // 6 adjacent hex positions (cube coordinates)
  const adjacents = [
    { q: q + 1, r: r - 1, s: s, direction: 0 }, // NE
    { q: q + 1, r: r, s: s - 1, direction: 1 }, // E
    { q: q, r: r + 1, s: s - 1, direction: 2 }, // SE
    { q: q - 1, r: r + 1, s: s, direction: 3 }, // SW
    { q: q - 1, r: r, s: s + 1, direction: 4 }, // W
    { q: q, r: r - 1, s: s + 1, direction: 5 }  // NW
  ];

  // Filter out occupied positions
  return adjacents.filter(pos => {
    const key = `${pos.q},${pos.r},${pos.s}`;
    return !occupied.has(key);
  });
}

/**
 * Validate if a sector can be placed at a position
 *
 * Must have wormhole connection to an adjacent controlled sector
 */
export function canPlaceSector(
  position: { q: number; r: number; s: number },
  placedSectors: EclipseSector[],
  playerId: string
): { valid: boolean; reason?: string } {
  const key = `${position.q},${position.r},${position.s}`;

  // Check if position is occupied
  const occupied = placedSectors.some(s =>
    s.coordinates &&
    `${s.coordinates.q},${s.coordinates.r},${s.coordinates.s}` === key
  );

  if (occupied) {
    return { valid: false, reason: 'Position already occupied' };
  }

  // Check if adjacent to controlled sector
  const { q, r, s } = position;
  const adjacentPositions = [
    { q: q + 1, r: r - 1, s: s },
    { q: q + 1, r: r, s: s - 1 },
    { q: q, r: r + 1, s: s - 1 },
    { q: q - 1, r: r + 1, s: s },
    { q: q - 1, r: r, s: s + 1 },
    { q: q, r: r - 1, s: s + 1 }
  ];

  const hasControlledAdjacent = adjacentPositions.some(adjPos => {
    const adjKey = `${adjPos.q},${adjPos.r},${adjPos.s}`;
    return placedSectors.some(s =>
      s.coordinates &&
      `${s.coordinates.q},${s.coordinates.r},${s.coordinates.s}` === adjKey &&
      (s.controlledBy === playerId || s.ships.some(ship => ship.playerId === playerId))
    );
  });

  if (!hasControlledAdjacent) {
    return { valid: false, reason: 'Not adjacent to controlled sector' };
  }

  return { valid: true };
}
