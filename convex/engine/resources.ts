/**
 * Eclipse Second Dawn - Resource Economy Engine
 *
 * Implements the board game's resource management system:
 * - 3 resource types: Money, Science, Materials
 * - Population cube production tracking
 * - Influence disk mechanics
 * - Income/upkeep calculations
 * - Resource trading (2:1 conversion)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * The three resource types in Eclipse Second Dawn
 */
export type ResourceType = 'money' | 'science' | 'materials';

/**
 * Resource amounts tracked in storage
 */
export type Resources = {
  money: number;
  science: number;
  materials: number;
};

/**
 * Population track state - shows production capacity
 * Each track has positions 0-13, leftmost visible determines production
 */
export type PopulationTrack = {
  type: ResourceType;
  cubesRemaining: number; // How many cubes left on this track (not placed on hexes)
  productionValue: number; // Leftmost visible square = income per round
};

/**
 * Influence disk state
 * Disks start on influence track, move to actions or sectors
 */
export type InfluenceState = {
  onTrack: number; // Disks remaining on influence track
  onActions: number; // Disks placed on action spaces
  onSectors: number; // Disks controlling sectors
  totalAvailable: number; // Total disks owned (base + tech bonuses)
  upkeepCost: number; // Leftmost visible circle = money cost per round
};

/**
 * Complete player economy state for Eclipse Second Dawn
 */
export type PlayerEconomy = {
  resources: Resources;
  populationTracks: {
    money: PopulationTrack;
    science: PopulationTrack;
    materials: PopulationTrack;
  };
  influence: InfluenceState;
  colonyShips: ColonyShipState;
  tradeRatio: number; // Units to give for trading (default 2, varies by species)
};

/**
 * Cost specification for actions
 */
export type Cost = Partial<Resources>;

/**
 * Production result from upkeep phase
 */
export type ProductionResult = {
  moneyIncome: number;
  scienceIncome: number;
  materialsIncome: number;
  upkeepCost: number;
  netMoney: number; // Income - upkeep
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Default starting economy for standard species (Terrans)
 */
export const DEFAULT_STARTING_ECONOMY: PlayerEconomy = {
  resources: {
    money: 0,
    science: 0,
    materials: 0,
  },
  populationTracks: {
    money: { type: 'money', cubesRemaining: 13, productionValue: 0 },
    science: { type: 'science', cubesRemaining: 13, productionValue: 0 },
    materials: { type: 'materials', cubesRemaining: 13, productionValue: 0 },
  },
  influence: {
    onTrack: 13, // Start with 13 influence disks on track
    onActions: 0,
    onSectors: 0,
    totalAvailable: 13,
    upkeepCost: 0, // Exposed when all disks on track
  },
  colonyShips: {
    total: 3, // Standard species start with 3 (varies: Planta=4, some=2)
    available: 3,
    used: 0,
  },
  tradeRatio: 2, // 2:1 conversion for Terrans
};

/**
 * Population track production values
 * Index represents cubes remaining on track, value is production
 */
export const POPULATION_PRODUCTION_TABLE: number[] = [
  // 0 cubes left = all deployed = max production
  13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
  // 13 cubes left = none deployed = 0 production
];

/**
 * Influence track upkeep costs
 * Source: BoardGameGeek community research (non-linear progression)
 * Index represents disks on track, value is upkeep cost
 * Pattern: Higher costs for early expansion, encouraging strategic disk use
 * Note: Official values from physical board would allow verification
 */
export const INFLUENCE_UPKEEP_TABLE: number[] = [
  // 0 disks on track = all 13 used = max upkeep
  30, 25, 21, 17, 16, 14, 13, 11, 10, 8, 6, 5, 3, 0,
  // 13 disks on track = 0 used = 0 upkeep
  // Positions 14-16 for bonus disks from Advanced Robotics/Quantum Grid
  0, 0, 0,
];

// ============================================================================
// Resource Management
// ============================================================================

/**
 * Check if player can afford a cost
 */
export function canAfford(economy: PlayerEconomy, cost: Cost): boolean {
  const { money = 0, science = 0, materials = 0 } = cost;
  return (
    economy.resources.money >= money &&
    economy.resources.science >= science &&
    economy.resources.materials >= materials
  );
}

/**
 * Spend resources (returns new economy state)
 * Throws if cannot afford
 */
export function spendResources(
  economy: PlayerEconomy,
  cost: Cost
): PlayerEconomy {
  if (!canAfford(economy, cost)) {
    throw new Error(
      `Cannot afford cost: need ${JSON.stringify(cost)}, have ${JSON.stringify(economy.resources)}`
    );
  }

  return {
    ...economy,
    resources: {
      money: economy.resources.money - (cost.money ?? 0),
      science: economy.resources.science - (cost.science ?? 0),
      materials: economy.resources.materials - (cost.materials ?? 0),
    },
  };
}

/**
 * Add resources to storage
 */
export function addResources(
  economy: PlayerEconomy,
  gain: Partial<Resources>
): PlayerEconomy {
  return {
    ...economy,
    resources: {
      money: economy.resources.money + (gain.money ?? 0),
      science: economy.resources.science + (gain.science ?? 0),
      materials: economy.resources.materials + (gain.materials ?? 0),
    },
  };
}

/**
 * Trade resources at species-specific ratio
 * Give N units of one resource to get 1 unit of another
 *
 * @param from Resource type to trade away
 * @param to Resource type to receive
 * @param amount How many units to RECEIVE (will cost amount * tradeRatio)
 */
export function tradeResources(
  economy: PlayerEconomy,
  from: ResourceType,
  to: ResourceType,
  amount: number
): PlayerEconomy {
  if (from === to) {
    throw new Error('Cannot trade a resource for itself');
  }

  const cost = amount * economy.tradeRatio;
  if (economy.resources[from] < cost) {
    throw new Error(
      `Cannot trade: need ${cost} ${from}, have ${economy.resources[from]}`
    );
  }

  return {
    ...economy,
    resources: {
      ...economy.resources,
      [from]: economy.resources[from] - cost,
      [to]: economy.resources[to] + amount,
    },
  };
}

// ============================================================================
// Population & Production
// ============================================================================

/**
 * Calculate production value from population track
 */
export function getProductionValue(cubesRemaining: number): number {
  if (cubesRemaining < 0 || cubesRemaining >= POPULATION_PRODUCTION_TABLE.length) {
    return 0;
  }
  return POPULATION_PRODUCTION_TABLE[cubesRemaining];
}

/**
 * Move population cube from track to a hex (increases production)
 * Returns new economy state
 */
export function placePopulationCube(
  economy: PlayerEconomy,
  trackType: ResourceType
): PlayerEconomy {
  const track = economy.populationTracks[trackType];
  if (track.cubesRemaining <= 0) {
    throw new Error(`No ${trackType} population cubes remaining to place`);
  }

  const newCubesRemaining = track.cubesRemaining - 1;
  const newProduction = getProductionValue(newCubesRemaining);

  return {
    ...economy,
    populationTracks: {
      ...economy.populationTracks,
      [trackType]: {
        ...track,
        cubesRemaining: newCubesRemaining,
        productionValue: newProduction,
      },
    },
  };
}

/**
 * Remove population cube from hex back to track (decreases production)
 * Used when losing control of a sector
 */
export function removePopulationCube(
  economy: PlayerEconomy,
  trackType: ResourceType
): PlayerEconomy {
  const track = economy.populationTracks[trackType];
  if (track.cubesRemaining >= POPULATION_PRODUCTION_TABLE.length - 1) {
    throw new Error(`All ${trackType} population cubes already on track`);
  }

  const newCubesRemaining = track.cubesRemaining + 1;
  const newProduction = getProductionValue(newCubesRemaining);

  return {
    ...economy,
    populationTracks: {
      ...economy.populationTracks,
      [trackType]: {
        ...track,
        cubesRemaining: newCubesRemaining,
        productionValue: newProduction,
      },
    },
  };
}

// ============================================================================
// Influence Disks
// ============================================================================

/**
 * Calculate upkeep cost from influence track state
 */
export function getUpkeepCost(disksOnTrack: number): number {
  if (disksOnTrack < 0 || disksOnTrack >= INFLUENCE_UPKEEP_TABLE.length) {
    return INFLUENCE_UPKEEP_TABLE[0]; // Max upkeep if invalid
  }
  return INFLUENCE_UPKEEP_TABLE[disksOnTrack];
}

/**
 * Move influence disk from track to action space
 * Used when taking an action
 */
export function placeInfluenceOnAction(economy: PlayerEconomy): PlayerEconomy {
  if (economy.influence.onTrack <= 0) {
    throw new Error('No influence disks available on track');
  }

  const newOnTrack = economy.influence.onTrack - 1;
  const newUpkeep = getUpkeepCost(newOnTrack);

  return {
    ...economy,
    influence: {
      ...economy.influence,
      onTrack: newOnTrack,
      onActions: economy.influence.onActions + 1,
      upkeepCost: newUpkeep,
    },
  };
}

/**
 * Move influence disk from track to sector (control)
 */
export function placeInfluenceOnSector(economy: PlayerEconomy): PlayerEconomy {
  if (economy.influence.onTrack <= 0) {
    throw new Error('No influence disks available on track');
  }

  const newOnTrack = economy.influence.onTrack - 1;
  const newUpkeep = getUpkeepCost(newOnTrack);

  return {
    ...economy,
    influence: {
      ...economy.influence,
      onTrack: newOnTrack,
      onSectors: economy.influence.onSectors + 1,
      upkeepCost: newUpkeep,
    },
  };
}

/**
 * Return influence disk from action to track (rightmost space)
 */
export function returnInfluenceFromAction(economy: PlayerEconomy): PlayerEconomy {
  if (economy.influence.onActions <= 0) {
    throw new Error('No influence disks on actions to return');
  }

  const newOnTrack = economy.influence.onTrack + 1;
  const newUpkeep = getUpkeepCost(newOnTrack);

  return {
    ...economy,
    influence: {
      ...economy.influence,
      onTrack: newOnTrack,
      onActions: economy.influence.onActions - 1,
      upkeepCost: newUpkeep,
    },
  };
}

/**
 * Return influence disk from sector to track
 * Used when losing control of a sector
 */
export function returnInfluenceFromSector(economy: PlayerEconomy): PlayerEconomy {
  if (economy.influence.onSectors <= 0) {
    throw new Error('No influence disks on sectors to return');
  }

  const newOnTrack = economy.influence.onTrack + 1;
  const newUpkeep = getUpkeepCost(newOnTrack);

  return {
    ...economy,
    influence: {
      ...economy.influence,
      onTrack: newOnTrack,
      onSectors: economy.influence.onSectors - 1,
      upkeepCost: newUpkeep,
    },
  };
}

/**
 * Add bonus influence disks from technology
 * Stacked on leftmost space of track
 */
export function addBonusInfluence(
  economy: PlayerEconomy,
  amount: number
): PlayerEconomy {
  return {
    ...economy,
    influence: {
      ...economy.influence,
      onTrack: economy.influence.onTrack + amount,
      totalAvailable: economy.influence.totalAvailable + amount,
      upkeepCost: getUpkeepCost(economy.influence.onTrack + amount),
    },
  };
}

// ============================================================================
// Upkeep Phase
// ============================================================================

/**
 * Calculate production for upkeep phase
 * Does not modify state, just returns what would be produced
 */
export function calculateProduction(economy: PlayerEconomy): ProductionResult {
  const moneyIncome = economy.populationTracks.money.productionValue;
  const scienceIncome = economy.populationTracks.science.productionValue;
  const materialsIncome = economy.populationTracks.materials.productionValue;
  const upkeepCost = economy.influence.upkeepCost;
  const netMoney = moneyIncome - upkeepCost;

  return {
    moneyIncome,
    scienceIncome,
    materialsIncome,
    upkeepCost,
    netMoney,
  };
}

/**
 * Execute upkeep phase:
 * 1. Pay upkeep cost (from money income)
 * 2. Produce resources based on population tracks
 *
 * If cannot pay upkeep, player must trade resources or lose sectors
 * (sector loss logic handled elsewhere)
 */
export function executeUpkeep(economy: PlayerEconomy): {
  economy: PlayerEconomy;
  production: ProductionResult;
  shortfall: number; // Positive if cannot pay upkeep
} {
  const production = calculateProduction(economy);

  // Calculate actual money change (income - upkeep)
  const moneyChange = production.netMoney;
  const shortfall = Math.max(0, -moneyChange - economy.resources.money);

  // Apply production
  const newEconomy: PlayerEconomy = {
    ...economy,
    resources: {
      money: Math.max(0, economy.resources.money + moneyChange),
      science: economy.resources.science + production.scienceIncome,
      materials: economy.resources.materials + production.materialsIncome,
    },
  };

  return {
    economy: newEconomy,
    production,
    shortfall,
  };
}

/**
 * Reset influence disks and colony ships at end of round
 * All disks on action spaces return to rightmost track positions
 * All colony ships are refreshed (flipped face-up)
 */
export function resetInfluenceAfterRound(economy: PlayerEconomy): PlayerEconomy {
  const newOnTrack = economy.influence.onTrack + economy.influence.onActions;

  return {
    ...economy,
    influence: {
      ...economy.influence,
      onTrack: newOnTrack,
      onActions: 0,
      upkeepCost: getUpkeepCost(newOnTrack),
    },
    colonyShips: refreshColonyShips(economy.colonyShips),
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if economy state is valid
 */
export function validateEconomy(economy: PlayerEconomy): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Resources cannot be negative
  if (economy.resources.money < 0) errors.push('Money cannot be negative');
  if (economy.resources.science < 0) errors.push('Science cannot be negative');
  if (economy.resources.materials < 0) errors.push('Materials cannot be negative');

  // Population cubes
  for (const type of ['money', 'science', 'materials'] as const) {
    const track = economy.populationTracks[type];
    if (track.cubesRemaining < 0 || track.cubesRemaining > 13) {
      errors.push(`${type} cubes remaining out of range: ${track.cubesRemaining}`);
    }
  }

  // Influence disks
  const totalInfluence =
    economy.influence.onTrack +
    economy.influence.onActions +
    economy.influence.onSectors;
  if (totalInfluence !== economy.influence.totalAvailable) {
    errors.push(
      `Influence disk count mismatch: ${totalInfluence} vs ${economy.influence.totalAvailable}`
    );
  }

  if (economy.influence.onTrack < 0) errors.push('Influence on track cannot be negative');
  if (economy.influence.onActions < 0) errors.push('Influence on actions cannot be negative');
  if (economy.influence.onSectors < 0) errors.push('Influence on sectors cannot be negative');

  // Colony ships
  const colonyValidation = validateColonyShips(economy.colonyShips);
  if (!colonyValidation.valid) {
    errors.push(...colonyValidation.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Colony Ships
// ============================================================================

/**
 * Colony ship state
 * Used to deploy population cubes to sectors
 */
export type ColonyShipState = {
  total: number;      // Total colony ships owned (varies by species)
  available: number;  // Face-up ships available to use
  used: number;       // Face-down ships (already used this round)
};

/**
 * Get number of available colony ships
 */
export function getAvailableColonyShips(colonyShips: ColonyShipState): number {
  return colonyShips.available;
}

/**
 * Use a colony ship to deploy population
 * Flips ship face-down (unavailable until upkeep)
 */
export function useColonyShip(colonyShips: ColonyShipState): ColonyShipState {
  if (colonyShips.available <= 0) {
    throw new Error('No colony ships available');
  }

  return {
    ...colonyShips,
    available: colonyShips.available - 1,
    used: colonyShips.used + 1,
  };
}

/**
 * Refresh all colony ships during upkeep phase
 * Flips all ships face-up (available again)
 */
export function refreshColonyShips(colonyShips: ColonyShipState): ColonyShipState {
  return {
    ...colonyShips,
    available: colonyShips.total,
    used: 0,
  };
}

/**
 * Add bonus colony ship from technology
 */
export function addBonusColonyShip(colonyShips: ColonyShipState): ColonyShipState {
  return {
    total: colonyShips.total + 1,
    available: colonyShips.available + 1,
    used: colonyShips.used,
  };
}

/**
 * Validate colony ship state
 */
export function validateColonyShips(colonyShips: ColonyShipState): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (colonyShips.available < 0) {
    errors.push('Available colony ships cannot be negative');
  }
  if (colonyShips.used < 0) {
    errors.push('Used colony ships cannot be negative');
  }
  if (colonyShips.available + colonyShips.used !== colonyShips.total) {
    errors.push(
      `Colony ship count mismatch: ${colonyShips.available} + ${colonyShips.used} !== ${colonyShips.total}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
