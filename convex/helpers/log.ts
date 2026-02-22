// Stub logging helpers for old roguelike code
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const logInfo = (_tag: string, _msg: string, _extra?: Record<string, unknown>) => {
  // No-op for now
};

export const roomTag = (roomId: string) => `room:${roomId}`;
