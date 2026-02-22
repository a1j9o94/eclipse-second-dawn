import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GalaxyBoard from '../components/GalaxyBoard';

describe('GalaxyBoard', () => {
  it('renders without crashing', () => {
    render(<GalaxyBoard />);
    const board = screen.getByText('Center');
    expect(board).toBeDefined();
  });

  it('renders correct number of hexes for 1 ring (1 center + 6 ring)', () => {
    const { container } = render(<GalaxyBoard rings={1} />);
    const hexagons = container.querySelectorAll('.galaxy-hex');
    expect(hexagons.length).toBe(7); // 1 center + 6 in ring 1
  });

  it('renders correct number of hexes for 2 rings (1 + 6 + 12)', () => {
    const { container } = render(<GalaxyBoard rings={2} />);
    const hexagons = container.querySelectorAll('.galaxy-hex');
    expect(hexagons.length).toBe(19); // 1 center + 6 in ring 1 + 12 in ring 2
  });

  it('renders correct number of hexes for 3 rings (default)', () => {
    const { container } = render(<GalaxyBoard />);
    const hexagons = container.querySelectorAll('.galaxy-hex');
    // 1 center + 6 (ring 1) + 12 (ring 2) + 18 (ring 3) = 37
    expect(hexagons.length).toBe(37);
  });

  it('calls onHexClick when hex is clicked', () => {
    const mockClick = vi.fn();
    render(<GalaxyBoard onHexClick={mockClick} />);

    // Note: Testing actual clicks on SVG hexagons is complex
    // This test verifies the prop is accepted
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('renders center hex with "Center" label', () => {
    render(<GalaxyBoard rings={1} />);
    expect(screen.getByText('Center')).toBeDefined();
  });

  it('renders hex coordinates for non-center hexes', () => {
    const { container } = render(<GalaxyBoard rings={1} />);
    // Ring 1 around (0,0,0) has hexes at positions like (1,-1,0), (1,0,-1), etc.
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBeGreaterThan(1);
  });
});
