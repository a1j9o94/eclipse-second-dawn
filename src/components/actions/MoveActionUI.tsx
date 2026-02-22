import { useState } from 'react';
import { HexGrid, Layout, Hexagon, Text } from 'react-hexgrid';
import type { EclipseSector } from '../../types/eclipse-sectors';
import type { Id } from '../../../convex/_generated/dataModel';

interface Ship {
  id: Id<"ships">;
  sectorId: Id<"sectors">;
  playerId: string;
  blueprintId: Id<"blueprints">;
  isDestroyed: boolean;
  usedThisRound?: boolean;
}

interface MoveActionUIProps {
  roomId: Id<"rooms">;
  playerId: string;
  sectors: EclipseSector[];
  ships: Ship[];
  onMove: (shipId: Id<"ships">, toSectorId: Id<"sectors">) => Promise<void>;
  onCancel: () => void;
}

/**
 * UI for the Move action - allows player to move ships to adjacent sectors
 */
export default function MoveActionUI({
  playerId,
  sectors,
  ships,
  onMove,
  onCancel,
}: MoveActionUIProps) {
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [targetSector, setTargetSector] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Get player's ships that haven't moved this round
  const availableShips = ships.filter(
    s => s.playerId === playerId && !s.isDestroyed && !s.usedThisRound
  );

  // Calculate adjacent sectors to the selected ship's position
  const getAdjacentSectors = (sectorId: Id<"sectors">): EclipseSector[] => {
    const currentSector = sectors.find(s => s.id === sectorId);
    if (!currentSector?.coordinates) return [];

    const { q, r } = currentSector.coordinates;

    const adjacent = [
      { q: q + 1, r: r },
      { q: q - 1, r: r },
      { q: q + 1, r: r - 1 },
      { q: q - 1, r: r + 1 },
      { q: q, r: r + 1 },
      { q: q, r: r - 1 },
    ];

    return sectors.filter(sector => {
      if (!sector.coordinates) return false;
      return adjacent.some(
        pos => pos.q === sector.coordinates!.q && pos.r === sector.coordinates!.r
      );
    });
  };

  const adjacentSectors = selectedShip
    ? getAdjacentSectors(selectedShip.sectorId)
    : [];

  const handleMove = async () => {
    if (!selectedShip || !targetSector) return;

    setIsMoving(true);
    try {
      await onMove(selectedShip.id, targetSector as Id<"sectors">);
      setSelectedShip(null);
      setTargetSector(null);
    } catch (error) {
      console.error('Move action failed:', error);
      alert(`Move failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsMoving(false);
    }
  };

  // Group ships by sector for display
  const shipsBySector = new Map<string, Ship[]>();
  availableShips.forEach(ship => {
    const existing = shipsBySector.get(ship.sectorId) || [];
    existing.push(ship);
    shipsBySector.set(ship.sectorId, existing);
  });

  return (
    <div className="move-action-ui">
      <div className="action-header">
        <h2>Move Action</h2>
        <p>Select a ship, then select an adjacent sector to move to</p>
      </div>

      <div className="action-controls">
        <button
          onClick={handleMove}
          disabled={!selectedShip || !targetSector || isMoving}
          className="btn-primary"
        >
          {isMoving ? 'Moving...' : 'Confirm Move'}
        </button>
        <button onClick={onCancel} disabled={isMoving} className="btn-secondary">
          Cancel
        </button>
      </div>

      <div className="ship-selector">
        <h3>Available Ships ({availableShips.length})</h3>
        <div className="ship-list">
          {availableShips.length === 0 ? (
            <p className="no-ships">No ships available to move</p>
          ) : (
            availableShips.map((ship) => {
              const sector = sectors.find(s => s.id === ship.sectorId);
              const isSelected = selectedShip?.id === ship.id;

              return (
                <button
                  key={ship.id}
                  onClick={() => {
                    setSelectedShip(ship);
                    setTargetSector(null);
                  }}
                  className={`ship-button ${isSelected ? 'selected' : ''}`}
                >
                  <div className="ship-name">Ship {ship.id.slice(-4)}</div>
                  <div className="ship-location">
                    {sector?.coordinates
                      ? `(${sector.coordinates.q}, ${sector.coordinates.r})`
                      : 'Unknown'}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="galaxy-view">
        <HexGrid width={1200} height={800}>
          <Layout size={{ x: 7, y: 7 }} flat={true} spacing={1.05}>
            {sectors.map((sector) => {
              if (!sector.coordinates) return null;

              const shipsHere = shipsBySector.get(sector.id) || [];
              const hasPlayerShips = shipsHere.length > 0;
              const isCurrentLocation = selectedShip?.sectorId === sector.id;
              const isValidTarget = adjacentSectors.some(s => s.id === sector.id);
              const isSelectedTarget = targetSector === sector.id;

              let fill = '#888';
              let stroke = '#666';
              let strokeWidth = 1;
              let cursor = 'default';

              if (sector.controlledBy === playerId) {
                fill = '#4CAF50';
              }

              if (isCurrentLocation) {
                fill = '#FFA500';
                stroke = '#FF8C00';
                strokeWidth = 3;
              }

              if (isValidTarget) {
                fill = isSelectedTarget ? '#2196F3' : '#64B5F6';
                stroke = isSelectedTarget ? '#0D47A1' : '#2196F3';
                strokeWidth = isSelectedTarget ? 3 : 1;
                cursor = 'pointer';
              }

              const handleClick = () => {
                if (isValidTarget) {
                  setTargetSector(sector.id);
                }
              };

              return (
                <g key={sector.id}>
                  <Hexagon
                    q={sector.coordinates.q}
                    r={sector.coordinates.r}
                    s={sector.coordinates.s}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    onClick={handleClick}
                    style={{ cursor }}
                    className="sector-hex"
                  />
                  {hasPlayerShips && (
                    <Text
                      className="ship-count"
                    >
                      {shipsHere.length}
                    </Text>
                  )}
                </g>
              );
            })}
          </Layout>
        </HexGrid>
      </div>

      <div className="action-info">
        <div className="info-section">
          <h3>Selected Ship</h3>
          {selectedShip ? (
            <>
              <p>Ship ID: {selectedShip.id.slice(-8)}</p>
              <p>
                Location:{' '}
                {
                  sectors.find(s => s.id === selectedShip.sectorId)?.coordinates
                    ? `(${sectors.find(s => s.id === selectedShip.sectorId)!.coordinates!.q}, ${
                        sectors.find(s => s.id === selectedShip.sectorId)!.coordinates!.r
                      })`
                    : 'Unknown'
                }
              </p>
            </>
          ) : (
            <p>No ship selected</p>
          )}
        </div>
        <div className="info-section">
          <h3>Target Sector</h3>
          {targetSector ? (
            <>
              <p>Sector ID: {targetSector.slice(-8)}</p>
              <p>
                Position:{' '}
                {
                  sectors.find(s => s.id === targetSector)?.coordinates
                    ? `(${sectors.find(s => s.id === targetSector)!.coordinates!.q}, ${
                        sectors.find(s => s.id === targetSector)!.coordinates!.r
                      })`
                    : 'Unknown'
                }
              </p>
            </>
          ) : (
            <p>No target selected</p>
          )}
        </div>
        <div className="info-section">
          <h3>Available Moves</h3>
          <p>{adjacentSectors.length} adjacent sectors</p>
        </div>
      </div>

      <style>{`
        .move-action-ui {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: #1a1a1a;
          border-radius: 8px;
        }

        .action-header {
          text-align: center;
        }

        .action-header h2 {
          margin: 0;
          color: #FFA500;
          font-size: 1.5rem;
        }

        .action-header p {
          margin: 0.5rem 0 0;
          color: #888;
        }

        .action-controls {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-primary,
        .btn-secondary {
          padding: 0.75rem 2rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #FFA500;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FF8C00;
          transform: translateY(-2px);
        }

        .btn-primary:disabled {
          background: #666;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-secondary {
          background: #666;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #777;
        }

        .ship-selector {
          background: #222;
          padding: 1rem;
          border-radius: 4px;
        }

        .ship-selector h3 {
          margin: 0 0 0.5rem;
          color: #FFA500;
          font-size: 1rem;
        }

        .ship-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.5rem;
        }

        .no-ships {
          color: #888;
          text-align: center;
          padding: 1rem;
        }

        .ship-button {
          background: #333;
          border: 2px solid #555;
          border-radius: 4px;
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .ship-button:hover {
          background: #444;
          border-color: #666;
        }

        .ship-button.selected {
          background: #FFA500;
          border-color: #FF8C00;
        }

        .ship-name {
          font-weight: 600;
          color: white;
          margin-bottom: 0.25rem;
        }

        .ship-location {
          font-size: 0.85rem;
          color: #ccc;
        }

        .galaxy-view {
          border: 2px solid #333;
          border-radius: 8px;
          overflow: hidden;
          background: #0a0a0a;
        }

        .action-info {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .info-section {
          background: #222;
          padding: 1rem;
          border-radius: 4px;
          text-align: center;
        }

        .info-section h3 {
          margin: 0 0 0.5rem;
          color: #FFA500;
          font-size: 1rem;
        }

        .info-section p {
          margin: 0.25rem 0;
          color: #ccc;
          font-size: 0.9rem;
        }

        .sector-hex {
          transition: all 0.2s;
        }

        .sector-hex:hover {
          opacity: 0.8;
          transform: scale(1.05);
        }

        .ship-count {
          fill: white;
          font-weight: bold;
          font-size: 16px;
          text-anchor: middle;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
