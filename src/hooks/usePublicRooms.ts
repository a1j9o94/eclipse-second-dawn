import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export type PublicRoomItem = {
  roomId: string;
  roomCode: string;
  roomName: string;
  currentPlayers: number;
  maxPlayers: number;
  startingShips: number;
  livesPerPlayer: number;
  hostName: string;
  hostLives: number;
  createdAt: number;
};

export function usePublicRooms() {
  const isTestEnv = Boolean((import.meta as unknown as { vitest?: unknown }).vitest) || import.meta.env.MODE === 'test';
  const isConvexAvailable = !!import.meta.env.VITE_CONVEX_URL && !isTestEnv;

  // In tests or without Convex URL, return a stable stub
  if (!isConvexAvailable) {
    return {
      rooms: [] as PublicRoomItem[],
      isLoading: false,
    } as const;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rooms = useQuery(api.queries.rooms.getPublicRoomsDetailed, {});
  return {
    rooms: rooms ?? [],
    isLoading: rooms === undefined,
  } as const;
}

