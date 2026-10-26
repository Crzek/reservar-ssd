import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { CourtAvailabilityPage } from './pages/CourtAvailabilityPage';
import { CourtsPage } from './pages/CourtsPage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout().catch(() => {});
    navigate('/login');
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="text-lg font-bold text-emerald-700">
          Club de Pádel
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link to="/" className="font-medium text-slate-700 hover:text-slate-900">
            Canchas
          </Link>
          {user ? (
            <>
              <Link to="/my-reservations" className="font-medium text-slate-700 hover:text-slate-900">
                Mis Reservas
              </Link>
              <span className="min-w-0 break-all text-slate-500">{user.email}</span>
              <button type="button" onClick={onLogout} className="font-medium text-slate-700 hover:text-slate-900">
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="font-medium text-slate-700 hover:text-slate-900">
                Iniciar sesión
              </Link>
              <Link to="/register" className="font-medium text-emerald-700 hover:text-emerald-900">
                Registrarse
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export const App = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header />
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<CourtsPage />} />
        <Route
          path="/courts/:courtId"
          element={
            <ProtectedRoute>
              <CourtAvailabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-reservations"
          element={
            <ProtectedRoute>
              <MyReservationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
);
