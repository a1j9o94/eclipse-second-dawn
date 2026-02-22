import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MultiplayerGameConfig } from "../../shared/multiplayer";
import type { PlayerState, ShipSnapshot } from "../../shared/mpTypes";

export function useMultiplayerGame(roomId: Id<"rooms"> | null) {
  // Detect vitest and allow tests to bypass Convex entirely
  const isTestEnv = Boolean((import.meta as unknown as { vitest?: unknown }).vitest) || import.meta.env.MODE === 'test';
  // Check if Convex is available (tests and single‑player use should work without it)
  const isConvexAvailable = !!import.meta.env.VITE_CONVEX_URL && !isTestEnv;

  // In environments without Convex (e.g., tests), return a safe stub and avoid calling Convex hooks
  if (!isConvexAvailable) {
    const noopAsync = async () => { /* no-op for tests */ };
    const noopCreateRoom = async () => ({
      roomId: '' as Id<'rooms'>,
      roomCode: 'TEST',
      playerId: 'TEST_PLAYER',
    });
    const noopJoinRoom = async () => ({
      roomId: '' as Id<'rooms'>,
      playerId: 'TEST_PLAYER',
    });
    return {
      roomDetails: undefined,
      gameState: undefined,
      // Helper fns
      isHost: () => false,
      isMyTurn: () => false,
      getCurrentPlayer: () => undefined,
      getOpponent: () => undefined,
      getMyGameState: (): PlayerState | null => null,
      getOpponentGameState: (): PlayerState | null => null,
      getPlayerId: () => null as unknown as string | null,
      // Actions (safe no-ops in tests)
      createRoom: noopCreateRoom,
      joinRoom: noopJoinRoom,
      updatePlayerReady: noopAsync,
      setReady: noopAsync,
      updateFleetValidity: noopAsync,
      startGame: noopAsync,
      restartToSetup: noopAsync,
      updateGameState: noopAsync,
      switchTurn: noopAsync,
      updateGamePhase: noopAsync,
      resolveCombatResult: async () => ({ processed: true, finished: false, loserLives: 0 }),
      endCombatToSetup: noopAsync,
      // State flags
      isLoading: false,
      isConvexAvailable: false,
    } as const;
  }
  
  /* eslint-disable react-hooks/rules-of-hooks */
  // Queries
  const roomDetails = useQuery(
    api.queries.rooms.getRoomDetails,
    roomId ? { roomId } : "skip"
  );

  const gameState = useQuery(
    api.queries.game.getGameState,
    roomId ? { roomId } : "skip"
  );

  // Mutations - Room management
  const createRoom = useMutation(api.mutations.rooms.createRoom);
  const joinRoom = useMutation(api.mutations.rooms.joinRoom);
  const updatePlayerReady = useMutation(api.mutations.rooms.updatePlayerReady);
  const setPlayerFaction = useMutation(api.mutations.rooms.setPlayerFaction);
  const startGame = useMutation(api.mutations.rooms.startGame);

  // Mutations - Game actions (stubbed for now, to be implemented)
  const updatePlayerFleetValidity: any = undefined;
  const restartToSetup: any = undefined;
  const prepareRematch: any = undefined;
  const updateGameState: any = undefined;
  const endCombatToSetup: any = undefined;
  const submitFleetSnapshot: any = undefined;
  const resolveCombatResult: any = undefined;
  const resignMatch: any = undefined;
  const switchTurn: any = undefined;
  const updateGamePhase: any = undefined;
  const initializeGameState: any = undefined;
  const ackRoundPlayed: any = undefined;
  /* eslint-enable react-hooks/rules-of-hooks */

  // Get current player info from localStorage
  const getPlayerId = () => localStorage.getItem('eclipse-player-id');
  const setPlayerId = (id: string) => localStorage.setItem('eclipse-player-id', id);

  // Helper functions
  type RoomPlayer = { playerId: string; isHost?: boolean; isReady?: boolean; playerName?: string; lives?: number };
  const players = roomDetails?.players as RoomPlayer[] | undefined;

  const isHost = () => {
    const playerId = getPlayerId();
    return players?.find(p => p.playerId === playerId)?.isHost ?? false;
  };

  const isMyTurn = () => {
    const playerId = getPlayerId();
    return gameState?.activePlayerId === playerId;
  };

  const getCurrentPlayer = () => {
    const playerId = getPlayerId();
    return players?.find(p => p.playerId === playerId);
  };

  const getOpponent = () => {
    const playerId = getPlayerId();
    return players?.find(p => p.playerId !== playerId);
  };

  const getMyGameState = (): PlayerState | null => {
    // In the new Eclipse schema, player state is tracked separately in playerResources table
    // For now, return null as this is legacy roguelike code
    return null;
  };

  const getOpponentGameState = (): PlayerState | null => {
    // In the new Eclipse schema, player state is tracked separately in playerResources table
    // For now, return null as this is legacy roguelike code
    return null;
  };

  // Room management actions
  const handleCreateRoom = async (roomName: string, isPublic: boolean, playerName: string, gameConfig: MultiplayerGameConfig, playerFaction?: string) => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    try {
      const result = await createRoom({
        roomName,
        isPublic,
        playerName,
        gameConfig,
      });
      setPlayerId(result.playerId);

      // If a faction was provided, set it immediately
      if (playerFaction) {
        await setPlayerFaction({
          roomId: result.roomId,
          playerId: result.playerId,
          factionName: playerFaction,
        });
      }

      return result;
    } catch (error) {
      console.error("Failed to create room:", error);
      throw error;
    }
  };

  const handleJoinRoom = async (roomCode: string, playerName: string, playerFaction?: string) => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    try {
      // Accept raw 6-char codes or full invite URLs with ?code=XYZ123
      const extractCode = (input: string): string | null => {
        if (!input) return null;
        const raw = input.trim();
        // Try URL parsing first
        try {
          const u = new URL(raw);
          const c = u.searchParams.get('code');
          if (c && /^[A-Za-z0-9]{6}$/.test(c)) return c.toUpperCase();
        } catch { /* not a URL */ }
        // Try query parsing on partial strings
        try {
          const i = raw.indexOf('?');
          if (i >= 0) {
            const qs = raw.slice(i + 1);
            const p = new URLSearchParams(qs);
            const c = p.get('code');
            if (c && /^[A-Za-z0-9]{6}$/.test(c)) return c.toUpperCase();
          }
        } catch { /* ignore */ }
        // Fallback: find a 6-char alphanumeric token anywhere
        const m = raw.toUpperCase().match(/[A-Z0-9]{6}/);
        return m ? m[0] : null;
      };
      const normalized = extractCode(roomCode);
      if (!normalized) throw new Error('Invalid room code');
      const result = await joinRoom({ roomCode: normalized, playerName });
      setPlayerId(result.playerId);

      // If a faction was provided, set it immediately after joining
      if (playerFaction && roomId) {
        await setPlayerFaction({
          roomId: result.roomId,
          playerId: result.playerId,
          factionName: playerFaction,
        });
      }

      return result;
    } catch (error) {
      console.error("Failed to join room:", error);
      throw error;
    }
  };

  const handlePlayerReady = async (isReady: boolean) => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) throw new Error("No room ID");
    const playerId = getPlayerId();
    if (!playerId) throw new Error("No player ID found");

    try {
      console.debug("[Client] setReady", { playerId, isReady });
      await updatePlayerReady({ roomId, playerId, isReady });
      console.debug("[Client] setReady ok", { playerId, isReady });
    } catch (error) {
      console.error("Failed to update ready status:", error);
      throw error;
    }
  };

  const handleUpdateFleetValidity = async (fleetValid: boolean) => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) {
      // Silent no-op if room is not yet established on this client
      return;
    }
    const playerId = getPlayerId();
    if (!playerId) throw new Error("No player ID found");
    try {
      console.debug("[Client] updateFleetValidity", { playerId, roomId, fleetValid });
      await updatePlayerFleetValidity({ roomId, playerId, fleetValid });
      console.debug("[Client] updateFleetValidity ok", { playerId });
    } catch (error) {
      console.error("Failed to update fleet validity:", error);
      throw error;
    }
  };

  const handleRestartToSetup = async () => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) throw new Error("No room ID");
    const playerId = getPlayerId();
    if (!playerId) throw new Error("No player ID found");
    try {
      return await restartToSetup({ roomId, playerId });
    } catch (error) {
      console.error("Failed to restart to setup:", error);
      throw error;
    }
  };

  const handleResignMatch = async () => {
    if (!isConvexAvailable) return;
    if (!roomId) return;
    const me = getPlayerId();
    if (!me) return;
    try {
      await resignMatch({ roomId, loserPlayerId: me });
    } catch (err) {
      console.error('Failed to resign match:', err);
    }
  };

  const handleStartGame = async () => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) throw new Error("No room ID");
    const playerId = getPlayerId();
    if (!playerId) throw new Error("No player ID found");
    if (!isHost()) throw new Error("Only host can start game");

    try {
      console.debug("[Client] startGame", { roomId });
      await startGame({ roomId, playerId });

      // Initialize game state if the mutation exists
      if (initializeGameState) {
        await initializeGameState({ roomId, gameConfig: roomDetails!.room.gameConfig });
      }

      console.debug("[Client] startGame ok");
    } catch (error) {
      console.error("Failed to start game:", error);
      throw error;
    }
  };

  const handlePrepareRematch = async () => {
    if (!isConvexAvailable) return;
    if (!roomId) return;
    try {
      await prepareRematch({ roomId });
    } catch (err) {
      console.error('Failed to prepare rematch:', err);
    }
  };

  const handleSetFaction = async (faction: string) => {
    if (!isConvexAvailable) return;
    if (!roomId) return;
    const playerId = getPlayerId();
    if (!playerId) return;
    try {
      await setPlayerFaction({ roomId, playerId, factionName: faction });
    } catch (err) {
      console.error('Failed to set player faction:', err);
    }
  };

  type ClientWeapon = { name?: string; dice?: number; dmgPerHit?: number; faces?: unknown[]; initLoss?: number };
  type ClientPart = { id?: string };
  type ClientShip = {
    frame?: { id?: string; name?: string };
    weapons?: ClientWeapon[];
    riftDice?: number;
    stats?: { init?: number; hullCap?: number; valid?: boolean; aim?: number; shieldTier?: number; regen?: number };
    hull?: number;
    alive?: boolean;
    parts?: ClientPart[];
  };

  const handleSubmitFleetSnapshot = async (fleet: unknown, fleetValid: boolean) => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) return;
    const playerId = getPlayerId();
    if (!playerId) throw new Error("No player ID found");
    try {
      // Convert client Ship[] into server ShipSnap[] with partIds to avoid synthetic parts on reconstruction.
      let payload: unknown = fleet;
      try {
        if (Array.isArray(fleet)) {
          const ships = fleet as ClientShip[];
          payload = ships.map((s): ShipSnapshot => ({
            frame: { id: s?.frame?.id || 'interceptor', name: s?.frame?.name },
            weapons: Array.isArray(s?.weapons) ? s.weapons.map((w) => ({ name: w?.name, dice: w?.dice, dmgPerHit: w?.dmgPerHit, faces: w?.faces as ShipSnapshot['weapons'][0]['faces'], initLoss: w?.initLoss })) : [],
            riftDice: s?.riftDice || 0,
            stats: { init: s?.stats?.init || 0, hullCap: s?.stats?.hullCap || 1, valid: !!s?.stats?.valid, aim: s?.stats?.aim || 0, shieldTier: s?.stats?.shieldTier || 0, regen: s?.stats?.regen || 0 },
            hull: typeof s?.hull === 'number' ? s.hull : (s?.stats?.hullCap || 1),
            alive: s?.alive !== false,
            partIds: Array.isArray(s?.parts) ? s.parts.map((p) => p?.id).filter((id): id is string => typeof id === 'string') : [],
          }));
        }
      } catch { /* leave payload as fleet */ }
      console.debug("[Client] submitFleetSnapshot", { playerId, roomId, count: Array.isArray(fleet) ? (fleet as unknown[]).length : 0, fleetValid });
      await submitFleetSnapshot({ roomId, playerId, fleet: payload, fleetValid });
      console.debug("[Client] submitFleetSnapshot ok");
    } catch (error) {
      console.error("Failed to submit fleet:", error);
      throw error;
    }
  };

  const handleAckRoundPlayed = async () => {
    if (!isConvexAvailable) return;
    if (!roomId) return;
    const playerId = getPlayerId();
    if (!playerId) return;
    try {
      console.debug("[Client] ackRoundPlayed", { playerId });
      await ackRoundPlayed({ roomId, playerId });
      console.debug("[Client] ackRoundPlayed ok");
    } catch (error) {
      console.error("Failed to ack round:", error);
    }
  };

  // Game state actions
  const handleGameStateUpdate = async (updates: Record<string, unknown>) => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) throw new Error("No room ID");
    const playerId = getPlayerId();
    if (!playerId) throw new Error("No player ID found");

    try {
      await updateGameState({ roomId, playerId, updates });
    } catch (error) {
      console.error("Failed to update game state:", error);
      throw error;
    }
  };

  const handleSwitchTurn = async () => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) throw new Error("No room ID");

    try {
      return await switchTurn({ roomId });
    } catch (error) {
      console.error("Failed to switch turn:", error);
      throw error;
    }
  };

  const handlePhaseChange = async (phase: "setup" | "combat" | "finished") => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) throw new Error("No room ID");

    try {
      await updateGamePhase({ roomId, phase });
    } catch (error) {
      console.error("Failed to update game phase:", error);
      throw error;
    }
  };

  const handleResolveCombatResult = async (winnerPlayerId: string) => {
    if (!isConvexAvailable) {
      throw new Error("Multiplayer features are not available. Please check your connection and try again.");
    }
    if (!roomId) {
      // If room lost locally, skip (other client will have reported the result)
      return { processed: false } as unknown as { processed: boolean };
    }
    try {
      return await resolveCombatResult({ roomId, winnerPlayerId });
    } catch (error) {
      console.error("Failed to resolve combat:", error);
      throw error;
    }
  };

  const handleEndCombatToSetup = async () => {
    if (!roomId) throw new Error("No room ID");
    try {
      await endCombatToSetup({ roomId });
    } catch (error) {
      console.error("Failed to end combat:", error);
      throw error;
    }
  };

  return {
    // Data
    roomDetails,
    gameState,
    
    // Helper functions
    isHost,
    isMyTurn,
    getCurrentPlayer,
    getOpponent,
    getMyGameState,
    getOpponentGameState,
    getPlayerId,
    
    // Room actions
    createRoom: handleCreateRoom,
    joinRoom: handleJoinRoom,
    updatePlayerReady: handlePlayerReady,
    setReady: handlePlayerReady,
    updateFleetValidity: handleUpdateFleetValidity,
    startGame: handleStartGame,
    restartToSetup: handleRestartToSetup,
    
    // Game actions
    updateGameState: handleGameStateUpdate,
    switchTurn: handleSwitchTurn,
    updateGamePhase: handlePhaseChange,
    resolveCombatResult: handleResolveCombatResult,
    endCombatToSetup: handleEndCombatToSetup,
    resignMatch: handleResignMatch,
    submitFleetSnapshot: handleSubmitFleetSnapshot,
    ackRoundPlayed: handleAckRoundPlayed,
    prepareRematch: handlePrepareRematch,
    setPlayerFaction: handleSetFaction,
    
    // Loading states and availability
    isLoading: isConvexAvailable && !!roomId && (roomDetails === undefined || gameState === undefined),
    isConvexAvailable,
  };
}
