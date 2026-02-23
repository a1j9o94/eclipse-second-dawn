import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

interface VictoryScreenProps {
  roomId: Id<"rooms">;
  onReturnToLobby: () => void;
}

/**
 * Victory Screen - displays final scores and winner
 * Shown when game phase is "finished"
 */
export default function VictoryScreen({ roomId, onReturnToLobby }: VictoryScreenProps) {
  const gameResults = useQuery(api.queries.game.getGameResults, { roomId });

  if (!gameResults) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading results...</div>
      </div>
    );
  }

  const winner = gameResults.rankings[0];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Victory Banner */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-yellow-400 mb-4 animate-pulse">
            VICTORY!
          </h1>
          <div className="text-3xl font-bold mb-2">
            {winner.playerName}
          </div>
          <div className="text-xl text-gray-400">
            {winner.factionName}
          </div>
          <div className="text-5xl font-bold text-green-400 mt-4">
            {winner.victoryPoints} VP
          </div>
        </div>

        {/* Final Standings */}
        <div className="bg-gray-800 rounded-lg border-2 border-gray-700 overflow-hidden mb-8">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-2xl font-bold">Final Standings</h2>
          </div>

          <div className="divide-y divide-gray-700">
            {gameResults.rankings.map((player, index) => {
              const isWinner = index === 0;
              const medalColors = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];
              const medalEmojis = ['🥇', '🥈', '🥉'];

              return (
                <div
                  key={player.playerId}
                  className={`px-6 py-4 flex items-center justify-between ${
                    isWinner ? 'bg-yellow-900 bg-opacity-20' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`text-3xl ${index < 3 ? medalColors[index] : 'text-gray-500'}`}>
                      {index < 3 ? medalEmojis[index] : `#${player.rank}`}
                    </div>

                    <div className="flex-1">
                      <div className="text-xl font-bold">{player.playerName}</div>
                      <div className="text-sm text-gray-400">{player.factionName}</div>
                    </div>
                  </div>

                  <div className={`text-3xl font-bold ${isWinner ? 'text-yellow-400' : 'text-green-400'}`}>
                    {player.victoryPoints} VP
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Stats */}
        <div className="bg-gray-800 rounded-lg border-2 border-gray-700 p-6 mb-8">
          <h3 className="text-xl font-bold mb-4">Game Statistics</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-gray-400 text-sm mb-1">Rounds Played</div>
              <div className="text-2xl font-bold">{gameResults.totalRounds}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Players</div>
              <div className="text-2xl font-bold">{gameResults.rankings.length}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Duration</div>
              <div className="text-2xl font-bold">
                {Math.floor(gameResults.duration / 60000)}m
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={onReturnToLobby}
            className="px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
