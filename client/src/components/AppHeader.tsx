import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useHeader } from '../contexts/HeaderContext';
import './AppHeader.css';

export default function AppHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const { center } = useHeader();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  const handleLogout = () => { setMenuOpen(false); logout(); navigate('/'); };

  return (
    <header className="app-header">
      <div className="app-header-left" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <Video size={20} color="var(--accent)" />
        <span>WebRTC Meet</span>
      </div>

      {center && <div className="app-header-center">{center}</div>}

      <div className="app-header-right">
        {isAuthenticated && user ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: '50%' }}
            >
              <img
                src={user.picture} alt={user.name}
                style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--border)' }}
                referrerPolicy="no-referrer"
              />
            </button>
            {menuOpen && (
              <div className="app-header-menu">
                <div className="app-header-menu-name">{user.name}</div>
                <button onClick={() => { setMenuOpen(false); navigate('/dashboard'); }} className="app-header-menu-item">
                  <Settings size={14} /> 管理画面
                </button>
                <button onClick={handleLogout} className="app-header-menu-item">
                  <LogOut size={14} /> ログアウト
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
