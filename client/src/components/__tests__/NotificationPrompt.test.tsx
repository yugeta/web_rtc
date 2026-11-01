import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationPrompt from '../NotificationPrompt';

// Mock the usePushNotification hook
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
let mockHookReturn = {
  isSupported: true,
  permission: 'default' as NotificationPermission,
  isSubscribed: false,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
};

vi.mock('../../hooks/usePushNotification', () => ({
  usePushNotification: () => mockHookReturn,
}));

describe('NotificationPrompt', () => {
  beforeEach(() => {
    cleanup();
    mockSubscribe.mockReset();
    mockUnsubscribe.mockReset();
    mockHookReturn = {
      isSupported: true,
      permission: 'default',
      isSubscribed: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
    };
  });

  it('renders when isSupported=true, permission=default, isSubscribed=false', () => {
    render(<NotificationPrompt />);
    expect(screen.getByText('通知を有効にする')).toBeInTheDocument();
  });

  it('does not render when Push API is not supported (Req 3.6)', () => {
    mockHookReturn = { ...mockHookReturn, isSupported: false };
    const { container } = render(<NotificationPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render when permission is granted', () => {
    mockHookReturn = { ...mockHookReturn, permission: 'granted' };
    const { container } = render(<NotificationPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render when permission is denied', () => {
    mockHookReturn = { ...mockHookReturn, permission: 'denied' };
    const { container } = render(<NotificationPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render when already subscribed', () => {
    mockHookReturn = { ...mockHookReturn, isSubscribed: true };
    const { container } = render(<NotificationPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('calls subscribe when enable button is clicked (Req 3.2, 3.3)', async () => {
    mockSubscribe.mockResolvedValue(undefined);
    render(<NotificationPrompt />);
    const button = screen.getByText('通知を有効にする');
    fireEvent.click(button);
    expect(mockSubscribe).toHaveBeenCalledOnce();
  });

  it('dismisses the prompt when close button is clicked', () => {
    render(<NotificationPrompt />);
    const closeButton = screen.getByLabelText('閉じる');
    fireEvent.click(closeButton);
    expect(screen.queryByText('通知を有効にする')).not.toBeInTheDocument();
  });

  it('has role=alert for accessibility', () => {
    render(<NotificationPrompt />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
