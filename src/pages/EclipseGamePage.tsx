import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import ConnectedGalaxyBoard from '../components/galaxy/ConnectedGalaxyBoard';

interface EclipseGamePageProps {
  roomId: Id<"rooms">;
  playerId: string | undefined;
  onLeaveGame: () => void;
}

type ActionType = 'explore' | 'influence' | 'research' | 'upgrade' | 'build' | 'move' | null;

/**
 * Main Eclipse game page for multiplayer mode
 *
 * Displays:
 * - Phase indicator (round, phase, whose turn)
 * - Resource bar (materials, science, money, influence disks, VP)
 * - Galaxy board (center)
 * - Action panel (6 action buttons + Pass)
 */
export default function EclipseGamePage({
  roomId,
  playerId,
  onLeaveGame,
}: EclipseGamePageProps) {
  const [activeAction, setActiveAction] = useState<ActionType>(null);

  // Fetch game state
  const gameState = useQuery(api.queries.game.getGameState, { roomId });
  const playerResources = useQuery(
    api.queries.players.getPlayerResources,
    playerId ? { roomId, playerId } : 'skip'
  );
  const allPlayers = useQuery(api.queries.game.getPlayers, { roomId });

  // Mutations
  const passTurn = useMutation(api.mutations.turns.passTurn);

  // Calculate derived state
  const isMyTurn = gameState?.activePlayerId === playerId;
  const hasPassed = gameState?.passedPlayers?.includes(playerId || '') || false;
  const canAct = isMyTurn && gameState?.currentPhase === 'action' && !hasPassed;

  // Get current player name
  const currentPlayerName = allPlayers?.find(p => p.playerId === gameState?.activePlayerId)?.playerName || 'Unknown';

  // Handle pass action
  const handlePass = async () => {
    if (!playerId || !canAct) return;

    try {
      await passTurn({ roomId, playerId });
    } catch (error) {
      console.error('Failed to pass turn:', error);
      alert(`Failed to pass: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle action button clicks
  const handleActionClick = (action: ActionType) => {
    if (!canAct) {
      alert("It's not your turn or you've already passed!");
      return;
    }
    setActiveAction(action);
  };

  // Close action overlay
  const handleCloseAction = () => {
    setActiveAction(null);
  };

  if (!gameState || !playerResources) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Phase Indicator Bar */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-gray-400 text-sm">Round</span>
            <div className="text-2xl font-bold text-blue-400">
              {gameState.currentRound || 1}
            </div>
          </div>

          <div>
            <span className="text-gray-400 text-sm">Phase</span>
            <div className="text-lg font-semibold text-green-400 capitalize">
              {gameState.currentPhase || 'setup'}
            </div>
          </div>

          <div>
            <span className="text-gray-400 text-sm">Current Turn</span>
            <div className="text-lg font-semibold text-yellow-400">
              {isMyTurn ? 'Your Turn' : currentPlayerName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePass}
            disabled={!canAct}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              canAct
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Pass
          </button>

          <button
            onClick={onLeaveGame}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
          >
            Leave Game
          </button>
        </div>
      </div>

      {/* Resource Bar */}
      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex items-center justify-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-orange-500"></div>
            <span className="text-sm text-gray-400">Materials:</span>
            <span className="text-lg font-bold">{playerResources.materials}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-500"></div>
            <span className="text-sm text-gray-400">Science:</span>
            <span className="text-lg font-bold">{playerResources.science}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-yellow-500"></div>
            <span className="text-sm text-gray-400">Money:</span>
            <span className="text-lg font-bold">{playerResources.money}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-500"></div>
            <span className="text-sm text-gray-400">Influence:</span>
            <span className="text-lg font-bold">{playerResources.usedInfluenceDisks}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">
              VP
            </div>
            <span className="text-sm text-gray-400">Victory Points:</span>
            <span className="text-lg font-bold text-green-400">{playerResources.victoryPoints}</span>
          </div>
        </div>
      </div>

      {/* Galaxy Board (Center) */}
      <div className="flex-1 p-4 overflow-hidden">
        <ConnectedGalaxyBoard
          roomId={roomId}
          onSectorClick={(sectorId) => console.log('Sector clicked:', sectorId)}
          onSectorHover={(sectorId) => console.log('Sector hover:', sectorId)}
          showCoordinates={true}
          enableZoom={true}
        />
      </div>

      {/* Action Panel (Bottom) */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <ActionButton
            label="Explore"
            onClick={() => handleActionClick('explore')}
            disabled={!canAct}
            color="blue"
          />

          <ActionButton
            label="Influence"
            onClick={() => handleActionClick('influence')}
            disabled={!canAct}
            color="purple"
          />

          <ActionButton
            label="Research"
            onClick={() => handleActionClick('research')}
            disabled={!canAct}
            color="cyan"
          />

          <ActionButton
            label="Upgrade"
            onClick={() => handleActionClick('upgrade')}
            disabled={!canAct}
            color="yellow"
          />

          <ActionButton
            label="Build"
            onClick={() => handleActionClick('build')}
            disabled={!canAct}
            color="orange"
          />

          <ActionButton
            label="Move"
            onClick={() => handleActionClick('move')}
            disabled={!canAct}
            color="green"
          />
        </div>
      </div>

      {/* Action Overlay */}
      {activeAction && (
        <ActionOverlay
          action={activeAction}
          onClose={handleCloseAction}
        />
      )}
    </div>
  );
}

// Action Button Component
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  color: 'blue' | 'purple' | 'cyan' | 'yellow' | 'orange' | 'green';
}

function ActionButton({ label, onClick, disabled, color }: ActionButtonProps) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    cyan: 'bg-cyan-600 hover:bg-cyan-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    orange: 'bg-orange-600 hover:bg-orange-700',
    green: 'bg-green-600 hover:bg-green-700',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 rounded-lg font-bold text-white transition-all transform ${
        disabled
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : `${colorClasses[color]} hover:scale-105 active:scale-95`
      }`}
    >
      {label}
    </button>
  );
}

// Action Overlay Component (Placeholder)
interface ActionOverlayProps {
  action: ActionType;
  onClose: () => void;
}

function ActionOverlay({ action, onClose }: ActionOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white capitalize">
            {action} Action
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="text-gray-300 mb-6">
          <p>Select target for {action} action.</p>
          <p className="text-sm text-gray-500 mt-2">
            (Action UI will be implemented here)
          </p>
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
