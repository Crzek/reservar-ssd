import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { errorCodeOf } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/ErrorBanner';

const safeNext = (next: string | null): string => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorCode(null);
    try {
      await login(email, password);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setErrorCode(errorCodeOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      {notice && !errorCode && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</p>
      )}
      <ErrorBanner code={errorCode} onClose={() => setErrorCode(null)} />
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Correo electrónico</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>
      <p className="text-sm">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-medium text-emerald-700 underline">
          Regístrate
        </Link>
      </p>
    </section>
  );
};
