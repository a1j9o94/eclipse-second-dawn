import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

// Type for a part document
interface PartDocument {
  _id: Id<"parts">;
  _creationTime: number;
  name: string;
  type: "cannon" | "missile" | "shield" | "computer" | "drive" | "hull" | "power_source" | "armor";
  diceType?: "yellow" | "orange" | "red";
  diceCount: number;
  energyProduction: number;
  energyCost: number;
  initiativeBonus: number;
  hullValue: number;
  driveSpeed: number;
  effect?: string;
  effectData?: string;
  requiresTechnologyIds: Id<"technologies">[];
}

// Type guard to check if a document is a PartDocument
function isPart(item: any): item is PartDocument {
  return (
    item !== null &&
    typeof item === 'object' &&
    'name' in item &&
    'type' in item &&
    'diceCount' in item &&
    'energyProduction' in item &&
    'energyCost' in item &&
    'initiativeBonus' in item &&
    'hullValue' in item &&
    'driveSpeed' in item
  );
}

interface UpgradeActionUIProps {
  roomId: Id<"rooms">;
  playerId: string;
  onUpgrade: (
    blueprintId: Id<"blueprints">,
    removeParts: Id<"parts">[],
    addParts: Id<"parts">[]
  ) => Promise<void>;
  onCancel: () => void;
}

/**
 * UI for the Upgrade action - allows player to modify ship blueprints
 */
export default function UpgradeActionUI({
  roomId,
  playerId,
  onUpgrade,
  onCancel,
}: UpgradeActionUIProps) {
  const [selectedBlueprint, setSelectedBlueprint] = useState<Id<"blueprints"> | null>(null);
  const [partsToRemove, setPartsToRemove] = useState<Set<Id<"parts">>>(new Set());
  const [partsToAdd, setPartsToAdd] = useState<Set<Id<"parts">>>(new Set());
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Query player's blueprints
  const blueprints = useQuery(api.queries.players.getPlayerBlueprints, {
    roomId,
    playerId,
  });

  // Query unlocked parts (from researched technologies)
  const unlockedPartsRaw = useQuery(api.queries.technologies.getUnlockedParts, {
    roomId,
    playerId,
  });

  // Filter only parts documents using type guard
  const unlockedParts = unlockedPartsRaw?.filter(isPart) || [];

  const selectedBlueprintData = blueprints?.find(b => b._id === selectedBlueprint);

  // Get current parts from the selected blueprint
  const currentParts: Array<Id<"parts">> = selectedBlueprintData
    ? [
        selectedBlueprintData.parts.hull as Id<"parts">,
        selectedBlueprintData.parts.powerSource as Id<"parts">,
        ...(selectedBlueprintData.parts.drives as Id<"parts">[]),
        ...(selectedBlueprintData.parts.computers as Id<"parts">[]),
        ...(selectedBlueprintData.parts.shields as Id<"parts">[]),
        ...(selectedBlueprintData.parts.weapons as Id<"parts">[]),
      ]
    : [];

  const handleToggleRemove = (partId: Id<"parts">) => {
    const newSet = new Set(partsToRemove);
    if (newSet.has(partId)) {
      newSet.delete(partId);
    } else {
      newSet.add(partId);
    }
    setPartsToRemove(newSet);
  };

  const handleToggleAdd = (partId: Id<"parts">) => {
    const newSet = new Set(partsToAdd);
    if (newSet.has(partId)) {
      newSet.delete(partId);
    } else {
      newSet.add(partId);
    }
    setPartsToAdd(newSet);
  };

  const handleUpgrade = async () => {
    if (!selectedBlueprint) return;

    setIsUpgrading(true);
    try {
      await onUpgrade(
        selectedBlueprint,
        Array.from(partsToRemove),
        Array.from(partsToAdd)
      );
    } catch (error) {
      console.error('Upgrade action failed:', error);
      alert(`Upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpgrading(false);
    }
  };

  const canUpgrade = selectedBlueprint && (partsToRemove.size > 0 || partsToAdd.size > 0);

  return (
    <div className="upgrade-action-ui">
      <div className="action-overlay" onClick={onCancel} />

      <div className="action-modal">
        <div className="action-header">
          <h2>Upgrade Action</h2>
          <p>Modify ship blueprints by swapping parts</p>
          <button onClick={onCancel} disabled={isUpgrading} className="close-btn">
            ×
          </button>
        </div>

        <div className="action-content">
          {/* Blueprint Selection */}
          <div className="selection-section">
            <h3>Select Blueprint to Upgrade</h3>
            {!blueprints || blueprints.length === 0 ? (
              <p className="no-items">No blueprints available</p>
            ) : (
              <div className="blueprint-list">
                {blueprints.map((blueprint) => {
                  const isSelected = selectedBlueprint === blueprint._id;

                  return (
                    <div
                      key={blueprint._id}
                      className={`blueprint-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBlueprint(blueprint._id);
                        setPartsToRemove(new Set());
                        setPartsToAdd(new Set());
                      }}
                    >
                      <div className="blueprint-info">
                        <h4>{blueprint.name}</h4>
                        <span className="ship-type">{blueprint.shipType}</span>
                      </div>
                      <div className="blueprint-stats-row">
                        <span>Init: {blueprint.initiative}</span>
                        <span>Hull: {blueprint.hull}</span>
                        <span>Move: {blueprint.movement}</span>
                        <span>Energy: {blueprint.totalEnergy - blueprint.energyUsed}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current Parts */}
          {selectedBlueprintData && (
            <div className="selection-section">
              <h3>Current Parts (Click to Remove)</h3>
              <div className="parts-grid">
                {currentParts.map((partId, index) => {
                  const isMarkedForRemoval = partsToRemove.has(partId);

                  return (
                    <div
                      key={`current-${partId}-${index}`}
                      className={`part-card current ${isMarkedForRemoval ? 'marked-remove' : ''}`}
                      onClick={() => handleToggleRemove(partId)}
                    >
                      <div className="part-info">
                        <span className="part-id">{partId}</span>
                        {isMarkedForRemoval && <span className="remove-indicator">✕</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Parts */}
          {selectedBlueprintData && (
            <div className="selection-section">
              <h3>Available Parts (Click to Add)</h3>
              {!unlockedParts || unlockedParts.length === 0 ? (
                <p className="no-items">No unlocked parts available. Research technologies to unlock parts.</p>
              ) : (
                <div className="parts-grid">
                  {unlockedParts.map((part) => {
                    const isMarkedForAdd = partsToAdd.has(part._id);

                    return (
                      <div
                        key={part._id}
                        className={`part-card available ${isMarkedForAdd ? 'marked-add' : ''}`}
                        onClick={() => handleToggleAdd(part._id)}
                      >
                        <div className="part-header">
                          <span className="part-name">{part.name}</span>
                          <span className="part-type">{part.type}</span>
                        </div>
                        <div className="part-stats">
                          {part.diceCount > 0 && (
                            <span className="stat">
                              {part.diceCount}× {part.diceType || 'dice'}
                            </span>
                          )}
                          {part.energyCost > 0 && (
                            <span className="stat">Energy: {part.energyCost}</span>
                          )}
                          {part.energyProduction > 0 && (
                            <span className="stat">+{part.energyProduction} Energy</span>
                          )}
                          {part.hullValue > 0 && (
                            <span className="stat">Hull: {part.hullValue}</span>
                          )}
                          {part.driveSpeed > 0 && (
                            <span className="stat">Speed: {part.driveSpeed}</span>
                          )}
                          {part.initiativeBonus > 0 && (
                            <span className="stat">+{part.initiativeBonus} Init</span>
                          )}
                        </div>
                        {isMarkedForAdd && <div className="add-indicator">✓</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {(partsToRemove.size > 0 || partsToAdd.size > 0) && (
            <div className="upgrade-summary">
              <div className="summary-section">
                <h4>Changes Summary</h4>
                <div className="summary-row">
                  <span className="summary-label">Parts to Remove:</span>
                  <span className="summary-value">{partsToRemove.size}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Parts to Add:</span>
                  <span className="summary-value">{partsToAdd.size}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="action-controls">
          <button
            onClick={handleUpgrade}
            disabled={!canUpgrade || isUpgrading}
            className="btn-primary"
          >
            {isUpgrading ? 'Upgrading...' : 'Confirm Upgrade'}
          </button>
          <button onClick={onCancel} disabled={isUpgrading} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        .upgrade-action-ui {
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
          max-width: 1000px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(138, 43, 226, 0.3);
          border: 2px solid #8a2be2;
        }

        .action-header {
          position: sticky;
          top: 0;
          background: #1a1a1a;
          padding: 1.5rem;
          border-bottom: 2px solid #8a2be2;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          z-index: 10;
        }

        .action-header h2 {
          margin: 0;
          color: #8a2be2;
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
          color: #8a2be2;
          margin: 0 0 1rem;
          font-size: 1.25rem;
        }

        .no-items {
          color: #666;
          font-style: italic;
          text-align: center;
          padding: 2rem;
        }

        .blueprint-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
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
          border-color: #8a2be2;
        }

        .blueprint-card.selected {
          border-color: #8a2be2;
          background: #2a1a3a;
          box-shadow: 0 0 16px rgba(138, 43, 226, 0.3);
        }

        .blueprint-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .blueprint-info h4 {
          margin: 0;
          color: #fff;
          font-size: 1.1rem;
        }

        .ship-type {
          color: #8a2be2;
          font-size: 0.8rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .blueprint-stats-row {
          display: flex;
          gap: 1.5rem;
          font-size: 0.9rem;
          color: #aaa;
        }

        .parts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
        }

        .part-card {
          background: #222;
          border: 2px solid #333;
          border-radius: 8px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .part-card:hover {
          border-color: #8a2be2;
          transform: translateY(-2px);
        }

        .part-card.current {
          border-color: #555;
        }

        .part-card.current.marked-remove {
          border-color: #f44336;
          background: #3a1a1a;
          box-shadow: 0 0 16px rgba(244, 67, 54, 0.3);
        }

        .part-card.available.marked-add {
          border-color: #8a2be2;
          background: #2a1a3a;
          box-shadow: 0 0 16px rgba(138, 43, 226, 0.3);
        }

        .part-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .part-id {
          color: #888;
          font-size: 0.85rem;
          font-family: monospace;
        }

        .remove-indicator {
          color: #f44336;
          font-size: 1.25rem;
          font-weight: bold;
        }

        .part-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }

        .part-name {
          color: #fff;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .part-type {
          color: #8a2be2;
          font-size: 0.7rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .part-stats {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat {
          color: #aaa;
          font-size: 0.85rem;
        }

        .add-indicator {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          color: #8a2be2;
          font-size: 1.5rem;
          font-weight: bold;
        }

        .upgrade-summary {
          background: #222;
          border-radius: 8px;
          padding: 1rem;
        }

        .summary-section h4 {
          color: #8a2be2;
          margin: 0 0 0.75rem;
          font-size: 1rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid #333;
        }

        .summary-row:last-child {
          border-bottom: none;
        }

        .summary-label {
          color: #888;
        }

        .summary-value {
          color: #8a2be2;
          font-weight: 700;
        }

        .action-controls {
          position: sticky;
          bottom: 0;
          background: #1a1a1a;
          padding: 1.5rem;
          border-top: 2px solid #8a2be2;
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
          background: #8a2be2;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #7a1fd2;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(138, 43, 226, 0.4);
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
