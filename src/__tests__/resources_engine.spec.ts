/**
 * Tests for Eclipse Second Dawn resource economy engine
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type PlayerEconomy,
  // Constants
  DEFAULT_STARTING_ECONOMY,
  POPULATION_PRODUCTION_TABLE,
  INFLUENCE_UPKEEP_TABLE,
  // Resource management
  canAfford,
  spendResources,
  addResources,
  tradeResources,
  // Population
  getProductionValue,
  placePopulationCube,
  removePopulationCube,
  // Influence
  getUpkeepCost,
  placeInfluenceOnAction,
  placeInfluenceOnSector,
  returnInfluenceFromAction,
  returnInfluenceFromSector,
  addBonusInfluence,
  // Upkeep
  calculateProduction,
  executeUpkeep,
  resetInfluenceAfterRound,
  // Validation
  validateEconomy,
} from '../../convex/engine/resources';

describe('Resource Management', () => {
  it('should check if player can afford costs', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 10, science: 5, materials: 3 },
    };

    expect(canAfford(economy, { money: 10 })).toBe(true);
    expect(canAfford(economy, { money: 11 })).toBe(false);
    expect(canAfford(economy, { money: 5, science: 3, materials: 2 })).toBe(true);
    expect(canAfford(economy, { money: 5, science: 6 })).toBe(false);
  });

  it('should spend resources correctly', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 10, science: 5, materials: 3 },
    };

    const result = spendResources(economy, { money: 3, materials: 2 });
    expect(result.resources).toEqual({ money: 7, science: 5, materials: 1 });
  });

  it('should throw when spending unaffordable resources', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 5, science: 2, materials: 1 },
    };

    expect(() => spendResources(economy, { money: 10 })).toThrow();
    expect(() => spendResources(economy, { science: 3 })).toThrow();
  });

  it('should add resources to storage', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 10, science: 5, materials: 3 },
    };

    const result = addResources(economy, { money: 5, science: 2 });
    expect(result.resources).toEqual({ money: 15, science: 7, materials: 3 });
  });

  it('should trade resources at 2:1 ratio', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 10, science: 0, materials: 0 },
    };

    // Trade 4 money for 2 science (at 2:1 ratio)
    const result = tradeResources(economy, 'money', 'science', 2);
    expect(result.resources).toEqual({ money: 6, science: 2, materials: 0 });
  });

  it('should handle custom trade ratios', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 9, science: 0, materials: 0 },
      tradeRatio: 3, // Some species have different ratios
    };

    // Trade 9 money for 3 science (at 3:1 ratio)
    const result = tradeResources(economy, 'money', 'science', 3);
    expect(result.resources).toEqual({ money: 0, science: 3, materials: 0 });
  });

  it('should prevent trading insufficient resources', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 3, science: 0, materials: 0 },
    };

    expect(() => tradeResources(economy, 'money', 'science', 2)).toThrow();
  });

  it('should prevent trading resource for itself', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 10, science: 0, materials: 0 },
    };

    expect(() => tradeResources(economy, 'money', 'money', 1)).toThrow();
  });
});

describe('Population Cubes & Production', () => {
  it('should use correct production table', () => {
    expect(POPULATION_PRODUCTION_TABLE.length).toBe(14);
    expect(getProductionValue(13)).toBe(0); // All cubes on track = 0 production
    expect(getProductionValue(0)).toBe(13); // All cubes deployed = max production
    expect(getProductionValue(10)).toBe(3);
  });

  it('should place population cube and increase production', () => {
    const economy = DEFAULT_STARTING_ECONOMY;
    expect(economy.populationTracks.money.cubesRemaining).toBe(13);
    expect(economy.populationTracks.money.productionValue).toBe(0);

    const result = placePopulationCube(economy, 'money');
    expect(result.populationTracks.money.cubesRemaining).toBe(12);
    expect(result.populationTracks.money.productionValue).toBe(1);
  });

  it('should handle multiple population placements', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // Place 3 money cubes
    economy = placePopulationCube(economy, 'money');
    economy = placePopulationCube(economy, 'money');
    economy = placePopulationCube(economy, 'money');

    expect(economy.populationTracks.money.cubesRemaining).toBe(10);
    expect(economy.populationTracks.money.productionValue).toBe(3);

    // Place 2 science cubes
    economy = placePopulationCube(economy, 'science');
    economy = placePopulationCube(economy, 'science');

    expect(economy.populationTracks.science.cubesRemaining).toBe(11);
    expect(economy.populationTracks.science.productionValue).toBe(2);
  });

  it('should prevent placing cube when none remain', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // Place all 13 cubes
    for (let i = 0; i < 13; i++) {
      economy = placePopulationCube(economy, 'materials');
    }

    expect(economy.populationTracks.materials.cubesRemaining).toBe(0);
    expect(() => placePopulationCube(economy, 'materials')).toThrow();
  });

  it('should remove population cube and decrease production', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // Place 5 cubes
    for (let i = 0; i < 5; i++) {
      economy = placePopulationCube(economy, 'science');
    }
    expect(economy.populationTracks.science.productionValue).toBe(5);

    // Remove 2 cubes
    economy = removePopulationCube(economy, 'science');
    economy = removePopulationCube(economy, 'science');

    expect(economy.populationTracks.science.cubesRemaining).toBe(10);
    expect(economy.populationTracks.science.productionValue).toBe(3);
  });

  it('should prevent removing cube when all on track', () => {
    const economy = DEFAULT_STARTING_ECONOMY;
    expect(() => removePopulationCube(economy, 'money')).toThrow();
  });
});

describe('Influence Disks', () => {
  it('should use correct upkeep table', () => {
    expect(INFLUENCE_UPKEEP_TABLE.length).toBe(14);
    expect(getUpkeepCost(13)).toBe(0); // All disks on track = 0 upkeep
    expect(getUpkeepCost(0)).toBe(30); // All disks used = max upkeep
    expect(getUpkeepCost(10)).toBe(6);
  });

  it('should start with 13 influence disks on track', () => {
    const economy = DEFAULT_STARTING_ECONOMY;
    expect(economy.influence.onTrack).toBe(13);
    expect(economy.influence.onActions).toBe(0);
    expect(economy.influence.onSectors).toBe(0);
    expect(economy.influence.upkeepCost).toBe(0);
  });

  it('should move disk to action and increase upkeep', () => {
    const economy = DEFAULT_STARTING_ECONOMY;
    const result = placeInfluenceOnAction(economy);

    expect(result.influence.onTrack).toBe(12);
    expect(result.influence.onActions).toBe(1);
    expect(result.influence.upkeepCost).toBe(3);
  });

  it('should move disk to sector and increase upkeep', () => {
    const economy = DEFAULT_STARTING_ECONOMY;
    const result = placeInfluenceOnSector(economy);

    expect(result.influence.onTrack).toBe(12);
    expect(result.influence.onSectors).toBe(1);
    expect(result.influence.upkeepCost).toBe(3);
  });

  it('should handle multiple influence uses', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // Take 3 actions
    economy = placeInfluenceOnAction(economy);
    economy = placeInfluenceOnAction(economy);
    economy = placeInfluenceOnAction(economy);

    // Control 2 sectors
    economy = placeInfluenceOnSector(economy);
    economy = placeInfluenceOnSector(economy);

    expect(economy.influence.onTrack).toBe(8);
    expect(economy.influence.onActions).toBe(3);
    expect(economy.influence.onSectors).toBe(2);
    expect(economy.influence.upkeepCost).toBe(10);
  });

  it('should prevent using influence when none available', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // Use all 13 disks
    for (let i = 0; i < 13; i++) {
      economy = placeInfluenceOnAction(economy);
    }

    expect(economy.influence.onTrack).toBe(0);
    expect(() => placeInfluenceOnAction(economy)).toThrow();
    expect(() => placeInfluenceOnSector(economy)).toThrow();
  });

  it('should return influence from action to track', () => {
    let economy = DEFAULT_STARTING_ECONOMY;
    economy = placeInfluenceOnAction(economy);
    economy = placeInfluenceOnAction(economy);

    expect(economy.influence.onActions).toBe(2);
    expect(economy.influence.upkeepCost).toBe(5);

    economy = returnInfluenceFromAction(economy);
    expect(economy.influence.onTrack).toBe(12);
    expect(economy.influence.onActions).toBe(1);
    expect(economy.influence.upkeepCost).toBe(3);
  });

  it('should return influence from sector to track', () => {
    let economy = DEFAULT_STARTING_ECONOMY;
    economy = placeInfluenceOnSector(economy);
    economy = placeInfluenceOnSector(economy);
    economy = placeInfluenceOnSector(economy);

    expect(economy.influence.onSectors).toBe(3);

    economy = returnInfluenceFromSector(economy);
    expect(economy.influence.onTrack).toBe(11);
    expect(economy.influence.onSectors).toBe(2);
  });

  it('should add bonus influence from technology', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // Advanced Robotics gives +2 influence
    economy = addBonusInfluence(economy, 2);

    expect(economy.influence.onTrack).toBe(15);
    expect(economy.influence.totalAvailable).toBe(15);
    expect(economy.influence.upkeepCost).toBe(0); // Still all on track
  });

  it('should reset influence disks after round', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // Use 5 disks for actions
    for (let i = 0; i < 5; i++) {
      economy = placeInfluenceOnAction(economy);
    }
    expect(economy.influence.onActions).toBe(5);
    expect(economy.influence.onTrack).toBe(8);

    // Reset at end of round
    economy = resetInfluenceAfterRound(economy);
    expect(economy.influence.onActions).toBe(0);
    expect(economy.influence.onTrack).toBe(13);
    expect(economy.influence.upkeepCost).toBe(0);
  });

  it('should not reset sector influence after round', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // 3 actions, 2 sectors
    economy = placeInfluenceOnAction(economy);
    economy = placeInfluenceOnAction(economy);
    economy = placeInfluenceOnAction(economy);
    economy = placeInfluenceOnSector(economy);
    economy = placeInfluenceOnSector(economy);

    // Reset after round
    economy = resetInfluenceAfterRound(economy);

    expect(economy.influence.onActions).toBe(0);
    expect(economy.influence.onSectors).toBe(2); // Sectors remain controlled
    expect(economy.influence.onTrack).toBe(11);
  });
});

describe('Upkeep Phase', () => {
  it('should calculate production correctly', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // Place population: 3 money, 2 science, 5 materials
    for (let i = 0; i < 3; i++) economy = placePopulationCube(economy, 'money');
    for (let i = 0; i < 2; i++) economy = placePopulationCube(economy, 'science');
    for (let i = 0; i < 5; i++) economy = placePopulationCube(economy, 'materials');

    // Use 4 influence disks (upkeep = 14)
    for (let i = 0; i < 4; i++) economy = placeInfluenceOnAction(economy);

    const production = calculateProduction(economy);
    expect(production.moneyIncome).toBe(3);
    expect(production.scienceIncome).toBe(2);
    expect(production.materialsIncome).toBe(5);
    expect(production.upkeepCost).toBe(14);
    expect(production.netMoney).toBe(3 - 14); // -11
  });

  it('should execute upkeep with sufficient money', () => {
    let economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 20, science: 0, materials: 0 },
    };

    // Setup: 5 money income, 3 science, 2 materials, 10 upkeep
    for (let i = 0; i < 5; i++) economy = placePopulationCube(economy, 'money');
    for (let i = 0; i < 3; i++) economy = placePopulationCube(economy, 'science');
    for (let i = 0; i < 2; i++) economy = placePopulationCube(economy, 'materials');
    for (let i = 0; i < 3; i++) economy = placeInfluenceOnAction(economy);

    const result = executeUpkeep(economy);

    expect(result.production.moneyIncome).toBe(5);
    expect(result.production.upkeepCost).toBe(10);
    expect(result.production.netMoney).toBe(-5);
    expect(result.shortfall).toBe(0); // Had 20, spent net 5, left with 15

    expect(result.economy.resources.money).toBe(15); // 20 + 5 - 10
    expect(result.economy.resources.science).toBe(3);
    expect(result.economy.resources.materials).toBe(2);
  });

  it('should detect upkeep shortfall', () => {
    let economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 3, science: 0, materials: 0 },
    };

    // 2 money income, 10 upkeep = -8 net, but only have 3 money
    for (let i = 0; i < 2; i++) economy = placePopulationCube(economy, 'money');
    for (let i = 0; i < 3; i++) economy = placeInfluenceOnAction(economy);

    const result = executeUpkeep(economy);

    expect(result.production.netMoney).toBe(-8); // 2 - 10
    expect(result.shortfall).toBe(5); // Need 8 more than income, have 3
    expect(result.economy.resources.money).toBe(0); // Bankrupted
  });

  it('should handle upkeep with zero money income', () => {
    let economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: 15, science: 0, materials: 0 },
    };

    // 0 money income, 2 science, 3 materials, 8 upkeep
    for (let i = 0; i < 2; i++) economy = placePopulationCube(economy, 'science');
    for (let i = 0; i < 3; i++) economy = placePopulationCube(economy, 'materials');
    for (let i = 0; i < 2; i++) economy = placeInfluenceOnAction(economy);

    const result = executeUpkeep(economy);

    expect(result.economy.resources.money).toBe(7); // 15 - 8
    expect(result.economy.resources.science).toBe(2);
    expect(result.economy.resources.materials).toBe(3);
  });
});

describe('Validation', () => {
  it('should validate correct economy state', () => {
    const economy = DEFAULT_STARTING_ECONOMY;
    const result = validateEconomy(economy);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect negative resources', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      resources: { money: -5, science: 0, materials: 0 },
    };

    const result = validateEconomy(economy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Money cannot be negative');
  });

  it('should detect invalid population cube counts', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      populationTracks: {
        ...DEFAULT_STARTING_ECONOMY.populationTracks,
        money: {
          type: 'money',
          cubesRemaining: 15, // Invalid: max is 13
          productionValue: 0,
        },
      },
    };

    const result = validateEconomy(economy);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('money cubes'))).toBe(true);
  });

  it('should detect influence disk count mismatch', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      influence: {
        onTrack: 10,
        onActions: 2,
        onSectors: 1,
        totalAvailable: 15, // Should be 13
        upkeepCost: 10,
      },
    };

    const result = validateEconomy(economy);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('disk count mismatch'))).toBe(true);
  });

  it('should detect negative influence counts', () => {
    const economy: PlayerEconomy = {
      ...DEFAULT_STARTING_ECONOMY,
      influence: {
        ...DEFAULT_STARTING_ECONOMY.influence,
        onActions: -2,
      },
    };

    const result = validateEconomy(economy);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('on actions cannot be negative'))).toBe(
      true
    );
  });
});

describe('Integration: Full Round Simulation', () => {
  it('should handle complete round cycle', () => {
    let economy = DEFAULT_STARTING_ECONOMY;

    // === START OF ROUND ===

    // Action 1: Explore (use influence)
    economy = placeInfluenceOnAction(economy);

    // Action 2: Explore and colonize (use influence for sector control)
    economy = placeInfluenceOnAction(economy);
    economy = placeInfluenceOnSector(economy);

    // Place population on colonized sector
    economy = placePopulationCube(economy, 'money');
    economy = placePopulationCube(economy, 'science');

    // Action 3: Build (use influence)
    economy = placeInfluenceOnAction(economy);

    // Spend some resources building
    economy = addResources(economy, { materials: 10 }); // Gain some for building
    economy = spendResources(economy, { materials: 5 });

    // === UPKEEP PHASE ===

    // Production: 1 money, 1 science, 0 materials
    // Upkeep: 12 disks on track = 6 money cost
    const upkeepResult = executeUpkeep(economy);
    economy = upkeepResult.economy;

    // Should have shortfall since we produce 1 money but owe 6
    expect(upkeepResult.shortfall).toBe(5);

    // Player must trade to cover shortfall
    // Trade 10 science for 5 money (2:1 ratio)
    economy = addResources(economy, { science: 10 }); // Simulate having science
    economy = tradeResources(economy, 'science', 'money', 5);

    // === END OF ROUND ===

    // Reset influence disks from actions
    economy = resetInfluenceAfterRound(economy);

    expect(economy.influence.onActions).toBe(0);
    expect(economy.influence.onSectors).toBe(1); // Still controlling sector
    expect(economy.influence.onTrack).toBe(12); // 3 used for actions returned

    // Validate final state
    const validation = validateEconomy(economy);
    expect(validation.valid).toBe(true);
  });
});
