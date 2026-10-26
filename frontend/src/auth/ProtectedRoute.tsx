import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { messageFor } from '../lib/errorMessages';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="text-slate-500">Cargando…</p>;
  if (user === null) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace state={{ notice: messageFor('UNAUTHENTICATED') }} />;
  }
  return <>{children}</>;
};
