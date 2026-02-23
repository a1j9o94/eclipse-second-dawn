import { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

interface PreCombatUIProps {
  roomId: Id<"rooms">;
  playerId: string;
  isHost: boolean;
  onContinueToCombat: () => void;
}

/**
 * Pre-combat UI allowing players to retreat ships before combat simulation
 * Shows all sectors with potential combat and allows retreat to adjacent sectors
 */
export default function PreCombatUI({
  roomId,
  playerId,
  isHost,
  onContinueToCombat,
}: PreCombatUIProps) {
  const [selectedShipId, setSelectedShipId] = useState<Id<"ships"> | null>(null);
  const [countdown, setCountdown] = useState(15); // 15 second timer

  // Get all ships for the player
  const ships = useQuery(
    api.queries.players.getPlayerShips,
    { roomId, playerId }
  );

  // Get all sectors
  const sectors = useQuery(api.queries.galaxy.getSectors, { roomId });

  // Get player's blueprints to display ship names
  const blueprints = useQuery(
    api.queries.players.getPlayerBlueprints,
    { roomId, playerId }
  );

  // Mutations
  const retreatShip = useMutation(api.mutations.turns.retreatShip);
  const processCombat = useMutation(api.mutations.turns.processCombat);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      handleContinueToCombat();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle continue to combat - process combat then show results
  const handleContinueToCombat = async () => {
    try {
      // Only host should process combat to avoid duplicate processing
      if (isHost) {
        await processCombat({ roomId });
      }
      // Close pre-combat UI to show combat results
      onContinueToCombat();
    } catch (error) {
      console.error('Failed to process combat:', error);
      alert(`Failed to process combat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Find contested sectors (sectors with ships from multiple players)
  const contestedSectors = sectors?.filter(sector => {
    const shipsInSector = ships?.filter(s => s.sectorId === sector._id && !s.isDestroyed) || [];
    // Check if there are enemy ships here (simple check)
    // In a full implementation, would query all ships in sector
    return shipsInSector.length > 0;
  }) || [];

  // Get adjacent sectors for a given sector
  const getAdjacentSectors = (sectorId: Id<"sectors">) => {
    const sector = sectors?.find(s => s._id === sectorId);
    if (!sector) return [];

    return sectors?.filter(s => {
      const distance = Math.max(
        Math.abs(sector.position.q - s.position.q),
        Math.abs(sector.position.r - s.position.r),
        Math.abs((-sector.position.q - sector.position.r) - (-s.position.q - s.position.r))
      );
      return distance === 1;
    }) || [];
  };

  // Handle retreat
  const handleRetreat = async (shipId: Id<"ships">, toSectorId: Id<"sectors">) => {
    try {
      await retreatShip({
        roomId,
        playerId,
        shipId,
        toSectorId,
      });
      setSelectedShipId(null);
    } catch (error) {
      console.error('Failed to retreat:', error);
      alert(`Failed to retreat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle skip countdown
  const handleSkip = () => {
    setCountdown(0);
    handleContinueToCombat();
  };

  if (!ships || !sectors || !blueprints) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
        <div className="text-white text-xl">Loading combat...</div>
      </div>
    );
  }

  // Helper to get blueprint for a ship
  const getBlueprintForShip = (shipBlueprintId: Id<"blueprints">) => {
    return blueprints.find(b => b._id === shipBlueprintId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden border-2 border-yellow-500">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-yellow-400">Combat Imminent!</h2>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-red-400">
                {countdown}s
              </div>
              <button
                onClick={handleSkip}
                className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                Continue to Combat
              </button>
            </div>
          </div>
          <p className="text-gray-300 mt-2">
            You have {countdown} seconds to retreat ships from contested sectors.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {contestedSectors.length === 0 ? (
            <div className="text-center text-gray-400 text-lg py-8">
              You have no ships in contested sectors.
            </div>
          ) : (
            contestedSectors.map(sector => {
              const shipsInSector = ships.filter(s => s.sectorId === sector._id && !s.isDestroyed);
              const adjacentSectors = getAdjacentSectors(sector._id);

              return (
                <div
                  key={sector._id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <h3 className="text-xl font-bold text-white mb-3">
                    Sector ({sector.position.q}, {sector.position.r})
                  </h3>

                  <div className="space-y-2">
                    {shipsInSector.map(ship => {
                      const blueprint = getBlueprintForShip(ship.blueprintId);
                      const shipName = blueprint ? `${blueprint.name} (${blueprint.shipType})` : 'Unknown Ship';

                      return (
                        <div
                          key={ship._id}
                          className="bg-gray-700 rounded p-3 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-white">
                              {shipName} - {ship.damage > 0 ? `${ship.damage} damage` : 'Undamaged'}
                            </div>
                          </div>

                        {selectedShipId === ship._id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300">Retreat to:</span>
                            {adjacentSectors.map(adjSector => (
                              <button
                                key={adjSector._id}
                                onClick={() => handleRetreat(ship._id, adjSector._id)}
                                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                              >
                                ({adjSector.position.q}, {adjSector.position.r})
                              </button>
                            ))}
                            <button
                              onClick={() => setSelectedShipId(null)}
                              className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-700 text-white text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedShipId(ship._id)}
                            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold"
                          >
                            Retreat
                          </button>
                        )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <div className="text-center text-sm text-gray-400">
            Ships that retreat will move to an adjacent sector and won't participate in combat.
            <br />
            Combat will begin automatically when the timer reaches 0.
          </div>
        </div>
      </div>
    </div>
  );
}
