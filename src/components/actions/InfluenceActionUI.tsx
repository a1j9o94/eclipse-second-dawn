import { useState } from 'react';
import { HexGrid, Layout, Hexagon } from 'react-hexgrid';
import type { EclipseSector } from '../../types/eclipse-sectors';
import type { Id } from '../../../convex/_generated/dataModel';

interface InfluenceActionUIProps {
  roomId: Id<"rooms">;
  playerId: string;
  sectors: EclipseSector[];
  onInfluence: (args: {
    retrieveFrom?: Id<"sectors">[];
    placeTo?: Id<"sectors">[];
  }) => Promise<void>;
  onCancel: () => void;
}

type ActionMode = 'retrieve' | 'place';

/**
 * UI for the Influence action - allows player to:
 * 1. Retrieve influence disks from controlled sectors (up to 2)
 * 2. Place influence disks in adjacent sectors (up to 2)
 * 3. Refresh colony ships (automatic, up to 2)
 */
export default function InfluenceActionUI({
  playerId,
  sectors,
  onInfluence,
  onCancel,
}: InfluenceActionUIProps) {
  const [mode, setMode] = useState<ActionMode>('place');
  const [retrieveFrom, setRetrieveFrom] = useState<Set<string>>(new Set());
  const [placeTo, setPlaceTo] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get controlled sectors with influence disks (can retrieve from these)
  const retrievableSectors = sectors.filter(
    s => s.controlledBy === playerId && s.influenceDisk === playerId
  );

  // Get adjacent sectors to controlled sectors (can place in these)
  const placeableSectors = new Set<string>();

  sectors.forEach(sector => {
    if (sector.controlledBy === playerId && sector.coordinates) {
      const { q, r } = sector.coordinates;

      // Six adjacent hex positions
      const adjacent = [
        { q: q + 1, r: r },
        { q: q - 1, r: r },
        { q: q + 1, r: r - 1 },
        { q: q - 1, r: r + 1 },
        { q: q, r: r + 1 },
        { q: q, r: r - 1 },
      ];

      adjacent.forEach(pos => {
        // Find sectors at these positions
        const adjacentSector = sectors.find(
          s => s.coordinates?.q === pos.q && s.coordinates?.r === pos.r
        );
        if (adjacentSector) {
          placeableSectors.add(adjacentSector.id);
        }
      });
    }
  });

  const handleToggleRetrieve = (sectorId: string) => {
    const newSet = new Set(retrieveFrom);
    if (newSet.has(sectorId)) {
      newSet.delete(sectorId);
    } else if (newSet.size < 2) {
      newSet.add(sectorId);
    }
    setRetrieveFrom(newSet);
  };

  const handleTogglePlace = (sectorId: string) => {
    const newSet = new Set(placeTo);
    if (newSet.has(sectorId)) {
      newSet.delete(sectorId);
    } else if (newSet.size < 2) {
      newSet.add(sectorId);
    }
    setPlaceTo(newSet);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onInfluence({
        retrieveFrom: retrieveFrom.size > 0 ? Array.from(retrieveFrom) as Id<"sectors">[] : undefined,
        placeTo: placeTo.size > 0 ? Array.from(placeTo) as Id<"sectors">[] : undefined,
      });
    } catch (error) {
      console.error('Influence action failed:', error);
      alert(`Influence failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = retrieveFrom.size > 0 || placeTo.size > 0;

  return (
    <div className="influence-action-ui">
      <div className="action-header">
        <h2>Influence Action</h2>
        <p>Retrieve and place influence disks, refresh colony ships</p>
      </div>

      <div className="mode-selector">
        <button
          onClick={() => setMode('retrieve')}
          className={mode === 'retrieve' ? 'active' : ''}
        >
          Retrieve Influence ({retrieveFrom.size}/2)
        </button>
        <button
          onClick={() => setMode('place')}
          className={mode === 'place' ? 'active' : ''}
        >
          Place Influence ({placeTo.size}/2)
        </button>
      </div>

      <div className="action-controls">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? 'Submitting...' : 'Confirm Influence'}
        </button>
        <button onClick={onCancel} disabled={isSubmitting} className="btn-secondary">
          Cancel
        </button>
      </div>

      <div className="galaxy-view">
        <HexGrid width={1200} height={800}>
          <Layout size={{ x: 7, y: 7 }} flat={true} spacing={1.05}>
            {sectors.map((sector) => {
              if (!sector.coordinates) return null;

              const isControlled = sector.controlledBy === playerId;
              const canRetrieve = retrievableSectors.some(s => s.id === sector.id);
              const canPlace = placeableSectors.has(sector.id);
              const isRetrieveSelected = retrieveFrom.has(sector.id);
              const isPlaceSelected = placeTo.has(sector.id);

              let fill = '#888';
              let stroke = '#666';
              let strokeWidth = 1;
              let cursor = 'default';

              if (mode === 'retrieve') {
                if (canRetrieve) {
                  fill = isRetrieveSelected ? '#FF5722' : '#FFA500';
                  stroke = isRetrieveSelected ? '#FF0000' : '#FFA500';
                  strokeWidth = isRetrieveSelected ? 3 : 1;
                  cursor = 'pointer';
                }
              } else {
                if (canPlace) {
                  fill = isPlaceSelected ? '#2196F3' : '#64B5F6';
                  stroke = isPlaceSelected ? '#0D47A1' : '#2196F3';
                  strokeWidth = isPlaceSelected ? 3 : 1;
                  cursor = 'pointer';
                }
              }

              if (isControlled && !canRetrieve) {
                fill = '#4CAF50';
              }

              const handleClick = () => {
                if (mode === 'retrieve' && canRetrieve) {
                  handleToggleRetrieve(sector.id);
                } else if (mode === 'place' && canPlace) {
                  handleTogglePlace(sector.id);
                }
              };

              return (
                <Hexagon
                  key={sector.id}
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
              );
            })}
          </Layout>
        </HexGrid>
      </div>

      <div className="action-info">
        <div className="info-section">
          <h3>Retrieve Influence</h3>
          <p>Selected: {retrieveFrom.size}/2 sectors</p>
          <p>Available: {retrievableSectors.length} sectors</p>
        </div>
        <div className="info-section">
          <h3>Place Influence</h3>
          <p>Selected: {placeTo.size}/2 sectors</p>
          <p>Available: {placeableSectors.size} sectors</p>
        </div>
        <div className="info-section">
          <h3>Colony Ships</h3>
          <p>Up to 2 will be refreshed automatically</p>
        </div>
      </div>

      <style>{`
        .influence-action-ui {
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
          color: #2196F3;
          font-size: 1.5rem;
        }

        .action-header p {
          margin: 0.5rem 0 0;
          color: #888;
        }

        .mode-selector {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
        }

        .mode-selector button {
          padding: 0.5rem 1.5rem;
          background: #333;
          color: #ccc;
          border: 2px solid #555;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
        }

        .mode-selector button.active {
          background: #2196F3;
          color: white;
          border-color: #2196F3;
        }

        .mode-selector button:hover:not(.active) {
          background: #444;
          border-color: #666;
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
          background: #2196F3;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1976D2;
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
          color: #2196F3;
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
      `}</style>
    </div>
  );
}
