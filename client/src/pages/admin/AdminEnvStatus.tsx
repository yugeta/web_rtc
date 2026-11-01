import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const POLL_INTERVAL = 30000;

interface EnvStatusReport {
  ok: string[];
  missing: string[];
  warning: string[];
}

export default function AdminEnvStatus() {
  const { token } = useAuth();
  const [report, setReport] = useState<EnvStatusReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/env-status`, {
        headers: { Authorization: 'Bearer ' + token },
      });

      if (!res.ok) {
        throw new Error('環境設定の取得に失敗しました');
      }

      const data: EnvStatusReport = await res.json();
      setReport(data);
      setError(null);
      setUpdatedAt(new Date().toLocaleString('ja-JP'));
    } catch {
      setError('環境設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [token]);

  const renderList = (title: string, items: string[], tone: 'ok' | 'warn' | 'danger') => {
    const sortedItems = [...items].sort((a, b) => a.localeCompare(b, 'ja'));

    return (
      <div className={`admin-env-panel ${tone}`}>
        <div className="admin-env-panel-header">
          {tone === 'ok' ? <CheckCircle2 size={16} /> : tone === 'warn' ? <AlertTriangle size={16} /> : <ShieldAlert size={16} />}
          <span>{title}</span>
          <span className="admin-env-panel-count">{sortedItems.length}</span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="admin-env-empty">なし</div>
        ) : (
          <div className="admin-env-list">
            {sortedItems.map((item) => (
              <span key={item} className={`admin-env-pill ${tone}`}>
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="admin-env-header">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>環境設定状態</h2>
        <button type="button" className="admin-env-refresh" onClick={fetchStatus} disabled={loading}>
          <RefreshCcw size={14} style={{ transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
          {loading ? '更新中...' : '更新'}
        </button>
      </div>

      {updatedAt && <div className="admin-env-updated">最終更新: {updatedAt}</div>}
      {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

      {!report ? (
        <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
      ) : (
        <>
          <div className="admin-env-summary">
            <div className="admin-env-summary-item ok">
              <span className="label">正常</span>
              <strong>{report.ok.length}</strong>
            </div>
            <div className="admin-env-summary-item warning">
              <span className="label">要確認</span>
              <strong>{report.warning.length}</strong>
            </div>
            <div className="admin-env-summary-item danger">
              <span className="label">不足</span>
              <strong>{report.missing.length}</strong>
            </div>
          </div>

          <div className="admin-env-grid">
            {renderList('設定済み', report.ok, 'ok')}
            {renderList('要確認', report.warning, 'warn')}
            {renderList('不足', report.missing, 'danger')}
          </div>
        </>
      )}
    </>
  );
}
