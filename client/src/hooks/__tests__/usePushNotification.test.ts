import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePushNotification } from '../usePushNotification';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('usePushNotification', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('isSupported', () => {
    it('should return false when PushManager is not available', () => {
      // jsdom doesn't have PushManager by default
      const { result } = renderHook(() => usePushNotification());
      expect(result.current.isSupported).toBe(false);
    });
  });

  describe('graceful degradation when unsupported', () => {
    it('should return safe defaults when Push API is not supported', () => {
      const { result } = renderHook(() => usePushNotification());

      expect(result.current.isSupported).toBe(false);
      expect(result.current.permission).toBe('default');
      expect(result.current.isSubscribed).toBe(false);
    });

    it('subscribe should be a no-op when unsupported', async () => {
      const { result } = renderHook(() => usePushNotification());

      // Should not throw
      await act(async () => {
        await result.current.subscribe();
      });

      expect(result.current.isSubscribed).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('unsubscribe should be a no-op when unsupported', async () => {
      const { result } = renderHook(() => usePushNotification());

      await act(async () => {
        await result.current.unsubscribe();
      });

      expect(result.current.isSubscribed).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('return type contract', () => {
    it('should return all required interface fields', () => {
      const { result } = renderHook(() => usePushNotification());

      expect(typeof result.current.isSupported).toBe('boolean');
      expect(typeof result.current.permission).toBe('string');
      expect(typeof result.current.isSubscribed).toBe('boolean');
      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.unsubscribe).toBe('function');
    });

    it('permission should be a valid NotificationPermission value', () => {
      const { result } = renderHook(() => usePushNotification());
      expect(['default', 'granted', 'denied']).toContain(result.current.permission);
    });
  });
});
