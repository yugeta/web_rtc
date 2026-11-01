import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  console.log('[AdminRoute]', { isAuthenticated, isLoading, isAdmin: user?.isAdmin });

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!user?.isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
