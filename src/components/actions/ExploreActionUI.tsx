import { useState } from 'react';
import { HexGrid, Layout, Hexagon } from 'react-hexgrid';
import type { EclipseSector } from '../../types/eclipse-sectors';
import type { Id } from '../../../convex/_generated/dataModel';

interface ExploreActionUIProps {
  roomId: Id<"rooms">;
  playerId: string;
  sectors: EclipseSector[];
  onExplore: (position: { q: number; r: number }) => Promise<void>;
  onCancel: () => void;
}

/**
 * UI for the Explore action - allows player to select an empty adjacent position
 * to place a new sector tile
 */
export default function ExploreActionUI({
  playerId,
  sectors,
  onExplore,
  onCancel,
}: ExploreActionUIProps) {
  const [selectedPosition, setSelectedPosition] = useState<{ q: number; r: number } | null>(null);
  const [isExploring, setIsExploring] = useState(false);

  // Get all occupied positions
  const occupiedPositions = new Set(
    sectors.map(s => `${s.coordinates?.q},${s.coordinates?.r}`)
  );

  // Calculate valid exploration positions (adjacent to controlled sectors)
  const validPositions = new Set<string>();

  sectors.forEach(sector => {
    if (sector.controlledBy === playerId && sector.coordinates) {
      const { q, r } = sector.coordinates;

      // Six adjacent hex positions in axial coordinates
      const adjacent = [
        { q: q + 1, r: r },     // East
        { q: q - 1, r: r },     // West
        { q: q + 1, r: r - 1 }, // Northeast
        { q: q - 1, r: r + 1 }, // Southwest
        { q: q, r: r + 1 },     // Southeast
        { q: q, r: r - 1 },     // Northwest
      ];

      adjacent.forEach(pos => {
        const key = `${pos.q},${pos.r}`;
        if (!occupiedPositions.has(key)) {
          validPositions.add(key);
        }
      });
    }
  });

  // Convert valid positions to array for rendering
  const validPositionsList = Array.from(validPositions).map(key => {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  });

  const handleExplore = async () => {
    if (!selectedPosition) return;

    setIsExploring(true);
    try {
      await onExplore(selectedPosition);
    } catch (error) {
      console.error('Explore action failed:', error);
      alert(`Explore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExploring(false);
    }
  };

  return (
    <div className="explore-action-ui">
      <div className="action-header">
        <h2>Explore Action</h2>
        <p>Select an adjacent position to place a new sector tile</p>
      </div>

      <div className="action-controls">
        <button
          onClick={handleExplore}
          disabled={!selectedPosition || isExploring}
          className="btn-primary"
        >
          {isExploring ? 'Exploring...' : 'Confirm Explore'}
        </button>
        <button onClick={onCancel} disabled={isExploring} className="btn-secondary">
          Cancel
        </button>
      </div>

      <div className="galaxy-view">
        <HexGrid width={1200} height={800}>
          <Layout size={{ x: 7, y: 7 }} flat={true} spacing={1.05}>
            {/* Render existing sectors */}
            {sectors.map((sector) => {
              if (!sector.coordinates) return null;

              const isControlled = sector.controlledBy === playerId;

              return (
                <Hexagon
                  key={sector.id}
                  q={sector.coordinates.q}
                  r={sector.coordinates.r}
                  s={sector.coordinates.s}
                  fill={isControlled ? '#4CAF50' : '#888'}
                  className="existing-sector"
                />
              );
            })}

            {/* Render valid exploration positions */}
            {validPositionsList.map((pos) => {
              const isSelected =
                selectedPosition?.q === pos.q && selectedPosition?.r === pos.r;
              const s = -(pos.q + pos.r);

              return (
                <Hexagon
                  key={`${pos.q},${pos.r}`}
                  q={pos.q}
                  r={pos.r}
                  s={s}
                  fill={isSelected ? '#FFD700' : '#4CAF5080'}
                  stroke={isSelected ? '#FFA500' : '#4CAF50'}
                  strokeWidth={isSelected ? 3 : 1}
                  className="valid-position"
                  onClick={() => setSelectedPosition(pos)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
          </Layout>
        </HexGrid>
      </div>

      <div className="action-info">
        <p>
          <strong>Valid positions:</strong> {validPositionsList.length}
        </p>
        {selectedPosition && (
          <p>
            <strong>Selected:</strong> ({selectedPosition.q}, {selectedPosition.r})
          </p>
        )}
      </div>

      <style>{`
        .explore-action-ui {
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
          color: #4CAF50;
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
          background: #4CAF50;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #45a049;
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

        .galaxy-view {
          border: 2px solid #333;
          border-radius: 8px;
          overflow: hidden;
          background: #0a0a0a;
        }

        .action-info {
          text-align: center;
          color: #ccc;
        }

        .action-info p {
          margin: 0.25rem 0;
        }

        .existing-sector {
          opacity: 0.6;
        }

        .valid-position {
          transition: all 0.2s;
        }

        .valid-position:hover {
          opacity: 0.8;
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}
