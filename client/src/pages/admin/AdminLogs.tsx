import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface LogEntry { timestamp: string; sub: string; name: string; email: string; }

export default function AdminLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchLogs = async () => {
    if (!token) return;
    const res = await fetch(`${SERVER_URL}/api/admin/logs?page=${page}&limit=${limit}`, { headers: { Authorization: 'Bearer ' + token } });
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    }
  };

  useEffect(() => { fetchLogs(); }, [token, page]);

  const totalPages = Math.ceil(total / limit);
  const fmt = (iso: string) => new Date(iso).toLocaleString('ja-JP');

  return (
    <>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>ログインログ（{total}件）</h2>
      <table className="admin-table">
        <thead><tr><th>日時</th><th>名前</th><th>メール</th></tr></thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i}>
              <td>{fmt(l.timestamp)}</td>
              <td>{l.name}</td>
              <td>{l.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>前へ</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>次へ</button>
        </div>
      )}
    </>
  );
}
