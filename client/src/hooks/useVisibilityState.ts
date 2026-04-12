import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';

type VisibilityState = 'foreground' | 'background';

/**
 * Map browser's document.visibilityState to our domain model.
 */
export function mapVisibilityState(state: DocumentVisibilityState): VisibilityState {
  return state === 'visible' ? 'foreground' : 'background';
}

/**
 * Page Visibility API による状態検出と Socket.IO 経由での通知を行うフック。
 * Requirements: 8.1, 8.2, 8.3
 */
export function useVisibilityState(socket: Socket | null, roomId: string): void {
  useEffect(() => {
    if (!socket || !roomId) return;

    // Emit initial state on mount
    const initialState = mapVisibilityState(document.visibilityState);
    socket.emit('visibility-state', { state: initialState, roomId });

    const handleVisibilityChange = () => {
      const state = mapVisibilityState(document.visibilityState);
      socket.emit('visibility-state', { state, roomId });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, roomId]);
}
