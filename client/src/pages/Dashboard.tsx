import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy, LogOut, Video, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

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
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
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

  const handleLogout = () => { logout(); navigate('/'); };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100vh' }}>
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <Video size={22} color="var(--accent)" />
          <span>WebRTC Meet</span>
        </div>
        <div className="dashboard-header-right">
          {user && (
            <div className="dashboard-user-info">
              <img src={user.picture} alt={user.name} style={{ width: 28, height: 28, borderRadius: '50%' }} referrerPolicy="no-referrer" />
              <span className="dashboard-user-name">{user.name}</span>
            </div>
          )}
          <button onClick={handleLogout} className="dashboard-logout-btn">
            <LogOut size={14} />
            <span>ログアウト</span>
          </button>
        </div>
      </header>

      <main className="dashboard-main">
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
                  <button onClick={() => navigate(`/room/${room.id}`)} title="Room に参加" className="primary">
                    <ExternalLink size={13} /><span className="btn-label">Room に行く</span>
                  </button>
                  <button onClick={() => handleCopyUrl(room.id)} title="参加用 URL をコピー" style={{ background: copiedId === room.id ? 'var(--accent)' : 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border)' }}>
                    <Copy size={13} /><span className="btn-label">{copiedId === room.id ? 'コピー済み' : 'URL 共有'}</span>
                  </button>
                  <button onClick={() => handleDeleteRoom(room.id)} title="Room を削除" className="danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
