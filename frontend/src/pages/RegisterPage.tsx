import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorCodeOf } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/ErrorBanner';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorCode(null);
    try {
      await register(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setErrorCode(errorCodeOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Crear cuenta</h1>
      <ErrorBanner code={errorCode} onClose={() => setErrorCode(null)} />
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Correo electrónico</span>
          <input
            type="email"
            required
            maxLength={254}
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
            minLength={8}
            autoComplete="new-password"
            aria-describedby="password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <span id="password-hint" className="mt-1 block text-xs text-slate-500">
            Mínimo 8 caracteres
          </span>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Creando cuenta…' : 'Registrarse'}
        </button>
      </form>
      <p className="text-sm">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-emerald-700 underline">
          Inicia sesión
        </Link>
      </p>
    </section>
  );
};
