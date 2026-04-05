import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Room from '../components/Room';
import PreJoin from '../components/PreJoin';
import type { MediaSettings } from '../components/PreJoin';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Cookie helpers
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

const setCookie = (name: string, value: string, days: number = 365) => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
};

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();

  const [userName, setUserName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [showPreJoin, setShowPreJoin] = useState(false);
  const [mediaSettings, setMediaSettings] = useState<MediaSettings | null>(null);
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved name from cookie
  useEffect(() => {
    const savedName = getCookie('userName');
    if (savedName) {
      setUserName(decodeURIComponent(savedName));
    }
  }, []);

  // Check room existence
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Room ID が指定されていません');
      return;
    }

    const checkRoom = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/rooms/${id}/exists`);
        if (res.ok) {
          const data = await res.json();
          setRoomExists(data.exists === true);
          if (data.exists) {
            setRoomName(data.name ?? null);
          } else {
            setError('この Room は存在しません');
          }
        } else {
          setRoomExists(false);
          setError('Room の確認中にエラーが発生しました');
        }
      } catch {
        setRoomExists(false);
        setError('サーバーに接続できません');
      } finally {
        setLoading(false);
      }
    };

    checkRoom();
  }, [id]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() !== '') {
      setCookie('userName', encodeURIComponent(userName.trim()));
      setShowPreJoin(true);
    }
  };

  const handlePreJoinComplete = (settings: MediaSettings) => {
    setMediaSettings(settings);
    setInRoom(true);
  };

  const handlePreJoinCancel = () => {
    setShowPreJoin(false);
  };

  if (loading) {
    return (
      <div className="home-container">
        <div className="glass-panel">
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !roomExists) {
    return (
      <div className="home-container">
        <div className="glass-panel">
          <h1>Room が見つかりません</h1>
          <p>{error || 'この Room は存在しません'}</p>
        </div>
      </div>
    );
  }

  if (inRoom && mediaSettings && id) {
    return (
      <Room
        roomId={id}
        roomName={roomName ?? undefined}
        userName={userName}
        initialSettings={mediaSettings}
        onLeave={() => {
          setInRoom(false);
          setShowPreJoin(false);
          setMediaSettings(null);
        }}
      />
    );
  }

  if (showPreJoin && id) {
    return (
      <PreJoin
        userName={userName}
        roomId={id}
        roomName={roomName ?? undefined}
        onJoin={handlePreJoinComplete}
        onCancel={handlePreJoinCancel}
      />
    );
  }

  // Name entry form (no room ID input needed — it comes from URL)
  return (
    <div className="home-container">
      <div className="glass-panel">
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {roomName ? `「${roomName}」Room に入る` : 'Room に入る'}
        </p>
        <form onSubmit={handleJoin} className="join-form">
          <input
            type="text"
            placeholder="あなたの名前"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            autoFocus
          />
          <button type="submit" className="primary">
            参加する
          </button>
        </form>
      </div>
    </div>
  );
}
