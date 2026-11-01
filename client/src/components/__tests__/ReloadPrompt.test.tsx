import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the virtual module before importing the component
const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);
let mockNeedRefresh = false;
const mockSetNeedRefresh = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: { onRegisterError?: (error: unknown) => void }) => {
    // Store options for testing error handler
    if (options?.onRegisterError) {
      (vi.mock as unknown as Record<string, unknown>).__onRegisterError = options.onRegisterError;
    }
    return {
      needRefresh: [mockNeedRefresh, mockSetNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

import ReloadPrompt from '../ReloadPrompt';

describe('ReloadPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNeedRefresh = false;
  });

  it('renders nothing when needRefresh is false', () => {
    mockNeedRefresh = false;
    const { container } = render(<ReloadPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('renders update prompt when needRefresh is true', () => {
    mockNeedRefresh = true;
    render(<ReloadPrompt />);
    expect(screen.getByText('新しいバージョンが利用可能です')).toBeInTheDocument();
    expect(screen.getByText('更新する')).toBeInTheDocument();
  });

  it('calls updateServiceWorker when update button is clicked', async () => {
    mockNeedRefresh = true;
    const user = userEvent.setup();
    render(<ReloadPrompt />);

    await user.click(screen.getByText('更新する'));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('dismisses prompt when close button is clicked', async () => {
    mockNeedRefresh = true;
    const user = userEvent.setup();
    render(<ReloadPrompt />);

    await user.click(screen.getByLabelText('閉じる'));
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('has role="alert" for accessibility', () => {
    mockNeedRefresh = true;
    render(<ReloadPrompt />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
