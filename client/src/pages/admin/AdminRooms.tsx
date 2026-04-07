import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface Room { id: string; name: string; ownerId: string; ownerName: string; createdAt: string; }

export default function AdminRooms() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);

  const fetchRooms = async () => {
    if (!token) return;
    const res = await fetch(`${SERVER_URL}/api/admin/rooms`, { headers: { Authorization: 'Bearer ' + token } });
    if (res.ok) setRooms(await res.json());
  };

  useEffect(() => { fetchRooms(); }, [token]);

  const handleDelete = async (id: string) => {
    if (!confirm('この Room を削除しますか？')) return;
    await fetch(`${SERVER_URL}/api/admin/rooms/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    fetchRooms();
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString('ja-JP');

  return (
    <>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>全 Room（{rooms.length}件）</h2>
      <table className="admin-table">
        <thead><tr><th>Room 名</th><th>作成者</th><th>作成日</th><th></th></tr></thead>
        <tbody>
          {rooms.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.ownerName}</td>
              <td>{fmt(r.createdAt)}</td>
              <td><button onClick={() => handleDelete(r.id)} className="danger" style={{ padding: '4px 8px' }}><Trash2 size={12} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
