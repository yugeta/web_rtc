import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibilityState, mapVisibilityState } from '../useVisibilityState';

describe('mapVisibilityState', () => {
  it('maps "visible" to "foreground"', () => {
    expect(mapVisibilityState('visible')).toBe('foreground');
  });

  it('maps "hidden" to "background"', () => {
    expect(mapVisibilityState('hidden')).toBe('background');
  });
});

describe('useVisibilityState', () => {
  let mockSocket: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSocket = { emit: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits initial foreground state on mount when document is visible', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    renderHook(() => useVisibilityState(mockSocket as any, 'room-1'));

    expect(mockSocket.emit).toHaveBeenCalledWith('visibility-state', {
      state: 'foreground',
      roomId: 'room-1',
    });
  });

  it('emits initial background state on mount when document is hidden', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    renderHook(() => useVisibilityState(mockSocket as any, 'room-1'));

    expect(mockSocket.emit).toHaveBeenCalledWith('visibility-state', {
      state: 'background',
      roomId: 'room-1',
    });
  });

  it('emits background state when visibilitychange fires with hidden', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    renderHook(() => useVisibilityState(mockSocket as any, 'room-1'));
    mockSocket.emit.mockClear();

    // Simulate going to background
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockSocket.emit).toHaveBeenCalledWith('visibility-state', {
      state: 'background',
      roomId: 'room-1',
    });
  });

  it('emits foreground state when visibilitychange fires with visible', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    renderHook(() => useVisibilityState(mockSocket as any, 'room-1'));
    mockSocket.emit.mockClear();

    // Simulate coming back to foreground
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockSocket.emit).toHaveBeenCalledWith('visibility-state', {
      state: 'foreground',
      roomId: 'room-1',
    });
  });

  it('cleans up event listener on unmount', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useVisibilityState(mockSocket as any, 'room-1'));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('does not emit when socket is null', () => {
    renderHook(() => useVisibilityState(null, 'room-1'));
    // No error thrown, no emit called
  });

  it('does not emit when roomId is empty', () => {
    renderHook(() => useVisibilityState(mockSocket as any, ''));
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
