/**
 * Eclipse Second Dawn - Research Panel
 *
 * Displays technology tree organized by tracks:
 * - Military (red)
 * - Grid (blue)
 * - Nano (purple)
 * - Rare (orange)
 *
 * Shows available technologies, player's researched techs, and research action
 */

import { useMemo } from 'react';
import type { Doc } from '../../../convex/_generated/dataModel';
import TechTile from './TechTile';

interface ResearchPanelProps {
  technologies: Doc<"technologies">[];
  researchedTechIds: string[];
  playerScience: number;
  onResearch: (techId: string) => void;
  compact?: boolean;
}

type TechTrack = 'nano' | 'grid' | 'military' | 'rare';

export default function ResearchPanel({
  technologies,
  researchedTechIds,
  playerScience,
  onResearch,
  compact = false
}: ResearchPanelProps) {

  // Group technologies by track
  const techsByTrack = useMemo(() => {
    const grouped: Record<TechTrack, Doc<"technologies">[]> = {
      nano: [],
      grid: [],
      military: [],
      rare: []
    };

    technologies.forEach(tech => {
      const track = tech.track as TechTrack;
      if (grouped[track]) {
        grouped[track].push(tech);
      }
    });

    // Sort by cost within each track
    Object.keys(grouped).forEach(track => {
      grouped[track as TechTrack].sort((a, b) => a.cost - b.cost);
    });

    return grouped;
  }, [technologies]);

  // Calculate which techs can be afforded
  const canAfford = (tech: Doc<"technologies">) => {
    return playerScience >= tech.cost;
  };

  const trackInfo: Record<TechTrack, { name: string; color: string; icon: string }> = {
    military: { name: 'Military', color: '#ef4444', icon: '⚔️' },
    grid: { name: 'Grid', color: '#3b82f6', icon: '🔧' },
    nano: { name: 'Nano', color: '#8b5cf6', icon: '🔬' },
    rare: { name: 'Rare', color: '#f59e0b', icon: '✨' }
  };

  return (
    <div style={{
      background: '#0f172a',
      borderRadius: '1rem',
      padding: compact ? '1rem' : '1.5rem',
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #1e293b'
      }}>
        <h2 style={{
          fontSize: compact ? '1.25rem' : '1.5rem',
          fontWeight: 'bold',
          color: '#f1f5f9',
          margin: 0
        }}>
          Technology Research
        </h2>
        <div style={{
          fontSize: '1rem',
          color: '#3b82f6',
          fontWeight: 'bold'
        }}>
          ⚗️ {playerScience} Science
        </div>
      </div>

      {/* Main tracks (Military, Grid, Nano) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {(['military', 'grid', 'nano'] as const).map(track => {
          const info = trackInfo[track];
          const techs = techsByTrack[track];
          const researchedCount = techs.filter(t =>
            researchedTechIds.includes(t._id)
          ).length;

          return (
            <div key={track} style={{
              background: '#1e293b',
              borderRadius: '0.75rem',
              padding: '1rem',
              border: `2px solid ${info.color}40`
            }}>
              {/* Track header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: `2px solid ${info.color}40`
              }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: info.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>{info.icon}</span>
                  <span>{info.name}</span>
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#94a3b8'
                }}>
                  {researchedCount} / {techs.length}
                </div>
              </div>

              {/* Technologies */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {techs.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.875rem',
                    padding: '2rem 1rem'
                  }}>
                    No technologies available
                  </div>
                ) : (
                  techs.map(tech => (
                    <TechTile
                      key={tech._id}
                      tech={tech}
                      isResearched={researchedTechIds.includes(tech._id)}
                      canAfford={canAfford(tech)}
                      onResearch={() => onResearch(tech._id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rare technologies section */}
      {techsByTrack.rare.length > 0 && (
        <div style={{
          background: '#1e293b',
          borderRadius: '0.75rem',
          padding: '1rem',
          border: `2px solid ${trackInfo.rare.color}40`
        }}>
          {/* Rare header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: `2px solid ${trackInfo.rare.color}40`
          }}>
            <div style={{
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: trackInfo.rare.color,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>{trackInfo.rare.icon}</span>
              <span>{trackInfo.rare.name} Technologies</span>
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              fontStyle: 'italic'
            }}>
              Unique • One of each exists per game
            </div>
          </div>

          {/* Rare tech grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: compact
              ? '1fr'
              : 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '0.75rem'
          }}>
            {techsByTrack.rare.map(tech => (
              <TechTile
                key={tech._id}
                tech={tech}
                isResearched={researchedTechIds.includes(tech._id)}
                canAfford={canAfford(tech)}
                onResearch={() => onResearch(tech._id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Research summary */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: '#1e293b',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        color: '#94a3b8'
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong style={{ color: '#f1f5f9' }}>Total Researched:</strong> {researchedTechIds.length} / {technologies.length}
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
          Research technologies to unlock ship parts and special abilities.
          Cost decreases as you research more in each track.
        </div>
      </div>
    </div>
  );
}
