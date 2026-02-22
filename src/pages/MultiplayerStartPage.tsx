import { useState } from 'react';
import { generateSpaceRoomName } from '../utils/roomNameGenerator';
import { createDefaultMultiplayerGameConfig, MULTIPLAYER_CONFIG } from '../../shared/multiplayer';
import { useMultiplayerGame } from '../hooks/useMultiplayerGame';

interface MultiplayerStartPageProps {
  onRoomJoined: (roomId: string) => void;
  onBack: () => void;
  currentFaction?: string;
  initialMode?: 'menu' | 'create' | 'join';
  initialIsPublic?: boolean;
}

export default function MultiplayerStartPage({ onRoomJoined, onBack, currentFaction, initialMode, initialIsPublic }: MultiplayerStartPageProps) {
  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'public'>(initialMode || 'create');
  const [roomName, setRoomName] = useState(generateSpaceRoomName());
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isPublic, setIsPublic] = useState(Boolean(initialIsPublic));
  const [gameConfig, setGameConfig] = useState(createDefaultMultiplayerGameConfig());
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const { createRoom, joinRoom } = useMultiplayerGame(null);

  // Pre-fill join code from query string (e.g., ?code=ABC123) when page opens
  // This helps ensure guests land on the same deployment as the host via invite links
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code && !roomCode) {
        setRoomCode(code.toUpperCase());
        setMode('join');
      }
    } catch { /* ignore */ }
  }

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Player name is required');
      return;
    }

    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const result = await createRoom(roomName.trim(), isPublic, playerName.trim(), gameConfig, currentFaction);
      onRoomJoined(result.roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      setError('Player name is required');
      return;
    }

    if (!roomCode.trim()) {
      setError('Room code is required');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const result = await joinRoom(roomCode.trim().toUpperCase(), playerName.trim(), currentFaction);
      onRoomJoined(result.roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const regenerateRoomName = () => {
    setRoomName(generateSpaceRoomName());
  };

  if (mode === 'create') {
    return (
      <div className="min-h-screen text-zinc-100 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Create Match</h1>
            <button
              onClick={() => onBack()}
              className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 rounded"
            >
              Back
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-100 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Room Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="flex-1 p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={MULTIPLAYER_CONFIG.MAX_ROOM_NAME_LENGTH}
                />
                <button
                  onClick={regenerateRoomName}
                  className="px-3 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
                  title="Generate new name"
                >
                  🎲
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">Make room public (others can find it)</span>
              </label>
            </div>

            <div className="border border-zinc-700 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Game Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Starting Ships</label>
                  <input
                    type="number"
                    value={gameConfig.startingShips}
                    onChange={(e) => setGameConfig({
                      ...gameConfig,
                      startingShips: Math.max(1, Math.min(10, parseInt(e.target.value) || 3))
                    })}
                    min="1"
                    max="10"
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Lives</label>
                  <input
                    type="number"
                    value={gameConfig.livesPerPlayer}
                    onChange={(e) => setGameConfig({
                      ...gameConfig,
                      livesPerPlayer: Math.max(1, Math.min(20, parseInt(e.target.value) || 5))
                    })}
                    min="1"
                    max="20"
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isCreating || !playerName.trim() || !roomName.trim()}
              className="w-full p-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg font-medium"
            >
              {isCreating ? 'Creating...' : 'Create Match'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="min-h-screen text-zinc-100 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Join Match</h1>
            <button
              onClick={() => onBack()}
              className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 rounded"
            >
              Back
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-100 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character room code"
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-wider font-mono"
                maxLength={6}
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={isJoining || !playerName.trim() || !roomCode.trim()}
              className="w-full p-4 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg font-medium"
            >
              {isJoining ? 'Joining...' : 'Join Match'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main menu - choose create or join
  return (
    <div className="min-h-screen text-zinc-100 p-4 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Eclipse: Second Dawn</h1>
          <p className="text-zinc-400 text-lg">Multiplayer Space Strategy</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setMode('create')}
            className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-lg font-semibold transition-colors"
          >
            Create Game
          </button>
          <button
            onClick={() => setMode('join')}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition-colors"
          >
            Join Game
          </button>
        </div>

        <div className="text-center text-zinc-500 text-sm">
          Build fleets, research technologies, explore the galaxy
        </div>
      </div>
    </div>
  );
}
