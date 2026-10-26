import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorCodeOf, request } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/ErrorBanner';
import type { BookingWindow, Court } from '../lib/types';

export const CourtsPage = () => {
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    request<{ courts: Court[]; bookingWindow: BookingWindow }>('GET', '/courts')
      .then((res) => setCourts(res.courts))
      .catch((err) => setErrorCode(errorCodeOf(err)));
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Canchas</h1>
      <ErrorBanner code={errorCode} />
      {courts === null && !errorCode && <p className="text-slate-500">Cargando…</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {courts?.map((court) => (
          <li key={court.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">{court.name}</h2>
            {user ? (
              <Link to={`/courts/${court.id}`} className="mt-2 inline-block text-sm font-medium text-emerald-700 underline">
                Ver disponibilidad
              </Link>
            ) : (
              <Link
                to={`/login?next=${encodeURIComponent(`/courts/${court.id}`)}`}
                className="mt-2 inline-block text-sm text-slate-600 underline"
              >
                Inicia sesión para ver disponibilidad
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
