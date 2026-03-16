import React, { useState, useEffect } from 'react';
import { Video } from 'lucide-react';
import Room from './components/Room';
import PreJoin from './components/PreJoin';

// MediaSettings型定義
type MediaSettings = {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeakerEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
  outputDeviceId: string;
};

// Cookie管理のヘルパー関数
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

/**
 * URLクエリ文字列から `room` パラメータを解析し、バリデーション済みのルーム名を返す。
 * 無効な場合は null を返す。
 */
export function parseRoomQueryParam(search: string): string | null {
  const params = new URLSearchParams(search);
  const room = params.get('room');
  if (room && /^[a-zA-Z0-9_-]+$/.test(room)) {
    return room;
  }
  return null;
}

const setCookie = (name: string, value: string, days: number = 365) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
};

function App() {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [showPreJoin, setShowPreJoin] = useState(false);
  const [mediaSettings, setMediaSettings] = useState<MediaSettings | null>(null);

  // 初回レンダリング時にCookieから名前を読み込み、クエリパラメータからルームIDを設定する
  useEffect(() => {
    const savedName = getCookie('userName');
    if (savedName) {
      setUserName(decodeURIComponent(savedName));
    }

    const roomFromUrl = parseRoomQueryParam(window.location.search);
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim() !== '' && userName.trim() !== '') {
      // 名前をCookieに保存
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

  if (inRoom && mediaSettings) {
    return (
      <Room 
        roomId={roomId} 
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

  if (showPreJoin) {
    return (
      <PreJoin
        userName={userName}
        roomId={roomId}
        onJoin={handlePreJoinComplete}
        onCancel={handlePreJoinCancel}
      />
    );
  }

  return (
    <div className="home-container">
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ background: 'var(--accent)', padding: '16px', borderRadius: '20px', display: 'inline-block' }}>
            <Video size={48} color="white" />
          </div>
        </div>
        <h1>WebRTC Meet</h1>
        <p>シンプルで高速なビデオ会議</p>
        
        <form onSubmit={handleJoin} className="join-form">
          <input
            type="text"
            placeholder="あなたの名前"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            autoFocus
          />
          <input
            type="text"
            placeholder="Room ID を入力"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
          />
          <button type="submit" className="primary" style={{ width: '100%' }}>
            会議に参加する
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
