import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);
let mockNeedRefresh = false;
const mockSetNeedRefresh = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: { onRegisterError?: (error: unknown) => void }) => {
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
    expect(screen.getByText('アプリの更新を反映するには再読み込みが必要です')).toBeInTheDocument();
    expect(screen.getByText('更新して再読込')).toBeInTheDocument();
  });

  it('calls updateServiceWorker when update button is clicked', async () => {
    mockNeedRefresh = true;
    const user = userEvent.setup();
    render(<ReloadPrompt />);

    await user.click(screen.getByText('更新して再読込'));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('dismisses prompt when close button is clicked', async () => {
    mockNeedRefresh = true;
    const user = userEvent.setup();
    render(<ReloadPrompt />);

    await user.click(screen.getByLabelText('閉じる'));
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('renders the success notice after update completes', async () => {
    mockNeedRefresh = true;
    const user = userEvent.setup();
    render(<ReloadPrompt />);

    await user.click(screen.getByText('更新して再読込'));
    expect(screen.getByText('更新しました。ページを再読込しています。')).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    mockNeedRefresh = true;
    render(<ReloadPrompt />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
