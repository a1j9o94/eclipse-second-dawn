// Turn and action system for Eclipse's 6-phase game loop
// Server-authoritative turn order and phase management

import type { Resources } from '../../shared/defaults';

// Eclipse has 6 phases per round
export type GamePhase =
  | 'action'      // 1. Players take turns selecting actions
  | 'combat'      // 2. Resolve all battles
  | 'upkeep'      // 3. Refresh actions, colony ships
  | 'income'      // 4. Collect resources
  | 'cleanup'     // 5. End-of-round cleanup
  | 'end';        // 6. End of round marker

// Available actions in the Action phase
export type ActionType =
  | 'explore'    // Draw and place new sector
  | 'influence'  // Pick up/place influence discs, refresh colony ships
  | 'research'   // Purchase technology
  | 'upgrade'    // Replace ship parts
  | 'build'      // Build ships or structures
  | 'move'       // Move one ship once
  | 'pass';      // Pass turn (can still react)

// Action cost represents influence disc cost
export type ActionCost = {
  influence: number;
  credits?: number;
  materials?: number;
  science?: number;
};

// Player action state
export type PlayerActionState = {
  playerId: string;
  influenceAvailable: number; // Discs left on influence track
  hasPassedThisRound: boolean;
  actionsThisRound: ActionType[];
  canReact: boolean; // Can take reactions after passing
};

// Turn state for a full round
export type TurnState = {
  roundNum: number;
  phase: GamePhase;
  currentPlayerIndex: number;
  playerOrder: string[]; // Player IDs in turn order
  playerActions: Record<string, PlayerActionState>;
  passedPlayers: string[]; // Players who have passed
  allPlayersPassed: boolean; // When all pass, advance to combat
};

// Action validation result
export type ActionValidation = {
  valid: boolean;
  reason?: string;
  cost?: ActionCost;
};

// Action costs in influence discs
const ACTION_COSTS: Record<ActionType, number> = {
  explore: 1,
  influence: 1,
  research: 1,
  upgrade: 1,
  build: 1,
  move: 1,
  pass: 0,
};

/**
 * Initialize turn state for a new round
 */
export function initializeTurnState(
  playerIds: string[],
  roundNum: number,
  startingPlayerIndex: number = 0
): TurnState {
  const playerActions: Record<string, PlayerActionState> = {};

  for (const playerId of playerIds) {
    playerActions[playerId] = {
      playerId,
      influenceAvailable: 16, // Standard Eclipse starting influence
      hasPassedThisRound: false,
      actionsThisRound: [],
      canReact: false,
    };
  }

  return {
    roundNum,
    phase: 'action',
    currentPlayerIndex: startingPlayerIndex,
    playerOrder: [...playerIds],
    playerActions,
    passedPlayers: [],
    allPlayersPassed: false,
  };
}

/**
 * Validate if a player can take a specific action
 */
export function validateAction(
  state: TurnState,
  playerId: string,
  action: ActionType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _playerResources?: Resources
): ActionValidation {
  const playerState = state.playerActions[playerId];

  if (!playerState) {
    return { valid: false, reason: 'Player not found' };
  }

  // Can't take actions if already passed (except reactions)
  if (playerState.hasPassedThisRound && !playerState.canReact) {
    return { valid: false, reason: 'Player has already passed' };
  }

  // Check if it's this player's turn (if not passed)
  if (!playerState.hasPassedThisRound) {
    const currentPlayerId = state.playerOrder[state.currentPlayerIndex];
    if (currentPlayerId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
  }

  // Check phase - actions only valid during action phase
  if (state.phase !== 'action') {
    return { valid: false, reason: `Cannot take actions during ${state.phase} phase` };
  }

  // Pass action is always valid
  if (action === 'pass') {
    return { valid: true, cost: { influence: 0 } };
  }

  // Check influence disc availability
  const influenceCost = ACTION_COSTS[action];
  if (playerState.influenceAvailable < influenceCost) {
    return {
      valid: false,
      reason: `Not enough influence (need ${influenceCost}, have ${playerState.influenceAvailable})`
    };
  }

  // Validate action-specific requirements
  const actionCost: ActionCost = { influence: influenceCost };

  switch (action) {
    case 'research':
      // Research requires science - check will be done at action resolution
      // with specific technology costs
      break;

    case 'upgrade':
      // Upgrade requires returning parts and taking new ones
      // Material cost depends on what's being upgraded
      break;

    case 'build':
      // Build requires materials and credits
      // Cost depends on what's being built
      break;

    // Other actions don't have resource costs beyond influence
  }

  return { valid: true, cost: actionCost };
}

/**
 * Execute an action and update turn state
 */
export function executeAction(
  state: TurnState,
  playerId: string,
  action: ActionType
): TurnState {
  const newState = JSON.parse(JSON.stringify(state)) as TurnState;
  const playerState = newState.playerActions[playerId];

  if (!playerState) {
    throw new Error('Player not found');
  }

  // Handle pass action specially
  if (action === 'pass') {
    playerState.hasPassedThisRound = true;
    playerState.canReact = true; // Can take one reaction after passing

    if (!newState.passedPlayers.includes(playerId)) {
      newState.passedPlayers.push(playerId);
    }

    // Check if all players have passed
    if (newState.passedPlayers.length === newState.playerOrder.length) {
      newState.allPlayersPassed = true;
    }
  } else {
    // Deduct influence cost
    const cost = ACTION_COSTS[action];
    playerState.influenceAvailable -= cost;
    playerState.actionsThisRound.push(action);

    // If this was a reaction, can't react again
    if (playerState.hasPassedThisRound && playerState.canReact) {
      playerState.canReact = false;
    }
  }

  // Advance to next active player
  newState.currentPlayerIndex = getNextActivePlayerIndex(newState);

  return newState;
}

/**
 * Get the next player who hasn't passed (or loop to start if all passed)
 */
function getNextActivePlayerIndex(state: TurnState): number {
  if (state.allPlayersPassed) {
    return state.currentPlayerIndex; // Stay at current
  }

  let nextIndex = (state.currentPlayerIndex + 1) % state.playerOrder.length;
  let attempts = 0;

  // Find next player who hasn't passed
  while (attempts < state.playerOrder.length) {
    const nextPlayerId = state.playerOrder[nextIndex];
    const nextPlayerState = state.playerActions[nextPlayerId];

    if (nextPlayerState && !nextPlayerState.hasPassedThisRound) {
      return nextIndex;
    }

    nextIndex = (nextIndex + 1) % state.playerOrder.length;
    attempts++;
  }

  // If we get here, all players have passed
  return state.currentPlayerIndex;
}

/**
 * Advance to the next phase
 */
export function advancePhase(state: TurnState): TurnState {
  const newState = JSON.parse(JSON.stringify(state)) as TurnState;

  const phaseOrder: GamePhase[] = ['action', 'combat', 'upkeep', 'income', 'cleanup', 'end'];
  const currentIndex = phaseOrder.indexOf(state.phase);
  const nextIndex = (currentIndex + 1) % phaseOrder.length;

  newState.phase = phaseOrder[nextIndex];

  // If we're back to action phase, we've completed a round
  if (newState.phase === 'action') {
    newState.roundNum += 1;
    // Reset for new round
    return initializeTurnState(
      newState.playerOrder,
      newState.roundNum,
      (state.currentPlayerIndex + 1) % state.playerOrder.length // Rotate starting player
    );
  }

  return newState;
}

/**
 * Check if action phase is complete (all players passed)
 */
export function isActionPhaseComplete(state: TurnState): boolean {
  return state.phase === 'action' && state.allPlayersPassed;
}

/**
 * Process upkeep phase - refresh actions and colony ships
 */
export function processUpkeep(state: TurnState): TurnState {
  const newState = JSON.parse(JSON.stringify(state)) as TurnState;

  // Reset all player action states for next round
  for (const playerId of newState.playerOrder) {
    const playerState = newState.playerActions[playerId];
    if (playerState) {
      // Refresh influence discs (return all to track)
      playerState.influenceAvailable = 16;
      playerState.hasPassedThisRound = false;
      playerState.canReact = false;
      playerState.actionsThisRound = [];
    }
  }

  newState.passedPlayers = [];
  newState.allPlayersPassed = false;

  // Colony ship refresh would happen here (2 ships per player)

  return newState;
}

/**
 * Process income phase - calculate and distribute resources
 */
export function processIncome(
  state: TurnState,
  playerStates: Record<string, { resources: Resources; economy?: { creditMultiplier?: number; materialMultiplier?: number } }>
): Record<string, Resources> {
  const newResources: Record<string, Resources> = {};

  for (const playerId of state.playerOrder) {
    const playerState = playerStates[playerId];
    if (!playerState) continue;

    const current = playerState.resources;
    const economy = playerState.economy || {};

    // Base income per round (simplified Eclipse economy)
    const baseCredits = 2;
    const baseMaterials = 1;
    const baseScience = 1;

    // Apply faction multipliers
    const creditMult = economy.creditMultiplier || 1;
    const materialMult = economy.materialMultiplier || 1;

    newResources[playerId] = {
      credits: current.credits + Math.floor(baseCredits * creditMult),
      materials: current.materials + Math.floor(baseMaterials * materialMult),
      science: current.science + baseScience,
    };
  }

  return newResources;
}

/**
 * Get current player ID
 */
export function getCurrentPlayer(state: TurnState): string | null {
  if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= state.playerOrder.length) {
    return null;
  }
  return state.playerOrder[state.currentPlayerIndex];
}

/**
 * Get player action state
 */
export function getPlayerActionState(state: TurnState, playerId: string): PlayerActionState | null {
  return state.playerActions[playerId] || null;
}

export default {
  initializeTurnState,
  validateAction,
  executeAction,
  advancePhase,
  isActionPhaseComplete,
  processUpkeep,
  processIncome,
  getCurrentPlayer,
  getPlayerActionState,
};
