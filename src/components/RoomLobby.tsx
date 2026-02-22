import { useState, useEffect } from 'react';
import { useMultiplayerGame } from '../hooks/useMultiplayerGame';
import type { Id } from '../../convex/_generated/dataModel';
import { FactionPickModal } from './modals';

interface RoomLobbyProps {
  roomId: Id<"rooms">;
  onGameStart: () => void;
  onLeaveRoom: () => void;
}

export function RoomLobby({ roomId, onGameStart, onLeaveRoom }: RoomLobbyProps) {
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [showFactionModal, setShowFactionModal] = useState(false);
  
  const {
    roomDetails,
    gameState,
    isHost,
    getCurrentPlayer,
    setReady,
    setPlayerFaction,
    updateFleetValidity,
    restartToSetup,
    startGame,
    isLoading,
  } = useMultiplayerGame(roomId);

  const currentPlayer = getCurrentPlayer();
  const room = roomDetails?.room;
  type RoomPlayer = { playerId: string; isReady: boolean; lives?: number; playerName?: string; isHost: boolean; faction?: string };

  // Auto-start game when both players are ready (host only)
  useEffect(() => {
    if (!roomDetails) return;
    
    const players = roomDetails.players as RoomPlayer[];
    const allReady = players.every(p => p.isReady);
    const hasFullPlayers = players.length === 2;
    
    if (isHost() && allReady && hasFullPlayers && !isStarting) {
      setIsStarting(true);
      // Only host triggers start; guests wait for phase change
      console.debug('[Lobby] Host starting game');
      startGame()
        .then(() => {
          onGameStart();
        })
        .catch((err) => {
          setError(err.message);
          setIsStarting(false);
        });
    }
  }, [roomDetails, startGame, onGameStart, isStarting, isHost]);

  // Guest navigation: when server moves to playing/setup or combat, enter game view
  useEffect(() => {
    const isServerPlaying = room?.status === 'playing';
    const phase = (gameState as any)?.currentPhase;
    const hasGamePhase = phase === 'setup' || phase === 'combat' || phase === 'finished';
    if (!isStarting && isServerPlaying && hasGamePhase) {
      setIsStarting(true);
      onGameStart();
    }
  }, [room?.status, (gameState as any)?.currentPhase, isStarting, onGameStart]);

  // Eclipse doesn't use playerStates in gameState like the roguelike did
  const localFleetValid = true; // Always valid for now in Eclipse

  const handleReadyToggle = async () => {
    const newReadyState = !isReady;
    // On ready up, ask for faction first (important for first shop setup)
    if (newReadyState) {
      setShowFactionModal(true);
      return;
    }
    // Unready path
    setIsReady(false);
    try { await setReady(false); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update ready status'); }
  };

  const handleRestart = async () => {
    try {
      setError('');
      await restartToSetup();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart');
    }
  };

  const copyRoomCode = () => {
    if (!room?.roomCode) return;
    // Copy just the 6-character room code
    try { navigator.clipboard.writeText(room.roomCode); } catch { /* ignore */ }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">Loading room...</div>
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!room || !currentPlayer) {
    return (
      <div className="min-h-screen text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4 text-red-400">Room not found</div>
          <button
            onClick={onLeaveRoom}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const players = roomDetails.players as RoomPlayer[];
  const waitingForPlayers = players.length < 2;
  const allReady = players.every(p => p.isReady);
  // Lives are shown in top bar elsewhere; keep local references minimal

  return (
    <div className="min-h-screen text-zinc-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{room.roomName}</h1>
            <div className="text-zinc-400 text-sm flex items-center gap-2">
              <span>{room.isPublic ? 'Public Room' : 'Private Room'}</span>
              {/* Multiplayer status pill */}
              <span className={`px-2 py-0.5 rounded-full text-xs border ${allReady && players.length===2 ? 'bg-emerald-900/40 border-emerald-600 text-emerald-200' : 'bg-zinc-800 border-zinc-600 text-zinc-300'}`}>
                {(gameState as any)?.currentPhase ?? 'setup'} · {players.filter(p=>p.isReady).length}/{players.length} ready
              </span>
            </div>
          </div>
          <button
            onClick={onLeaveRoom}
            className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 rounded"
          >
            Leave
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-100 text-sm">
            {error}
          </div>
        )}

        {/* Room Code (for private rooms) */}
        {!room.isPublic && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400 mb-1">Room Code</div>
                <div className="font-mono text-2xl tracking-wider">{room.roomCode}</div>
              </div>
              <button
                onClick={copyRoomCode}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Copy
              </button>
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              Share this code with your friend to invite them
            </div>
          </div>
        )}

        {/* Game Settings */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
          <h3 className="font-bold mb-3">Game Settings</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-400">Victory Points Goal:</span>
              <span className="ml-2">{(room.gameConfig as any).victoryPointGoal ?? 30}</span>
            </div>
            <div>
              <span className="text-zinc-400">Rise of Ancients:</span>
              <span className="ml-2">{(room.gameConfig as any).enableRiseOfTheAncients ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="space-y-3">
          <h3 className="font-bold">Players ({players.length}/2)</h3>

          {players.map(player => (
            <div
              key={player.playerId}
              className={`p-4 rounded-lg border ${
                player.playerId === currentPlayer.playerId
                  ? 'bg-blue-900/30 border-blue-700'
                  : 'bg-zinc-800 border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {player.playerName}{player.faction ? (
                      <span className="ml-1 opacity-70 text-xs">({player.faction})</span>
                    ) : null}
                    {player.isHost && (
                      <span className="ml-2 px-2 py-1 bg-yellow-600 text-yellow-100 text-xs rounded">
                        Host
                      </span>
                    )}
                    {player.playerId === currentPlayer.playerId && (
                      <span className="ml-2 text-blue-400 text-sm">(You)</span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-400">
                    Lives: {player.lives}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-sm ${
                    player.isReady
                      ? 'bg-green-600 text-green-100'
                      : 'bg-zinc-600 text-zinc-300'
                  }`}>
                    {player.isReady ? 'Ready' : 'Not Ready'}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Waiting for players */}
          {waitingForPlayers && (
            <div className="p-4 border-2 border-dashed border-zinc-700 rounded-lg text-center text-zinc-400">
              <div className="text-lg mb-2">Waiting for another player...</div>
              {!room.isPublic && (
                <div className="text-sm">Share the room code above to invite someone</div>
              )}
            </div>
          )}
        </div>

        {/* Ready Button */}
        {!waitingForPlayers && (
          <div className="text-center">
            <button
              onClick={handleReadyToggle}
              disabled={isStarting || !localFleetValid}
              className={`px-8 py-3 rounded-lg font-medium text-lg ${
                isReady
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isStarting
                ? 'Starting Game...'
                : isReady
                ? 'Cancel Ready'
                : 'Ready to Play'
              }
            </button>
            {!localFleetValid && (
              <div className="mt-2 text-sm text-red-400">Your fleet is invalid.</div>
            )}
            
            {allReady && !isHost() && (
              <div className="mt-2 text-sm text-yellow-400">
                Waiting for host to start the game...
              </div>
            )}

            {/* Manual Start for Host */}
            {isHost() && (
              <div className="mt-4">
                <button
                  onClick={async ()=>{
                    try {
                      setIsStarting(true);
                      await startGame();
                      onGameStart();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to start');
                      setIsStarting(false);
                    }
                  }}
                  disabled={!allReady || isStarting}
                  className={`px-6 py-2 rounded-lg text-sm font-medium ${(!allReady || isStarting) ? 'bg-zinc-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {isStarting ? 'Starting…' : 'Start Game'}
                </button>
                {!allReady && (
                  <div className="mt-1 text-xs text-zinc-400">Both players must be ready.</div>
                )}
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={handleRestart}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
              >
                Restart (Lose a life)
              </button>
            </div>
          </div>
        )}
      </div>
      {showFactionModal && (
        <FactionPickModal
          current={(getCurrentPlayer() as unknown as { faction?: string } | undefined)?.faction}
          onPick={async (fid:string) => {
            try { if (typeof setPlayerFaction === 'function') { await (setPlayerFaction as (f:string)=>Promise<void>)(fid); } } catch { /* noop */ }
            try {
              await updateFleetValidity(true);
              await setReady(true);
              setIsReady(true);
              setShowFactionModal(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to ready');
              setShowFactionModal(false);
            }
          }}
          onClose={()=> { setShowFactionModal(false); }}
        />
      )}
    </div>
  );
}
