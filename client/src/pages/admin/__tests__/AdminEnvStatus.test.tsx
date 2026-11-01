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
    expect(screen.getByRole('button', { name: '再取得' })).toBeInTheDocument();
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
  });
});
