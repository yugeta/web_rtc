import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminEnvStatus from '../AdminEnvStatus';

const fetchMock = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'mock-token' }),
}));

describe('AdminEnvStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock as typeof fetch;
  });

  it('shows a recoverable error instead of the loading state when fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    render(<AdminEnvStatus />);

    expect(await screen.findByText('環境設定の取得に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('サーバーが停止していないか')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再取得' })).toBeInTheDocument();
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
  });

  it('lists the failing environment checks when the report is loaded', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: ['VAPID_PUBLIC_KEY'],
        missing: ['GOOGLE_CLIENT_ID', 'JWT_SECRET'],
        warning: ['TURN_USERNAME'],
      }),
    });

    render(<AdminEnvStatus />);

    expect(await screen.findByText('GOOGLE_CLIENT_ID')).toBeInTheDocument();
    expect(await screen.findByText('JWT_SECRET')).toBeInTheDocument();
    expect(screen.getByText('不足している設定')).toBeInTheDocument();
  });
});
