import { useState } from 'react';
import { usePublicRooms } from '../hooks/usePublicRooms';
import { useMultiplayerGame } from '../hooks/useMultiplayerGame';

type Props = {
  onBack: () => void;
  onRoomJoined: (roomId: string) => void;
  onCreatePublic: () => void;
  defaultName?: string;
};

export default function PublicLobbyPage({ onBack, onRoomJoined, onCreatePublic, defaultName }: Props) {
  const [playerName, setPlayerName] = useState(defaultName ?? '');
  const [error, setError] = useState('');
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const { rooms, isLoading } = usePublicRooms();
  const { joinRoom } = useMultiplayerGame(null);

  const handleJoin = async (roomCode: string) => {
    if (!playerName.trim()) {
      setError('Player name is required');
      return;
    }
    setError('');
    setJoiningCode(roomCode);
    try {
      const res = await joinRoom(roomCode, playerName.trim());
      onRoomJoined(res.roomId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    } finally {
      setJoiningCode(null);
    }
  };

  return (
    <div className="min-h-screen text-zinc-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Public Matchmaking</h1>
          <div className="flex items-center gap-2">
            <button onClick={onCreatePublic} className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 rounded">Create Public Game</button>
            <button onClick={onBack} className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 rounded">Back</button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-100 text-sm">{error}</div>
        )}

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

        <div className="bg-zinc-800 border border-zinc-700 rounded-lg">
          <div className="p-3 border-b border-zinc-700 text-sm text-zinc-300">Joinable Rooms</div>
          {isLoading ? (
            <div className="p-4 text-zinc-400">Loading…</div>
          ) : rooms.length === 0 ? (
            <div className="p-4 text-zinc-400">No public rooms available right now.</div>
          ) : (
            <ul className="divide-y divide-zinc-700">
              {rooms.map((r: any) => (
                <li key={r.roomId} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.roomName} <span className="text-xs opacity-70">({r.currentPlayers}/{r.maxPlayers})</span></div>
                    <div className="text-sm text-zinc-400">
                      Host: {r.hostName} • Lives: {r.hostLives} • Ships: {r.startingShips}
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoin(r.roomCode)}
                    disabled={joiningCode === r.roomCode}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm disabled:opacity-50"
                  >
                    {joiningCode === r.roomCode ? 'Joining…' : 'Join'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
