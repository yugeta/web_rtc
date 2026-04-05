import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy, LogOut, Video, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoomName.trim();
    if (!name) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Room の作成に失敗しました');
      setNewRoomName('');
      setError(null);
      await fetchRooms();
    } catch {
      setError('Room の作成に失敗しました');
    }
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
    } catch {
      setError('Room の削除に失敗しました');
    }
  };

  const handleCopyUrl = async (roomId: string) => {
    const url = `${window.location.origin}/web_rtc/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('URL のコピーに失敗しました');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Video size={24} color="var(--accent)" />
          <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>WebRTC Meet</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={user.picture}
                alt={user.name}
                style={{ width: 32, height: 32, borderRadius: '50%' }}
                referrerPolicy="no-referrer"
              />
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{user.name}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              border: '1px solid var(--border)',
            }}
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '32px 24px', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
        )}

        {/* Create room form */}
        <form onSubmit={handleCreateRoom} style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
          <input
            type="text"
            placeholder="Room 名を入力"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="primary" style={{ whiteSpace: 'nowrap' }}>
            <Plus size={18} />
            Room 作成
          </button>
        </form>

        {/* Room list */}
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>読み込み中...</p>
        ) : rooms.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            Room がありません。新しい Room を作成してください。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rooms.map((room) => (
              <div
                key={room.id}
                style={{
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{room.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    作成日時: {formatDate(room.createdAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => navigate(`/room/${room.id}`)}
                    title="Room に参加"
                    className="primary"
                    style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <ExternalLink size={14} />
                    Room に行く
                  </button>
                  <button
                    onClick={() => handleCopyUrl(room.id)}
                    title="参加用 URL をコピー"
                    style={{
                      background: copiedId === room.id ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Copy size={14} />
                    {copiedId === room.id ? 'コピー済み' : 'URL 共有'}
                  </button>
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    title="Room を削除"
                    className="danger"
                    style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <Trash2 size={14} />
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