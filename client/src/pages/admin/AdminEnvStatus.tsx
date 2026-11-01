import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const POLL_INTERVAL = 30000;
const REQUEST_TIMEOUT_MS = 10000;

interface EnvStatusReport {
  ok: string[];
  missing: string[];
  warning: string[];
}

const failureGuidance = [
  'サーバーが停止していないか',
  '認証トークンが有効か',
  'GOOGLE_CLIENT_ID と JWT_SECRET が設定されているか',
  'Docker の再起動が必要か',
];

const sectionDefinitions = [
  {
    key: 'initial',
    title: '初期設定',
    items: ['GOOGLE_CLIENT_ID', 'JWT_SECRET', 'ADMIN_USER_IDS'],
    description: 'ログインと管理画面の基盤です。',
  },
  {
    key: 'notification',
    title: '通知設定',
    items: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'],
    description: 'Push 通知の送信に必要です。',
  },
  {
    key: 'webrtc',
    title: 'WebRTC / TURN',
    items: ['EXTERNAL_IP', 'TURN_REALM', 'TURN_USERNAME', 'TURN_PASSWORD'],
    description: '通話接続と NAT 越えに必要です。',
  },
  {
    key: 'network',
    title: '外部疎通',
    items: ['stun.mynt.work', 'sock.mynt.work', '3478 / 5349', '443 / 80'],
    description: 'サブドメインとポートの疎通確認を行います。',
  },
] as const;

const getStatusTone = (value: string, report: EnvStatusReport | null): 'ok' | 'warn' | 'danger' => {
  if (!report) return 'warn';
  if (report.missing.includes(value)) return 'danger';
  if (report.warning.includes(value)) return 'warn';
  if (report.ok.includes(value)) return 'ok';
  return 'warn';
};

export default function AdminEnvStatus() {
  const { token } = useAuth();
  const [report, setReport] = useState<EnvStatusReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!token) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${SERVER_URL}/api/admin/env-status`, {
        headers: { Authorization: 'Bearer ' + token },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error('環境設定の取得に失敗しました');
      }

      const data: EnvStatusReport = await res.json();
      setReport(data);
      setUpdatedAt(new Date().toLocaleString('ja-JP'));
    } catch (err) {
      const message = err instanceof Error && err.name === 'AbortError'
        ? '環境設定の取得がタイムアウトしました。サーバーまたは認証状態を確認してください。'
        : '環境設定の取得に失敗しました';

      setReport(null);
      setError(message);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [token]);

  const renderSection = (section: typeof sectionDefinitions[number]) => {
    const items = section.items.map((item) => ({
      name: item,
      tone: getStatusTone(item, report),
    }));

    return (
      <div className="admin-env-section" key={section.key}>
        <div className="admin-env-section-header">
          <div>
            <h3>{section.title}</h3>
            <p>{section.description}</p>
          </div>
        </div>

        <div className="admin-env-items">
          {items.map(({ name, tone }) => (
            <span key={name} className={`admin-env-pill ${tone}`}>
              {name}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="admin-env-header">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>環境設定</h2>
        <button type="button" className="admin-env-refresh" onClick={fetchStatus} disabled={loading}>
          <RefreshCcw size={14} style={{ transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
          {loading ? '取得中...' : '再取得'}
        </button>
      </div>

      {updatedAt && <div className="admin-env-updated">最終更新: {updatedAt}</div>}
      {error && (
        <div className="admin-env-error" role="alert">
          <p className="admin-env-error-summary">{error}</p>
          <ul className="admin-env-error-list">
            {failureGuidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && !report ? (
        <p style={{ color: 'var(--text-muted)' }}>環境設定を確認しています...</p>
      ) : !report ? (
        <div style={{ color: 'var(--text-muted)', padding: '12px 0' }}>
          環境設定を取得できませんでした。再取得を押して状態を確認してください。
        </div>
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

          <div className="admin-env-checklist">
            <div className="admin-env-checklist-title">初期設定チェック</div>
            <div className="admin-env-grid">{sectionDefinitions.map(renderSection)}</div>
          </div>
        </>
      )}
    </>
  );
}
