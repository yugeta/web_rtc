import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Video } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (auth.isLoading) return null;
  if (auth.isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null);
    const credential = credentialResponse.credential;
    if (!credential) { setError('Google ログインに失敗しました。もう一度お試しください。'); return; }
    try { await auth.login(credential); }
    catch { setError('ログインに失敗しました。もう一度お試しください。'); }
  };

  return (
    <div className="home-container">
      <div className="glass-panel">
        <div className="home-icon-wrapper">
          <div className="home-icon-bg">
            <Video size={48} color="white" />
          </div>
        </div>
        <h1>WebRTC Meet</h1>
        <p>シンプルで高速なビデオ会議</p>
        {error && <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin onSuccess={handleSuccess} onError={() => setError('Google ログインに失敗しました。もう一度お試しください。')} />
        </div>
      </div>
    </div>
  );
}
