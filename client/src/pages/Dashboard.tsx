import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Copy, ExternalLink, Send, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationPrompt from '../components/NotificationPrompt';
import InviteDialog from '../components/InviteDialog';
import './Dashboard.css';

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'checking';

interface PermissionStatus {
  camera: PermissionState;
  microphone: PermissionState;
}

function usePermissionCheck() {
  const [status, setStatus] = useState<PermissionStatus>({ camera: 'checking', microphone: 'checking' });

  useEffect(() => {
    let mounted = true;

    const check = async (name: string): Promise<PermissionState> => {
      try {
        const result = await navigator.permissions.query({ name: name as PermissionName });
        return result.state as PermissionState;
      } catch {
        return 'unsupported';
      }
    };

    Promise.all([check('camera'), check('microphone')]).then(([cam, mic]) => {
      if (mounted) setStatus({ camera: cam, microphone: mic });
    });

    return () => { mounted = false; };
  }, []);

  return status;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface Room {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  settings: Record<string, unknown>;
}

export default function Dashboard() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(null);
  const permissions = usePermissionCheck();

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!res.ok) throw new Error('Room 一覧の取得に失敗しました');
      const data = await res.json();
      setRooms(data);
      setError(null);
    } catch {
      setError('Room 一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoomName.trim();
    if (!name) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Room の作成に失敗しました');
      setNewRoomName('');
      setError(null);
      await fetchRooms();
    } catch { setError('Room の作成に失敗しました'); }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm('この Room を削除しますか？')) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!res.ok) throw new Error('Room の削除に失敗しました');
      setError(null);
      await fetchRooms();
    } catch { setError('Room の削除に失敗しました'); }
  };

  const handleCopyUrl = async (roomId: string) => {
    const url = `${window.location.origin}/web_rtc/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { setError('URL のコピーに失敗しました'); }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const deniedPermissions: string[] = [];
  if (permissions.camera === 'denied') deniedPermissions.push('カメラ');
  if (permissions.microphone === 'denied') deniedPermissions.push('マイク');

  return (
    <main className="dashboard-main">
        {deniedPermissions.length > 0 && (
          <div className="permission-banner">
            <AlertTriangle size={16} />
            <span>
              {deniedPermissions.join('・')}へのアクセスがブロックされています。
              ブラウザのアドレスバー付近の設定から許可してください。
            </span>
          </div>
        )}
        <NotificationPrompt />
        {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        <form onSubmit={handleCreateRoom} className="dashboard-create-form">
          <input type="text" placeholder="Room 名を入力" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} />
          <button type="submit" className="primary" style={{ whiteSpace: 'nowrap' }}>
            <Plus size={16} /> Room 作成
          </button>
        </form>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>読み込み中...</p>
        ) : rooms.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Room がありません。新しい Room を作成してください。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rooms.map((room) => (
              <div key={room.id} className="dashboard-room-card">
                <div className="dashboard-room-info">
                  <div className="dashboard-room-name">{room.name}</div>
                  <div className="dashboard-room-date">{formatDate(room.createdAt)}</div>
                </div>
                <div className="dashboard-room-actions">
                  <button onClick={() => window.open(`/web_rtc/room/${room.id}`, '_blank')} title="Room に参加" className="primary">
                    <ExternalLink size={13} /><span className="btn-label">Room に行く</span>
                  </button>
                  <button onClick={() => handleCopyUrl(room.id)} title="参加用 URL をコピー" style={{ background: copiedId === room.id ? 'var(--accent)' : 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border)' }}>
                    <Copy size={13} /><span className="btn-label">{copiedId === room.id ? 'コピー済み' : 'URL 共有'}</span>
                  </button>
                  <button onClick={() => setInviteRoomId(room.id)} title="招待通知を送信" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border)' }}>
                    <Send size={13} /><span className="btn-label">招待</span>
                  </button>
                  <button onClick={() => handleDeleteRoom(room.id)} title="Room を削除" className="danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {inviteRoomId && (
          <InviteDialog roomId={inviteRoomId} onClose={() => setInviteRoomId(null)} />
        )}
      </main>
  );
}
