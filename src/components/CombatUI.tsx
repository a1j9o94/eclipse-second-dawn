import { useState, useEffect } from 'react';
import type { SimulateResult } from '../../convex/engine/combat';
import type { ShipSnap } from '../../convex/engine/combat';

interface CombatUIProps {
  combatResult: SimulateResult;
  playerAName: string;
  playerBName: string;
  onClose: () => void;
}

/**
 * CombatUI component displays combat simulation results
 * Shows two fleets facing each other with dice rolls, damage, and round progression
 */
export default function CombatUI({
  combatResult,
  playerAName,
  playerBName,
  onClose,
}: CombatUIProps) {
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per log entry

  // Auto-advance through combat log
  useEffect(() => {
    if (!autoPlay || currentLogIndex >= combatResult.roundLog.length - 1) {
      return;
    }

    const timer = setTimeout(() => {
      setCurrentLogIndex((prev) => prev + 1);
    }, playbackSpeed);

    return () => clearTimeout(timer);
  }, [currentLogIndex, autoPlay, playbackSpeed, combatResult.roundLog.length]);

  const currentLog = combatResult.roundLog.slice(0, currentLogIndex + 1);
  const isComplete = currentLogIndex >= combatResult.roundLog.length - 1;

  // Extract current round number from log
  const getCurrentRound = () => {
    const roundLines = currentLog.filter((line) => line.startsWith('—'));
    return roundLines.length;
  };

  // For now, show final state
  // In a more advanced version, we could parse the log to show progressive damage
  const fleetA = combatResult.finalA;
  const fleetB = combatResult.finalB;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden border-2 border-red-500">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-red-400">Combat Resolution</h2>
            <div className="flex items-center gap-4">
              <div className="text-xl font-semibold text-gray-300">
                Round {getCurrentRound()}
              </div>
              {isComplete && (
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  Return to Game
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Combat Arena */}
        <div className="p-6 space-y-6">
          {/* Player A Fleet */}
          <div className="bg-blue-900 bg-opacity-30 border-2 border-blue-500 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-blue-300">
                {playerAName} (Attacker)
              </h3>
              <div className="text-sm text-gray-400">
                {fleetA.filter((s) => s.alive).length} / {fleetA.length} ships
              </div>
            </div>
            <div className="flex gap-4 flex-wrap">
              {fleetA.map((ship, idx) => (
                <ShipCard key={idx} ship={ship} side="A" />
              ))}
            </div>
          </div>

          {/* Combat Log */}
          <div className="bg-gray-800 rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-300">Combat Log</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoPlay(!autoPlay)}
                  className={`px-3 py-1 rounded text-sm font-semibold ${
                    autoPlay
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {autoPlay ? 'Pause' : 'Play'}
                </button>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="px-2 py-1 rounded bg-gray-700 text-white text-sm"
                >
                  <option value={500}>2x Speed</option>
                  <option value={1000}>1x Speed</option>
                  <option value={2000}>0.5x Speed</option>
                </select>
                {!isComplete && (
                  <button
                    onClick={() =>
                      setCurrentLogIndex(combatResult.roundLog.length - 1)
                    }
                    className="px-3 py-1 rounded text-sm font-semibold bg-gray-600 hover:bg-gray-700"
                  >
                    Skip to End
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1 text-sm font-mono">
              {currentLog.map((line, idx) => {
                const isRoundHeader = line.startsWith('—');
                const isWinner = line.startsWith('Winner:');
                const isDestruction = line.includes('💥');

                return (
                  <div
                    key={idx}
                    className={`${
                      isRoundHeader
                        ? 'text-yellow-400 font-bold text-base mt-2'
                        : isWinner
                        ? 'text-green-400 font-bold text-lg mt-2'
                        : isDestruction
                        ? 'text-red-400 font-semibold'
                        : 'text-gray-300'
                    }`}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player B Fleet */}
          <div className="bg-red-900 bg-opacity-30 border-2 border-red-500 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-red-300">
                {playerBName} (Defender)
              </h3>
              <div className="text-sm text-gray-400">
                {fleetB.filter((s) => s.alive).length} / {fleetB.length} ships
              </div>
            </div>
            <div className="flex gap-4 flex-wrap">
              {fleetB.map((ship, idx) => (
                <ShipCard key={idx} ship={ship} side="B" />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        {isComplete && (
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-2">
                Combat Complete!
              </div>
              <div className="text-lg text-gray-300">
                Winner:{' '}
                {combatResult.winnerPlayerId === 'playerA'
                  ? playerAName
                  : playerBName}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ShipCardProps {
  ship: ShipSnap;
  side: 'A' | 'B';
}

function ShipCard({ ship, side }: ShipCardProps) {
  const isAlive = ship.alive && ship.hull > 0;
  const hullPercent = Math.max(
    0,
    Math.min(100, (ship.hull / ship.stats.hullCap) * 100)
  );

  const sideColor = side === 'A' ? 'blue' : 'red';
  const borderColor =
    side === 'A' ? 'border-blue-400' : 'border-red-400';
  const bgColor =
    side === 'A'
      ? isAlive
        ? 'bg-blue-900'
        : 'bg-gray-800'
      : isAlive
      ? 'bg-red-900'
      : 'bg-gray-800';

  return (
    <div
      className={`relative border-2 ${borderColor} ${bgColor} rounded-lg p-3 w-32 ${
        !isAlive ? 'opacity-40 grayscale' : ''
      }`}
    >
      {/* Ship name */}
      <div className="text-sm font-bold text-white mb-2 truncate">
        {ship.frame.name}
      </div>

      {/* HP Bar */}
      <div className="mb-2">
        <div className="text-xs text-gray-300 mb-1">
          HP: {ship.hull} / {ship.stats.hullCap}
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              sideColor === 'blue' ? 'bg-blue-400' : 'bg-red-400'
            } transition-all duration-300`}
            style={{ width: `${hullPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-300 space-y-1">
        <div>Init: {ship.stats.init}</div>
        <div>Weapons: {ship.weapons.length}</div>
        {ship.riftDice > 0 && <div>Rift: {ship.riftDice}</div>}
      </div>

      {/* Destroyed overlay */}
      {!isAlive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-4xl">💥</div>
        </div>
      )}
    </div>
  );
}
