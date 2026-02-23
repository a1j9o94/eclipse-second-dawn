import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import ConnectedGalaxyBoard from '../components/galaxy/ConnectedGalaxyBoard';
import { useGameActions } from '../hooks/useGameActions';
import ExploreActionUI from '../components/actions/ExploreActionUI';
import InfluenceActionUI from '../components/actions/InfluenceActionUI';
import TechnologyTree from '../components/TechnologyTree';
import BuildActionUI from '../components/actions/BuildActionUI';
import UpgradeActionUI from '../components/actions/UpgradeActionUI';
import MoveActionUI from '../components/actions/MoveActionUI';
import CombatUI from '../components/CombatUI';
import PreCombatUI from '../components/PreCombatUI';
import VictoryScreen from '../components/VictoryScreen';
import type { EclipseSector } from '../types/eclipse-sectors';

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

  // Fetch sectors and ships for action UIs
  const sectors = useQuery(api.queries.galaxy.getSectors, { roomId });
  const ships = useQuery(
    api.queries.players.getPlayerShips,
    playerId ? { roomId, playerId } : 'skip'
  );

  // Fetch combat results for current round
  const combatResults = useQuery(api.queries.game.getCurrentRoundCombatResults, { roomId });

  // Mutations
  const passTurn = useMutation(api.mutations.turns.passTurn);
  const advanceToNextPhase = useMutation(api.mutations.turns.advanceToNextPhase);

  // Game actions
  const actions = useGameActions();

  // Calculate derived state
  const isMyTurn = gameState?.activePlayerId === playerId;
  const hasPassed = gameState?.passedPlayers?.includes(playerId || '') || false;
  const canAct = isMyTurn && gameState?.currentPhase === 'action' && !hasPassed;

  // Get current player name and host status
  const currentPlayerName = allPlayers?.find(p => p.playerId === gameState?.activePlayerId)?.playerName || 'Unknown';
  const isHost = allPlayers?.find(p => p.playerId === playerId)?.isHost || false;

  // State for pass confirmation
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  // State for combat display
  const [currentCombatIndex, setCurrentCombatIndex] = useState(0);
  const [showPreCombat, setShowPreCombat] = useState(true);

  // Reset pre-combat flag when entering combat phase
  useEffect(() => {
    if (gameState?.currentPhase === 'combat') {
      setShowPreCombat(true);
    }
  }, [gameState?.currentPhase]);

  // Auto-advance phases when all players pass
  useEffect(() => {
    if (!gameState || !allPlayers || !playerId) return;

    const currentPlayer = allPlayers.find(p => p.playerId === playerId);
    const isHost = currentPlayer?.isHost || false;

    // Only host should trigger auto-advance
    if (!isHost) return;

    const allPlayerIds = allPlayers.map(p => p.playerId);
    const passedPlayerIds = gameState.passedPlayers || [];

    // Check if all players have passed during action phase
    if (
      gameState.currentPhase === 'action' &&
      allPlayerIds.length > 0 &&
      passedPlayerIds.length === allPlayerIds.length &&
      allPlayerIds.every(id => passedPlayerIds.includes(id))
    ) {
      // All players passed, advance to next phase
      console.log('All players passed, auto-advancing phase...');
      advanceToNextPhase({ roomId })
        .then(() => console.log('Phase advanced successfully'))
        .catch((error) => console.error('Failed to auto-advance phase:', error));
    }

    // For non-action phases, auto-advance quickly (upkeep, income, cleanup are server-handled)
    // Combat phase is NOT auto-advanced because it requires player interaction (retreat)
    if (
      gameState.currentPhase !== 'action' &&
      gameState.currentPhase !== 'setup' &&
      gameState.currentPhase !== 'finished' &&
      gameState.currentPhase !== 'combat' // Don't auto-advance combat
    ) {
      // Short delay to let server process, then advance
      const timer = setTimeout(() => {
        console.log(`Auto-advancing ${gameState.currentPhase} phase...`);
        advanceToNextPhase({ roomId })
          .then(() => console.log('Phase advanced successfully'))
          .catch((error) => console.error('Failed to auto-advance phase:', error));
      }, 1500); // 1.5 second delay for visual feedback

      return () => clearTimeout(timer);
    }
  }, [gameState, allPlayers, playerId, roomId, advanceToNextPhase]);

  // Handle pass action
  const handlePass = async () => {
    if (!playerId || !canAct) return;

    try {
      await passTurn({ roomId, playerId });
      setShowPassConfirm(false);
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

  // Convert sectors to EclipseSector format for action UIs
  const eclipseSectors: EclipseSector[] = (sectors || []).map(sector => ({
    id: sector._id,
    ring: sector.type === 'center' ? 'center' : sector.type === 'inner' ? 'inner' : 'outer',
    explored: true,
    orientation: sector.rotation as 0 | 1 | 2 | 3 | 4 | 5,
    coordinates: {
      q: sector.position.q,
      r: sector.position.r,
      s: -(sector.position.q + sector.position.r),
    },
    populationSquares: sector.planets.map(planet => ({
      type: planet.type as 'money' | 'science' | 'materials',
      advanced: planet.isAdvanced,
      resources: planet.isAdvanced ? 2 : 1,
    })),
    wormholes: sector.warpPortals.map(portal => ({
      direction: portal as 0 | 1 | 2 | 3 | 4 | 5,
      type: 'normal' as const,
    })),
    discoveryTile: sector.hasDiscoveryTile ? {
      id: `discovery-${sector._id}`,
      revealed: false,
      ancientCount: sector.hasAncient ? 1 : 0,
    } : undefined,
    controlledBy: sector.controlledBy || undefined,
    influenceDisk: sector.controlledBy || undefined,
    ships: [],
    ancients: [],
  }));

  // Action handlers
  const handleExplore = async (position: { q: number; r: number }) => {
    if (!playerId) return;
    const result = await actions.explore({ roomId, playerId, position });
    if (result.success) {
      setActiveAction(null);
    } else {
      alert(result.error);
    }
  };

  const handleInfluence = async (args: {
    retrieveFrom?: Id<"sectors">[];
    placeTo?: Id<"sectors">[];
  }) => {
    if (!playerId) return;
    const result = await actions.influence({
      roomId,
      playerId,
      retrieveFrom: args.retrieveFrom,
      placeTo: args.placeTo,
    });
    if (result.success) {
      setActiveAction(null);
    } else {
      alert(result.error);
    }
  };

  const handleBuild = async (blueprintId: Id<"blueprints">, sectorId: Id<"sectors">) => {
    if (!playerId) return;
    const result = await actions.build({
      roomId,
      playerId,
      blueprintId,
      sectorId,
    });
    if (result.success) {
      setActiveAction(null);
    } else {
      alert(result.error);
    }
  };

  const handleUpgrade = async (
    blueprintId: Id<"blueprints">,
    removeParts: Id<"parts">[],
    addParts: Id<"parts">[]
  ) => {
    if (!playerId) return;
    const result = await actions.upgrade({
      roomId,
      playerId,
      blueprintId,
      removeParts,
      addParts,
    });
    if (result.success) {
      setActiveAction(null);
    } else {
      alert(result.error);
    }
  };

  const handleMove = async (shipId: Id<"ships">, toSectorId: Id<"sectors">) => {
    if (!playerId) return;
    const ship = ships?.find(s => s._id === shipId);
    if (!ship) {
      alert('Ship not found');
      return;
    }
    const result = await actions.move({
      roomId,
      playerId,
      shipIds: [shipId],
      fromSectorId: ship.sectorId,
      toSectorId,
    });
    if (result.success) {
      // Don't close modal, allow multiple moves
    } else {
      alert(result.error);
    }
  };

  if (!gameState || !playerResources) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  // Show victory screen if game is finished
  if (gameState.currentPhase === 'finished') {
    return <VictoryScreen roomId={roomId} onReturnToLobby={onLeaveGame} />;
  }

  // Phase color coding
  const getPhaseColor = (phase: string | undefined) => {
    switch (phase) {
      case 'action':
        return 'text-green-400';
      case 'combat':
        return 'text-red-400';
      case 'upkeep':
        return 'text-yellow-400';
      case 'cleanup':
        return 'text-purple-400';
      case 'finished':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Phase Indicator Bar */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-gray-400 text-sm">Round</span>
              <div className="text-3xl font-bold text-blue-400">
                {gameState.currentRound || 1}
              </div>
            </div>

            <div>
              <span className="text-gray-400 text-sm block">Phase</span>
              <div className={`text-2xl font-bold capitalize ${getPhaseColor(gameState.currentPhase)}`}>
                {gameState.currentPhase || 'setup'}
              </div>
            </div>

            <div>
              <span className="text-gray-400 text-sm block">Turn Status</span>
              <div className="text-xl font-semibold">
                {hasPassed ? (
                  <span className="text-gray-500">Passed</span>
                ) : isMyTurn ? (
                  <span className="text-green-400 animate-pulse">Your Turn!</span>
                ) : (
                  <span className="text-yellow-400">Waiting for {currentPlayerName}...</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {canAct && (
              <button
                onClick={() => setShowPassConfirm(true)}
                className="px-8 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
              >
                Pass Turn
              </button>
            )}

            <button
              onClick={onLeaveGame}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
            >
              Leave Game
            </button>
          </div>
        </div>

        {/* Player Pass Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Players:</span>
          {allPlayers?.map((player) => {
            const passed = gameState?.passedPlayers?.includes(player.playerId) || false;
            return (
              <div
                key={player.playerId}
                className={`px-3 py-1 rounded ${
                  passed
                    ? 'bg-gray-700 text-gray-400'
                    : player.playerId === gameState?.activePlayerId
                    ? 'bg-green-700 text-white'
                    : 'bg-blue-700 text-white'
                }`}
              >
                {player.playerName}
                {passed && ' (Passed)'}
                {player.playerId === gameState?.activePlayerId && !passed && ' (Active)'}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pass Confirmation Modal */}
      {showPassConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-4">Pass Turn?</h2>
            <p className="text-gray-300 mb-6">
              Are you sure you want to pass? You will not be able to take any more actions this round.
            </p>
            <div className="flex gap-4">
              <button
                onClick={handlePass}
                className="flex-1 px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                Yes, Pass
              </button>
              <button
                onClick={() => setShowPassConfirm(false)}
                className="flex-1 px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Action Modals */}
      {activeAction === 'explore' && playerId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-6xl w-full mx-4 border border-gray-700 max-h-[90vh] overflow-auto">
            <ExploreActionUI
              roomId={roomId}
              playerId={playerId}
              sectors={eclipseSectors}
              onExplore={handleExplore}
              onCancel={handleCloseAction}
            />
          </div>
        </div>
      )}

      {activeAction === 'influence' && playerId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-6xl w-full mx-4 border border-gray-700 max-h-[90vh] overflow-auto">
            <InfluenceActionUI
              roomId={roomId}
              playerId={playerId}
              sectors={eclipseSectors}
              onInfluence={handleInfluence}
              onCancel={handleCloseAction}
            />
          </div>
        </div>
      )}

      {activeAction === 'research' && playerId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-6xl w-full mx-4 border border-gray-700 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Research Technology</h2>
              <button
                onClick={handleCloseAction}
                className="text-gray-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div onClick={(e) => {
              // Check if the research completed successfully
              // TechnologyTree handles its own research, we just close the modal
              const target = e.target as HTMLElement;
              if (target.closest('.tech-tile-researched')) {
                setTimeout(() => setActiveAction(null), 500);
              }
            }}>
              <TechnologyTree roomId={roomId} playerId={playerId} />
            </div>
          </div>
        </div>
      )}

      {activeAction === 'build' && playerId && (
        <BuildActionUI
          roomId={roomId}
          playerId={playerId}
          onBuild={handleBuild}
          onCancel={handleCloseAction}
        />
      )}

      {activeAction === 'upgrade' && playerId && (
        <UpgradeActionUI
          roomId={roomId}
          playerId={playerId}
          onUpgrade={handleUpgrade}
          onCancel={handleCloseAction}
        />
      )}

      {activeAction === 'move' && playerId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-6xl w-full mx-4 border border-gray-700 max-h-[90vh] overflow-auto">
            <MoveActionUI
              roomId={roomId}
              playerId={playerId}
              sectors={eclipseSectors}
              ships={ships || []}
              onMove={handleMove}
              onCancel={handleCloseAction}
            />
          </div>
        </div>
      )}

      {/* Pre-Combat UI - Allow retreat before combat simulation */}
      {gameState.currentPhase === 'combat' && playerId && showPreCombat && (
        <PreCombatUI
          roomId={roomId}
          playerId={playerId}
          isHost={isHost}
          onContinueToCombat={() => {
            setShowPreCombat(false);
          }}
        />
      )}

      {/* Combat Phase UI */}
      {gameState.currentPhase === 'combat' && !showPreCombat && combatResults && combatResults.length > 0 && (
        <CombatUI
          combatResult={{
            winnerPlayerId: combatResults[currentCombatIndex]?.winner || '',
            roundLog: combatResults[currentCombatIndex]?.events.map(e => e.data) || [],
            finalA: [],
            finalB: [],
          }}
          playerAName={
            allPlayers?.find(p => p.playerId === combatResults[currentCombatIndex]?.attackerId)?.playerName || 'Player A'
          }
          playerBName={
            allPlayers?.find(p => p.playerId === combatResults[currentCombatIndex]?.defenderId)?.playerName || 'Player B'
          }
          onClose={() => {
            // Move to next combat or advance phase
            if (currentCombatIndex < combatResults.length - 1) {
              setCurrentCombatIndex(currentCombatIndex + 1);
            } else {
              setCurrentCombatIndex(0);
              // Advance to next phase
              if (isHost) {
                advanceToNextPhase({ roomId })
                  .then(() => console.log('Phase advanced successfully'))
                  .catch((error) => console.error('Failed to advance phase:', error));
              }
            }
          }}
        />
      )}

      {/* No Combat Message */}
      {gameState.currentPhase === 'combat' && !showPreCombat && combatResults && combatResults.length === 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md border-2 border-gray-700">
            <h2 className="text-2xl font-bold text-gray-300 mb-4">Combat Phase</h2>
            <p className="text-lg text-gray-400 mb-6">
              No combat this round. All sectors are peaceful.
            </p>
            <button
              onClick={() => {
                if (isHost) {
                  advanceToNextPhase({ roomId })
                    .then(() => console.log('Phase advanced successfully'))
                    .catch((error) => console.error('Failed to advance phase:', error));
                }
              }}
              className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              {isHost ? 'Continue to Next Phase' : 'Waiting for host...'}
            </button>
          </div>
        </div>
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

