import { describe, it, expect } from 'vitest';
import {
  initializeTurnState,
  validateAction,
  executeAction,
  advancePhase,
  isActionPhaseComplete,
  processUpkeep,
  processIncome,
  getCurrentPlayer,
  getPlayerActionState,
  type TurnState,
  type ActionType,
} from '../../convex/engine/turns';

describe('Turn System', () => {
  const playerIds = ['player1', 'player2'];

  describe('initializeTurnState', () => {
    it('should initialize turn state for a new round', () => {
      const state = initializeTurnState(playerIds, 1);

      expect(state.roundNum).toBe(1);
      expect(state.phase).toBe('action');
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.playerOrder).toEqual(playerIds);
      expect(state.allPlayersPassed).toBe(false);
      expect(state.passedPlayers).toEqual([]);
    });

    it('should initialize player action states with full influence', () => {
      const state = initializeTurnState(playerIds, 1);

      for (const playerId of playerIds) {
        const playerState = state.playerActions[playerId];
        expect(playerState).toBeDefined();
        expect(playerState.influenceAvailable).toBe(16);
        expect(playerState.hasPassedThisRound).toBe(false);
        expect(playerState.canReact).toBe(false);
        expect(playerState.actionsThisRound).toEqual([]);
      }
    });

    it('should support custom starting player index', () => {
      const state = initializeTurnState(playerIds, 1, 1);
      expect(state.currentPlayerIndex).toBe(1);
    });
  });

  describe('validateAction', () => {
    let state: TurnState;

    beforeEach(() => {
      state = initializeTurnState(playerIds, 1);
    });

    it('should allow valid explore action for current player', () => {
      const result = validateAction(state, 'player1', 'explore');
      expect(result.valid).toBe(true);
      expect(result.cost?.influence).toBe(1);
    });

    it('should reject action for wrong player', () => {
      const result = validateAction(state, 'player2', 'explore');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Not your turn');
    });

    it('should reject action if already passed', () => {
      state.playerActions['player1'].hasPassedThisRound = true;
      state.playerActions['player1'].canReact = false;

      const result = validateAction(state, 'player1', 'explore');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already passed');
    });

    it('should reject action if insufficient influence', () => {
      state.playerActions['player1'].influenceAvailable = 0;

      const result = validateAction(state, 'player1', 'explore');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Not enough influence');
    });

    it('should allow pass action regardless of influence', () => {
      state.playerActions['player1'].influenceAvailable = 0;

      const result = validateAction(state, 'player1', 'pass');
      expect(result.valid).toBe(true);
    });

    it('should reject actions during non-action phases', () => {
      state.phase = 'combat';

      const result = validateAction(state, 'player1', 'explore');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Cannot take actions during combat');
    });

    it('should validate all action types', () => {
      const actions: ActionType[] = ['explore', 'influence', 'research', 'upgrade', 'build', 'move'];

      for (const action of actions) {
        const result = validateAction(state, 'player1', action);
        expect(result.valid).toBe(true);
        expect(result.cost?.influence).toBeGreaterThan(0);
      }
    });
  });

  describe('executeAction', () => {
    let state: TurnState;

    beforeEach(() => {
      state = initializeTurnState(playerIds, 1);
    });

    it('should deduct influence when executing an action', () => {
      const newState = executeAction(state, 'player1', 'explore');

      expect(newState.playerActions['player1'].influenceAvailable).toBe(15);
      expect(newState.playerActions['player1'].actionsThisRound).toContain('explore');
    });

    it('should advance to next player after action', () => {
      const newState = executeAction(state, 'player1', 'explore');

      expect(newState.currentPlayerIndex).toBe(1);
      expect(getCurrentPlayer(newState)).toBe('player2');
    });

    it('should handle pass action', () => {
      const newState = executeAction(state, 'player1', 'pass');

      expect(newState.playerActions['player1'].hasPassedThisRound).toBe(true);
      expect(newState.playerActions['player1'].canReact).toBe(true);
      expect(newState.passedPlayers).toContain('player1');
      expect(newState.playerActions['player1'].influenceAvailable).toBe(16); // No deduction
    });

    it('should mark all players passed when everyone passes', () => {
      let newState = executeAction(state, 'player1', 'pass');
      newState = executeAction(newState, 'player2', 'pass');

      expect(newState.allPlayersPassed).toBe(true);
      expect(newState.passedPlayers).toHaveLength(2);
    });

    it('should skip passed players in turn order', () => {
      // Player 1 passes
      let newState = executeAction(state, 'player1', 'pass');
      expect(getCurrentPlayer(newState)).toBe('player2');

      // Player 2 takes action, should come back to player 2 (player 1 has passed)
      newState = executeAction(newState, 'player2', 'explore');
      expect(getCurrentPlayer(newState)).toBe('player2');
    });

    it('should deduct influence for multiple actions', () => {
      let newState = executeAction(state, 'player1', 'explore');
      newState = executeAction(newState, 'player2', 'research');
      newState = executeAction(newState, 'player2', 'build');

      expect(newState.playerActions['player1'].influenceAvailable).toBe(15);
      expect(newState.playerActions['player2'].influenceAvailable).toBe(14);
    });
  });

  describe('advancePhase', () => {
    it('should advance through all phases in order', () => {
      let state = initializeTurnState(playerIds, 1);
      const phases = ['action', 'combat', 'upkeep', 'income', 'cleanup', 'end'];

      for (let i = 0; i < phases.length - 1; i++) {
        expect(state.phase).toBe(phases[i]);
        state = advancePhase(state);
      }

      expect(state.phase).toBe('end');
    });

    it('should start new round when advancing from end phase', () => {
      let state = initializeTurnState(playerIds, 1);

      // Advance through all phases
      for (let i = 0; i < 6; i++) {
        state = advancePhase(state);
      }

      expect(state.phase).toBe('action');
      expect(state.roundNum).toBe(2);
    });

    it('should rotate starting player in new round', () => {
      let state = initializeTurnState(playerIds, 1, 0);

      // Complete a full round
      for (let i = 0; i < 6; i++) {
        state = advancePhase(state);
      }

      expect(state.currentPlayerIndex).toBe(1);
      expect(getCurrentPlayer(state)).toBe('player2');
    });

    it('should reset player states for new round', () => {
      let state = initializeTurnState(playerIds, 1);

      // Take some actions
      state = executeAction(state, 'player1', 'explore');
      state = executeAction(state, 'player2', 'pass');

      // Advance to new round
      for (let i = 0; i < 6; i++) {
        state = advancePhase(state);
      }

      // Check states are reset
      for (const playerId of playerIds) {
        const playerState = state.playerActions[playerId];
        expect(playerState.influenceAvailable).toBe(16);
        expect(playerState.hasPassedThisRound).toBe(false);
        expect(playerState.actionsThisRound).toEqual([]);
      }
    });
  });

  describe('isActionPhaseComplete', () => {
    it('should return false when not all players have passed', () => {
      let state = initializeTurnState(playerIds, 1);
      state = executeAction(state, 'player1', 'pass');

      expect(isActionPhaseComplete(state)).toBe(false);
    });

    it('should return true when all players have passed', () => {
      let state = initializeTurnState(playerIds, 1);
      state = executeAction(state, 'player1', 'pass');
      state = executeAction(state, 'player2', 'pass');

      expect(isActionPhaseComplete(state)).toBe(true);
    });

    it('should return false during non-action phases', () => {
      const state = initializeTurnState(playerIds, 1);
      state.phase = 'combat';

      expect(isActionPhaseComplete(state)).toBe(false);
    });
  });

  describe('processUpkeep', () => {
    it('should refresh all influence discs', () => {
      let state = initializeTurnState(playerIds, 1);

      // Use some influence
      state = executeAction(state, 'player1', 'explore');
      state = executeAction(state, 'player2', 'research');
      state = executeAction(state, 'player2', 'build');

      // Process upkeep
      const newState = processUpkeep(state);

      // All influence should be refreshed
      for (const playerId of playerIds) {
        expect(newState.playerActions[playerId].influenceAvailable).toBe(16);
      }
    });

    it('should reset pass states', () => {
      let state = initializeTurnState(playerIds, 1);

      // Both players pass
      state = executeAction(state, 'player1', 'pass');
      state = executeAction(state, 'player2', 'pass');

      // Process upkeep
      const newState = processUpkeep(state);

      for (const playerId of playerIds) {
        expect(newState.playerActions[playerId].hasPassedThisRound).toBe(false);
        expect(newState.playerActions[playerId].canReact).toBe(false);
      }

      expect(newState.passedPlayers).toEqual([]);
      expect(newState.allPlayersPassed).toBe(false);
    });

    it('should clear action history', () => {
      let state = initializeTurnState(playerIds, 1);

      state = executeAction(state, 'player1', 'explore');
      state = executeAction(state, 'player2', 'research');

      const newState = processUpkeep(state);

      for (const playerId of playerIds) {
        expect(newState.playerActions[playerId].actionsThisRound).toEqual([]);
      }
    });
  });

  describe('processIncome', () => {
    it('should distribute base income to all players', () => {
      const state = initializeTurnState(playerIds, 1);

      const playerStates = {
        player1: {
          resources: { credits: 10, materials: 5, science: 2 },
        },
        player2: {
          resources: { credits: 8, materials: 3, science: 1 },
        },
      };

      const newResources = processIncome(state, playerStates);

      // Base income: +2 credits, +1 materials, +1 science
      expect(newResources['player1'].credits).toBe(12);
      expect(newResources['player1'].materials).toBe(6);
      expect(newResources['player1'].science).toBe(3);

      expect(newResources['player2'].credits).toBe(10);
      expect(newResources['player2'].materials).toBe(4);
      expect(newResources['player2'].science).toBe(2);
    });

    it('should apply economy multipliers', () => {
      const state = initializeTurnState(playerIds, 1);

      const playerStates = {
        player1: {
          resources: { credits: 10, materials: 5, science: 2 },
          economy: {
            creditMultiplier: 2,
            materialMultiplier: 1.5,
          },
        },
        player2: {
          resources: { credits: 8, materials: 3, science: 1 },
        },
      };

      const newResources = processIncome(state, playerStates);

      // Player 1 has multipliers
      expect(newResources['player1'].credits).toBe(14); // +4 (2 * 2)
      expect(newResources['player1'].materials).toBe(6); // +1 (1 * 1.5, floored)

      // Player 2 has base income
      expect(newResources['player2'].credits).toBe(10); // +2
    });
  });

  describe('getCurrentPlayer and getPlayerActionState', () => {
    it('should return current player ID', () => {
      const state = initializeTurnState(playerIds, 1, 0);
      expect(getCurrentPlayer(state)).toBe('player1');
    });

    it('should return null for invalid index', () => {
      const state = initializeTurnState(playerIds, 1, 0);
      state.currentPlayerIndex = 999;
      expect(getCurrentPlayer(state)).toBe(null);
    });

    it('should return player action state', () => {
      const state = initializeTurnState(playerIds, 1);
      const playerState = getPlayerActionState(state, 'player1');

      expect(playerState).not.toBe(null);
      expect(playerState?.playerId).toBe('player1');
      expect(playerState?.influenceAvailable).toBe(16);
    });

    it('should return null for non-existent player', () => {
      const state = initializeTurnState(playerIds, 1);
      const playerState = getPlayerActionState(state, 'nonexistent');

      expect(playerState).toBe(null);
    });
  });

  describe('Full round simulation', () => {
    it('should handle a complete round with multiple actions', () => {
      let state = initializeTurnState(['p1', 'p2', 'p3'], 1);

      // Round of actions
      state = executeAction(state, 'p1', 'explore');
      expect(state.playerActions['p1'].influenceAvailable).toBe(15);

      state = executeAction(state, 'p2', 'research');
      expect(state.playerActions['p2'].influenceAvailable).toBe(15);

      state = executeAction(state, 'p3', 'build');
      expect(state.playerActions['p3'].influenceAvailable).toBe(15);

      // p1's turn again
      state = executeAction(state, 'p1', 'upgrade');
      expect(state.playerActions['p1'].influenceAvailable).toBe(14);

      // p2 and p3 pass
      state = executeAction(state, 'p2', 'pass');
      state = executeAction(state, 'p3', 'pass');

      // p1 continues
      state = executeAction(state, 'p1', 'move');
      expect(state.playerActions['p1'].influenceAvailable).toBe(13);

      // p1 finally passes
      state = executeAction(state, 'p1', 'pass');

      expect(isActionPhaseComplete(state)).toBe(true);
      expect(state.allPlayersPassed).toBe(true);
    });
  });
});
