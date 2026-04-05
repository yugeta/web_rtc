import { Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import RoomPage from './pages/RoomPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppHeader from './components/AppHeader';
import { HeaderProvider } from './contexts/HeaderContext';

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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HeaderProvider>
  );
}

export default App;
