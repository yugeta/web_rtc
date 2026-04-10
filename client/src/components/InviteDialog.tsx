import { useState, useEffect, useCallback } from 'react';
import { Send, Users, X, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface InviteUser {
  sub: string;
  name: string;
  picture: string;
}

interface InviteDialogProps {
  roomId: string;
  onClose: () => void;
}

interface SendResult {
  sent: number;
  failed: number;
}

export default function InviteDialog({ roomId, onClose }: InviteDialogProps) {
  const { token } = useAuth();
  const [users, setUsers] = useState<InviteUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/push/users`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) throw new Error('ユーザー一覧の取得に失敗しました');
      const data = await res.json();
      setUsers(data);
    } catch {
      setError('ユーザー一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleUser = (sub: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sub)) next.delete(sub);
      else next.add(sub);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0 || !token) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/push/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          roomId,
          targetUserSubs: Array.from(selected),
        }),
      });
      if (!res.ok) throw new Error('招待の送信に失敗しました');
      const data: SendResult = await res.json();
      setResult(data);
    } catch {
      setError('招待の送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="invite-dialog-overlay" onClick={handleOverlayClick}>
      <div className="invite-dialog" role="dialog" aria-label="招待送信">
        <div className="invite-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} />
            <span style={{ fontWeight: 600, fontSize: '15px' }}>招待を送信</span>
          </div>
          <button
            onClick={onClose}
            className="invite-dialog-close"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        <div className="invite-dialog-body">
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              読み込み中...
            </p>
          ) : error && !result ? (
            <p style={{ color: 'var(--danger)', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>
              {error}
            </p>
          ) : result ? (
            <div className="invite-dialog-result">
              <Check size={32} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>送信完了</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                成功: {result.sent}件
                {result.failed > 0 && (
                  <span style={{ color: 'var(--danger)' }}> / 失敗: {result.failed}件</span>
                )}
              </p>
              <button
                onClick={onClose}
                className="primary"
                style={{ marginTop: '16px', width: '100%' }}
              >
                閉じる
              </button>
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <AlertCircle size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                招待可能なユーザーがいません
              </p>
            </div>
          ) : (
            <>
              <div className="invite-dialog-user-list">
                {users.map((user) => (
                  <label key={user.sub} className="invite-dialog-user-item">
                    <input
                      type="checkbox"
                      checked={selected.has(user.sub)}
                      onChange={() => toggleUser(user.sub)}
                    />
                    <img
                      src={user.picture}
                      alt=""
                      className="invite-dialog-avatar"
                    />
                    <span className="invite-dialog-user-name">{user.name}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleSend}
                disabled={selected.size === 0 || sending}
                className="primary invite-dialog-send-btn"
              >
                <Send size={14} />
                {sending ? '送信中...' : `招待を送信 (${selected.size})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
