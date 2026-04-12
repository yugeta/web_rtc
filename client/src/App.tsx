import { Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import RoomPage from './pages/RoomPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminUsers from './pages/admin/AdminUsers';
import AdminLogs from './pages/admin/AdminLogs';
import AdminRooms from './pages/admin/AdminRooms';
import AdminMonitor from './pages/admin/AdminMonitor';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AppHeader from './components/AppHeader';
import { HeaderProvider } from './contexts/HeaderContext';
import ReloadPrompt from './components/ReloadPrompt';

function NotFound() {
  return (
    <div className="home-container">
      <div className="glass-panel">
        <h1>ページが見つかりません</h1>
        <p>お探しのページは存在しません。</p>
        <Link to="/" style={{ color: 'var(--accent)', marginTop: '16px', display: 'inline-block' }}>
          トップページに戻る
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <HeaderProvider>
      <AppHeader />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/room/:id" element={<RoomPage />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminUsers />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="rooms" element={<AdminRooms />} />
          <Route path="monitor" element={<AdminMonitor />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ReloadPrompt />
    </HeaderProvider>
  );
}

export default App;
