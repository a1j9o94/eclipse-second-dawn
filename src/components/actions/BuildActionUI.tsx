import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

interface BuildActionUIProps {
  roomId: Id<"rooms">;
  playerId: string;
  onBuild: (blueprintId: Id<"blueprints">, sectorId: Id<"sectors">) => Promise<void>;
  onCancel: () => void;
}

/**
 * UI for the Build action - allows player to construct ships from blueprints
 */
export default function BuildActionUI({
  roomId,
  playerId,
  onBuild,
  onCancel,
}: BuildActionUIProps) {
  const [selectedBlueprint, setSelectedBlueprint] = useState<Id<"blueprints"> | null>(null);
  const [selectedSector, setSelectedSector] = useState<Id<"sectors"> | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  // Query player's blueprints
  const blueprints = useQuery(api.queries.players.getPlayerBlueprints, {
    roomId,
    playerId,
  });

  // Query player's resources
  const resources = useQuery(api.queries.players.getPlayerResources, {
    roomId,
    playerId,
  });

  // Query all sectors to find controlled ones
  const sectors = useQuery(api.queries.galaxy.getSectors, { roomId });

  // Filter controlled sectors
  const controlledSectors = sectors?.filter(s => s.controlledBy === playerId) || [];

  // Filter pinned (active) blueprints
  const activeBlueprints = blueprints?.filter(b => b.isPinned) || [];

  const handleBuild = async () => {
    if (!selectedBlueprint || !selectedSector) return;

    setIsBuilding(true);
    try {
      await onBuild(selectedBlueprint, selectedSector);
    } catch (error) {
      console.error('Build action failed:', error);
      alert(`Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBuilding(false);
    }
  };

  const selectedBlueprintData = activeBlueprints.find(b => b._id === selectedBlueprint);
  const canAfford = selectedBlueprintData && resources
    ? resources.materials >= selectedBlueprintData.materialCost
    : false;
  const canBuild = selectedBlueprint && selectedSector && canAfford;

  return (
    <div className="build-action-ui">
      <div className="action-overlay" onClick={onCancel} />

      <div className="action-modal">
        <div className="action-header">
          <h2>Build Action</h2>
          <p>Select a blueprint and a controlled sector to build in</p>
          <button onClick={onCancel} disabled={isBuilding} className="close-btn">
            ×
          </button>
        </div>

        <div className="action-content">
          {/* Blueprint Selection */}
          <div className="selection-section">
            <h3>Select Blueprint</h3>
            {activeBlueprints.length === 0 ? (
              <p className="no-items">No active blueprints available</p>
            ) : (
              <div className="blueprint-grid">
                {activeBlueprints.map((blueprint) => {
                  const isSelected = selectedBlueprint === blueprint._id;
                  const affordable = resources ? resources.materials >= blueprint.materialCost : false;

                  return (
                    <div
                      key={blueprint._id}
                      className={`blueprint-card ${isSelected ? 'selected' : ''} ${!affordable ? 'unaffordable' : ''}`}
                      onClick={() => setSelectedBlueprint(blueprint._id)}
                    >
                      <div className="blueprint-header">
                        <h4>{blueprint.name}</h4>
                        <span className="ship-type">{blueprint.shipType}</span>
                      </div>
                      <div className="blueprint-stats">
                        <div className="stat">
                          <span className="label">Materials:</span>
                          <span className={`value ${!affordable ? 'insufficient' : ''}`}>
                            {blueprint.materialCost}
                          </span>
                        </div>
                        <div className="stat">
                          <span className="label">Initiative:</span>
                          <span className="value">{blueprint.initiative}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Hull:</span>
                          <span className="value">{blueprint.hull}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Movement:</span>
                          <span className="value">{blueprint.movement}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sector Selection */}
          <div className="selection-section">
            <h3>Select Sector</h3>
            {controlledSectors.length === 0 ? (
              <p className="no-items">No controlled sectors available</p>
            ) : (
              <div className="sector-list">
                {controlledSectors.map((sector) => {
                  const isSelected = selectedSector === sector._id;

                  return (
                    <div
                      key={sector._id}
                      className={`sector-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSector(sector._id)}
                    >
                      <div className="sector-info">
                        <span className="sector-position">
                          Sector ({sector.position.q}, {sector.position.r})
                        </span>
                        <span className="sector-type">{sector.type}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resource Display */}
          {resources && (
            <div className="resource-display">
              <div className="resource-item">
                <span className="resource-label">Materials:</span>
                <span className="resource-value">{resources.materials}</span>
              </div>
              {selectedBlueprintData && (
                <div className="resource-item cost">
                  <span className="resource-label">Cost:</span>
                  <span className={`resource-value ${!canAfford ? 'insufficient' : ''}`}>
                    {selectedBlueprintData.materialCost}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="action-controls">
          <button
            onClick={handleBuild}
            disabled={!canBuild || isBuilding}
            className="btn-primary"
          >
            {isBuilding ? 'Building...' : 'Confirm Build'}
          </button>
          <button onClick={onCancel} disabled={isBuilding} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        .build-action-ui {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .action-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
        }

        .action-modal {
          position: relative;
          background: #1a1a1a;
          border-radius: 12px;
          max-width: 900px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(76, 175, 80, 0.3);
          border: 2px solid #4CAF50;
        }

        .action-header {
          position: sticky;
          top: 0;
          background: #1a1a1a;
          padding: 1.5rem;
          border-bottom: 2px solid #4CAF50;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          z-index: 10;
        }

        .action-header h2 {
          margin: 0;
          color: #4CAF50;
          font-size: 1.75rem;
        }

        .action-header p {
          margin: 0;
          color: #888;
        }

        .close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: transparent;
          border: none;
          color: #888;
          font-size: 2rem;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: #fff;
        }

        .action-content {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .selection-section h3 {
          color: #4CAF50;
          margin: 0 0 1rem;
          font-size: 1.25rem;
        }

        .no-items {
          color: #666;
          font-style: italic;
          text-align: center;
          padding: 2rem;
        }

        .blueprint-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .blueprint-card {
          background: #222;
          border: 2px solid #333;
          border-radius: 8px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .blueprint-card:hover {
          border-color: #4CAF50;
          transform: translateY(-2px);
        }

        .blueprint-card.selected {
          border-color: #4CAF50;
          background: #2a3a2a;
          box-shadow: 0 0 16px rgba(76, 175, 80, 0.3);
        }

        .blueprint-card.unaffordable {
          opacity: 0.5;
        }

        .blueprint-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .blueprint-header h4 {
          margin: 0;
          color: #fff;
          font-size: 1rem;
        }

        .ship-type {
          color: #4CAF50;
          font-size: 0.75rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .blueprint-stats {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .stat {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
        }

        .stat .label {
          color: #888;
        }

        .stat .value {
          color: #fff;
          font-weight: 600;
        }

        .stat .value.insufficient {
          color: #f44336;
        }

        .sector-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .sector-card {
          background: #222;
          border: 2px solid #333;
          border-radius: 8px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sector-card:hover {
          border-color: #4CAF50;
        }

        .sector-card.selected {
          border-color: #4CAF50;
          background: #2a3a2a;
          box-shadow: 0 0 16px rgba(76, 175, 80, 0.3);
        }

        .sector-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sector-position {
          color: #fff;
          font-weight: 600;
        }

        .sector-type {
          color: #4CAF50;
          font-size: 0.85rem;
          text-transform: uppercase;
        }

        .resource-display {
          background: #222;
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          gap: 2rem;
          justify-content: center;
        }

        .resource-item {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .resource-label {
          color: #888;
        }

        .resource-value {
          color: #4CAF50;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .resource-item.cost .resource-value {
          color: #fff;
        }

        .resource-item.cost .resource-value.insufficient {
          color: #f44336;
        }

        .action-controls {
          position: sticky;
          bottom: 0;
          background: #1a1a1a;
          padding: 1.5rem;
          border-top: 2px solid #4CAF50;
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-primary,
        .btn-secondary {
          padding: 0.75rem 2rem;
          border: none;
          border-radius: 6px;
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
          box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
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
      `}</style>
    </div>
  );
}
