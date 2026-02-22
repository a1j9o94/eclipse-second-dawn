/**
 * Eclipse Second Dawn - Player Board Component
 *
 * Displays player's economy state:
 * - Resource storage (money, science, materials)
 * - Population tracks with production values
 * - Influence track with upkeep cost
 * - Visual representation matching board game aesthetics
 */

import type { PlayerEconomy, ResourceType } from '../../convex/engine/resources';

// ============================================================================
// Types
// ============================================================================

interface PlayerBoardProps {
  economy: PlayerEconomy;
  playerName?: string;
  compact?: boolean;
  className?: string;
}

interface ResourceDisplayProps {
  type: ResourceType;
  amount: number;
  production: number;
  compact?: boolean;
}

interface PopulationTrackProps {
  type: ResourceType;
  cubesRemaining: number;
  productionValue: number;
  maxCubes?: number;
}

interface InfluenceTrackProps {
  onTrack: number;
  onActions: number;
  onSectors: number;
  totalAvailable: number;
  upkeepCost: number;
}

// ============================================================================
// Resource Icons & Colors
// ============================================================================

const RESOURCE_CONFIG: Record<
  ResourceType,
  { color: string; icon: string; label: string }
> = {
  money: {
    color: '#fbbf24', // amber-400
    icon: '💰',
    label: 'Money',
  },
  science: {
    color: '#a78bfa', // violet-400
    icon: '🔬',
    label: 'Science',
  },
  materials: {
    color: '#fb923c', // orange-400
    icon: '⚙️',
    label: 'Materials',
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Single resource display (storage + production)
 */
function ResourceDisplay({ type, amount, production, compact }: ResourceDisplayProps) {
  const config = RESOURCE_CONFIG[type];

  if (compact) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded"
           style={{ backgroundColor: `${config.color}20` }}>
        <span className="text-lg">{config.icon}</span>
        <span className="font-bold" style={{ color: config.color }}>
          {amount}
        </span>
        {production > 0 && (
          <span className="text-xs text-gray-400">+{production}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-3 rounded-lg border-2"
         style={{ borderColor: config.color, backgroundColor: `${config.color}10` }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{config.icon}</span>
        <span className="text-sm font-semibold text-gray-300">{config.label}</span>
      </div>
      <div className="text-3xl font-bold" style={{ color: config.color }}>
        {amount}
      </div>
      {production > 0 && (
        <div className="text-sm text-gray-400 mt-1">
          Income: +{production}/round
        </div>
      )}
    </div>
  );
}

/**
 * Population track visualization
 * Shows cubes deployed (darker) vs remaining on track (lighter)
 */
function PopulationTrack({
  type,
  cubesRemaining,
  productionValue,
  maxCubes = 13,
}: PopulationTrackProps) {
  const config = RESOURCE_CONFIG[type];
  const deployed = maxCubes - cubesRemaining;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{config.label} Track</span>
        <span className="font-bold" style={{ color: config.color }}>
          Production: {productionValue}
        </span>
      </div>

      {/* Visual track with cubes */}
      <div className="flex gap-0.5">
        {Array.from({ length: maxCubes }).map((_, i) => {
          const isDeployed = i < deployed;
          return (
            <div
              key={i}
              className="w-3 h-3 rounded-sm transition-all"
              style={{
                backgroundColor: isDeployed ? config.color : `${config.color}40`,
                opacity: isDeployed ? 1 : 0.3,
              }}
              title={isDeployed ? 'Deployed to sector' : 'On track'}
            />
          );
        })}
      </div>

      <div className="text-xs text-gray-500">
        {deployed} deployed, {cubesRemaining} remaining
      </div>
    </div>
  );
}

/**
 * Influence track visualization
 * Shows disks on track vs used for actions/sectors
 */
function InfluenceTrack({
  onTrack,
  onActions,
  onSectors,
  totalAvailable,
  upkeepCost,
}: InfluenceTrackProps) {

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border-2 border-purple-500 bg-purple-500/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <span className="text-sm font-semibold text-gray-300">Influence</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Upkeep Cost</div>
          <div className="text-lg font-bold text-purple-400">
            {upkeepCost > 0 ? `-${upkeepCost}` : '0'} 💰
          </div>
        </div>
      </div>

      {/* Visual track */}
      <div className="flex gap-0.5">
        {Array.from({ length: totalAvailable }).map((_, i) => {
          const isOnTrack = i < onTrack;
          return (
            <div
              key={i}
              className="w-4 h-4 rounded-full transition-all"
              style={{
                backgroundColor: isOnTrack ? '#a78bfa' : '#6b7280',
                opacity: isOnTrack ? 1 : 0.4,
              }}
              title={isOnTrack ? 'Available on track' : 'In use'}
            />
          );
        })}
      </div>

      {/* Breakdown */}
      <div className="flex gap-4 text-xs text-gray-400">
        <div>
          <span className="text-purple-400 font-semibold">{onTrack}</span> on track
        </div>
        <div>
          <span className="text-blue-400 font-semibold">{onActions}</span> actions
        </div>
        <div>
          <span className="text-green-400 font-semibold">{onSectors}</span> sectors
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Complete player board showing all economy information
 */
export function PlayerBoard({
  economy,
  playerName = 'Player',
  compact = false,
  className = '',
}: PlayerBoardProps) {
  if (compact) {
    return (
      <div className={`flex flex-col gap-2 p-3 rounded-lg bg-gray-800/50 ${className}`}>
        {/* Header */}
        <div className="text-sm font-semibold text-gray-300">{playerName}</div>

        {/* Resources in a row */}
        <div className="flex gap-2">
          <ResourceDisplay
            type="money"
            amount={economy.resources.money}
            production={economy.populationTracks.money.productionValue}
            compact
          />
          <ResourceDisplay
            type="science"
            amount={economy.resources.science}
            production={economy.populationTracks.science.productionValue}
            compact
          />
          <ResourceDisplay
            type="materials"
            amount={economy.resources.materials}
            production={economy.populationTracks.materials.productionValue}
            compact
          />
        </div>

        {/* Influence summary */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            Influence: {economy.influence.onTrack}/{economy.influence.totalAvailable}
          </span>
          <span className="text-purple-400">
            Upkeep: -{economy.influence.upkeepCost} 💰
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 p-6 rounded-xl bg-gray-800/70 border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 pb-3">
        <h2 className="text-xl font-bold text-white">{playerName}</h2>
        <div className="text-sm text-gray-400">Eclipse Second Dawn</div>
      </div>

      {/* Resource Storage */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Resource Storage</h3>
        <div className="grid grid-cols-3 gap-3">
          <ResourceDisplay
            type="money"
            amount={economy.resources.money}
            production={economy.populationTracks.money.productionValue}
          />
          <ResourceDisplay
            type="science"
            amount={economy.resources.science}
            production={economy.populationTracks.science.productionValue}
          />
          <ResourceDisplay
            type="materials"
            amount={economy.resources.materials}
            production={economy.populationTracks.materials.productionValue}
          />
        </div>
      </div>

      {/* Population Tracks */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Population Tracks</h3>
        <div className="flex flex-col gap-3">
          <PopulationTrack
            type="money"
            cubesRemaining={economy.populationTracks.money.cubesRemaining}
            productionValue={economy.populationTracks.money.productionValue}
          />
          <PopulationTrack
            type="science"
            cubesRemaining={economy.populationTracks.science.cubesRemaining}
            productionValue={economy.populationTracks.science.productionValue}
          />
          <PopulationTrack
            type="materials"
            cubesRemaining={economy.populationTracks.materials.cubesRemaining}
            productionValue={economy.populationTracks.materials.productionValue}
          />
        </div>
      </div>

      {/* Influence Track */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Influence</h3>
        <InfluenceTrack
          onTrack={economy.influence.onTrack}
          onActions={economy.influence.onActions}
          onSectors={economy.influence.onSectors}
          totalAvailable={economy.influence.totalAvailable}
          upkeepCost={economy.influence.upkeepCost}
        />
      </div>
    </div>
  );
}

/**
 * Minimal resource bar for in-game HUD
 */
export function ResourceBar({ economy, className = '' }: Omit<PlayerBoardProps, 'playerName' | 'compact'>) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-full bg-gray-900/80 backdrop-blur ${className}`}>
      {/* Money */}
      <div className="flex items-center gap-1">
        <span>💰</span>
        <span className="font-bold text-amber-400">{economy.resources.money}</span>
        {economy.populationTracks.money.productionValue > 0 && (
          <span className="text-xs text-gray-400">
            (+{economy.populationTracks.money.productionValue})
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-gray-600" />

      {/* Science */}
      <div className="flex items-center gap-1">
        <span>🔬</span>
        <span className="font-bold text-violet-400">{economy.resources.science}</span>
        {economy.populationTracks.science.productionValue > 0 && (
          <span className="text-xs text-gray-400">
            (+{economy.populationTracks.science.productionValue})
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-gray-600" />

      {/* Materials */}
      <div className="flex items-center gap-1">
        <span>⚙️</span>
        <span className="font-bold text-orange-400">{economy.resources.materials}</span>
        {economy.populationTracks.materials.productionValue > 0 && (
          <span className="text-xs text-gray-400">
            (+{economy.populationTracks.materials.productionValue})
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-gray-600" />

      {/* Influence */}
      <div className="flex items-center gap-1">
        <span>🎯</span>
        <span className="font-bold text-purple-400">
          {economy.influence.onTrack}/{economy.influence.totalAvailable}
        </span>
        {economy.influence.upkeepCost > 0 && (
          <span className="text-xs text-red-400">-{economy.influence.upkeepCost}💰</span>
        )}
      </div>
    </div>
  );
}

export default PlayerBoard;
