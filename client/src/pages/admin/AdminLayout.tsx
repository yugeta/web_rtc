import { NavLink, Outlet } from 'react-router-dom';
import { Users, FileText, Video, Activity } from 'lucide-react';
import './Admin.css';

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <nav className="admin-sidebar">
        <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          <Users size={16} /> ユーザー
        </NavLink>
        <NavLink to="/admin/logs" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          <FileText size={16} /> ログインログ
        </NavLink>
        <NavLink to="/admin/rooms" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          <Video size={16} /> 全 Room
        </NavLink>
        <NavLink to="/admin/monitor" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          <Activity size={16} /> モニター
        </NavLink>
      </nav>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
