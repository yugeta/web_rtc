import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface User { sub: string; name: string; email: string; picture: string; registeredAt: string; lastLoginAt: string; }

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = async () => {
    if (!token) return;
    const res = await fetch(`${SERVER_URL}/api/admin/users`, { headers: { Authorization: 'Bearer ' + token } });
    if (res.ok) setUsers(await res.json());
  };

  useEffect(() => { fetchUsers(); }, [token]);

  const handleDelete = async (sub: string) => {
    if (!confirm('このユーザーを削除しますか？')) return;
    await fetch(`${SERVER_URL}/api/admin/users/${sub}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    fetchUsers();
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString('ja-JP');

  return (
    <>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>ユーザー一覧（{users.length}件）</h2>
      <table className="admin-table">
        <thead><tr><th>名前</th><th>メール</th><th>登録日</th><th>最終ログイン</th><th></th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.sub}>
              <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={u.picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} referrerPolicy="no-referrer" />
                {u.name}
              </td>
              <td>{u.email}</td>
              <td>{fmt(u.registeredAt)}</td>
              <td>{fmt(u.lastLoginAt)}</td>
              <td><button onClick={() => handleDelete(u.sub)} className="danger" style={{ padding: '4px 8px' }}><Trash2 size={12} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
