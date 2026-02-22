import { describe, it, expect } from 'vitest';
import { simulateCombat, type ShipSnap } from '../../convex/engine/combat';

type PlayerRow = { playerId: string; playerName: string; isHost: boolean; isReady: boolean; lives: number };
type GameState = {
  roomId: string;
  gamePhase: 'setup' | 'combat' | 'finished';
  roundNum: number;
  roundLog?: string[];
  acks: Record<string, boolean>;
  playerStates: Record<string, { fleet?: ShipSnap[]; fleetValid?: boolean; sector?: number; lives?: number }>;
};

function logPhase(prefix: string, gs: GameState, players: PlayerRow[]) {
  const ready = players.map(p => `${p.playerName}:${p.isReady ? '✅' : '❌'}`).join(' ');
  if (process.env.VITEST_DEBUG_AUTH_FLOW) {
    // Optional debug output; disabled by default to keep runner memory low
    console.log(`${prefix} phase=${gs.gamePhase} round=${gs.roundNum} ready=[${ready}]`);
  }
}

function makeBasicShip(name: string, opts?: Partial<ShipSnap>): ShipSnap {
  const base: ShipSnap = {
    frame: { id: 'interceptor', name },
    weapons: [],
    riftDice: 0,
    stats: { init: 1, hullCap: 3, valid: true, aim: 1, shieldTier: 0, regen: 0 },
    hull: 3,
    alive: true,
  };
  return { ...base, ...opts };
}

describe('Multiplayer authoritative loop (server view + client logs)', () => {
  it('walks two players through setup → combat → setup with logs', () => {
    // Setup room + players
    const roomId = 'ROOM1';
    const players: PlayerRow[] = [
      { playerId: 'A', playerName: 'Host', isHost: true, isReady: false, lives: 2 },
      { playerId: 'B', playerName: 'Guest', isHost: false, isReady: false, lives: 2 },
    ];
    const gs: GameState = {
      roomId,
      gamePhase: 'setup',
      roundNum: 1,
      acks: {},
      playerStates: {
        A: { sector: 1, lives: 2 },
        B: { sector: 1, lives: 2 },
      },
    };
    logPhase('[Init]', gs, players);

    // Both players outfit ships (client) and submit snapshots (server stores)
    const fleetA: ShipSnap[] = [
      makeBasicShip('A1', { weapons: [{ name: 'Auto', faces: [{ dmg: 1 }], dice: 1, dmgPerHit: 1 }], stats: { init: 2, hullCap: 3, valid: true, aim: 2, shieldTier: 0, regen: 0 } }),
    ];
    const fleetB: ShipSnap[] = [
      makeBasicShip('B1', { weapons: [{ name: 'Plasma', faces: [{ roll: 6 }], dice: 1, dmgPerHit: 1 }], stats: { init: 1, hullCap: 3, valid: true, aim: 1, shieldTier: 0, regen: 0 } }),
    ];
    gs.playerStates['A'] = { ...gs.playerStates['A'], fleet: fleetA, fleetValid: true };
    gs.playerStates['B'] = { ...gs.playerStates['B'], fleet: fleetB, fleetValid: true };
    if (process.env.VITEST_DEBUG_AUTH_FLOW) console.log('[Client->Server] Snapshots submitted: A and B');

    // Players mark ready in Outpost
    players.forEach(p => { p.isReady = true; });
    logPhase('[Outpost] Ready up', gs, players);

    // Server checks both ready + snapshots valid; runs deterministic engine
    const seed = `${roomId}:${gs.roundNum}:TESTSEED`;
    const { winnerPlayerId, roundLog } = simulateCombat({ seed, playerAId: 'A', playerBId: 'B', fleetA, fleetB });
    const loser = players.find(p => p.playerId !== winnerPlayerId)!;
    loser.lives = Math.max(0, loser.lives - 1);
    gs.gamePhase = loser.lives === 0 ? 'finished' : 'combat';
    gs.roundLog = roundLog;
    gs.acks = {};
    if (process.env.VITEST_DEBUG_AUTH_FLOW) {
      console.log(`[Server] Combat resolved. Winner=${winnerPlayerId}. Loser lives=${loser.lives}`);
      console.log('[Server] Round log:\n' + (roundLog || []).join('\n'));
    }
    expect(gs.gamePhase).toEqual('combat');
    expect(gs.roundLog && gs.roundLog.length).toBeGreaterThan(0);

    // Clients auto-ack after reading log
    gs.acks['A'] = true; gs.acks['B'] = true;
    if (process.env.VITEST_DEBUG_AUTH_FLOW) console.log(`[Client] A and B ack playback. acks=${JSON.stringify(gs.acks)}`);

    // Server observes all acks → reset to setup, increment round, reset readiness
    const allAck = players.every(p => gs.acks[p.playerId]);
    expect(allAck).toBe(true);
    players.forEach(p => { p.isReady = false; });
    gs.gamePhase = loser.lives === 0 ? 'finished' : 'setup';
    gs.roundNum += 1;
    gs.roundLog = undefined;
    gs.acks = {};
    logPhase('[Loop]', gs, players);
    if (process.env.VITEST_DEBUG_AUTH_FLOW) console.log('[UI] Next shop is open for both players. They can re‑outfit and repeat.');

    expect(gs.gamePhase).toEqual('setup');
    expect(players.every(p => p.isReady === false)).toBe(true);
    expect(gs.roundNum).toBe(2);
  });
});
