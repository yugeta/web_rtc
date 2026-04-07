import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const POLL_INTERVAL = 30000;
const MAX_POINTS = 60;

interface HealthData {
  uptime: number;
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number };
  activeRooms: number;
  activeConnections: number;
  registeredUsers: number;
  totalRooms: number;
  timestamp: string;
}

interface ChartPoint {
  time: string;
  memory: number;
  connections: number;
  rooms: number;
}

const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}日 ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
};

const fmtMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export default function AdminMonitor() {
  const { token } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/health`, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error('Failed');
      const data: HealthData = await res.json();
      setHealth(data);
      setError(null);
      const t = new Date(data.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory(prev => {
        const next = [...prev, { time: t, memory: parseFloat(fmtMB(data.memoryUsage.heapUsed)), connections: data.activeConnections, rooms: data.activeRooms }];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    } catch { setError('ヘルスチェックに失敗しました'); }
  };

  useEffect(() => {
    fetchHealth();
    timerRef.current = setInterval(fetchHealth, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        fetchHealth();
        timerRef.current = setInterval(fetchHealth, POLL_INTERVAL);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token]);

  const statStyle = { background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', textAlign: 'center' as const };
  const labelStyle = { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' };
  const valueStyle = { fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' as const };

  return (
    <>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>サーバーモニター</h2>
      {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

      {health && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={statStyle}>
              <div style={labelStyle}>稼働時間</div>
              <div style={{ ...valueStyle, fontSize: '1.1rem' }}>{fmtUptime(health.uptime)}</div>
            </div>
            <div style={statStyle}>
              <div style={labelStyle}>メモリ (Heap)</div>
              <div style={valueStyle}>{fmtMB(health.memoryUsage.heapUsed)} MB</div>
            </div>
            <div style={statStyle}>
              <div style={labelStyle}>接続ユーザー</div>
              <div style={valueStyle}>{health.activeConnections}</div>
            </div>
            <div style={statStyle}>
              <div style={labelStyle}>稼働 Room</div>
              <div style={valueStyle}>{health.activeRooms}</div>
            </div>
            <div style={statStyle}>
              <div style={labelStyle}>登録ユーザー</div>
              <div style={valueStyle}>{health.registeredUsers}</div>
            </div>
            <div style={statStyle}>
              <div style={labelStyle}>全 Room</div>
              <div style={valueStyle}>{health.totalRooms}</div>
            </div>
          </div>

          {history.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>メモリ使用量 (MB)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={history}>
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px' }} />
                    <Line type="monotone" dataKey="memory" stroke="#3b82f6" strokeWidth={2} dot={false} name="Heap" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>接続数 / 稼働 Room</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={history}>
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="connections" stroke="#10b981" strokeWidth={2} dot={false} name="接続ユーザー" />
                    <Line type="monotone" dataKey="rooms" stroke="#f59e0b" strokeWidth={2} dot={false} name="稼働 Room" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
            最終更新: {new Date(health.timestamp).toLocaleString('ja-JP')}（{POLL_INTERVAL / 1000}秒間隔で自動更新）
          </p>
        </>
      )}
    </>
  );
}
