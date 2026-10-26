import { useCallback, useEffect, useState } from 'react';
import { errorCodeOf, request } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatLongDate, formatLongDateCapitalized } from '../lib/dates';
import type { MyReservations, Reservation } from '../lib/types';

type ReservationListProps = { title: string; items: Reservation[]; onCancel?: (r: Reservation) => void };

const ReservationList = ({ title, items, onCancel }: ReservationListProps) => (
  <section className="space-y-2">
    <h2 className="text-lg font-semibold">{title}</h2>
    {items.length === 0 ? (
      <p className="text-sm text-slate-500">Sin reservas.</p>
    ) : (
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <p className="font-medium">{r.court.name}</p>
              <p className="text-sm text-slate-600">
                {formatLongDateCapitalized(r.date)} · {r.label}
              </p>
            </div>
            {onCancel && r.cancellable && (
              <button
                type="button"
                onClick={() => onCancel(r)}
                className="rounded-md border border-rose-300 px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Cancelar
              </button>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const MyReservationsPage = () => {
  const [data, setData] = useState<MyReservations | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await request<MyReservations>('GET', '/reservations/me'));
    } catch (err) {
      setErrorCode(errorCodeOf(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeDialog = useCallback(() => setToCancel(null), []);

  const onConfirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    setErrorCode(null);
    try {
      await request<void>('DELETE', `/reservations/${toCancel.id}`);
    } catch (err) {
      setErrorCode(errorCodeOf(err));
    } finally {
      setCancelling(false);
      setToCancel(null);
      await load();
    }
  };

  const empty = data !== null && data.upcoming.length === 0 && data.history.length === 0;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Mis Reservas</h1>
      <ErrorBanner code={errorCode} onClose={() => setErrorCode(null)} />
      {data === null && !errorCode && <p className="text-slate-500">Cargando…</p>}
      {empty && <p className="text-slate-600">Aún no tienes reservas</p>}
      {data && !empty && (
        <>
          <ReservationList title="Próximas" items={data.upcoming} onCancel={(r) => setToCancel(r)} />
          <ReservationList title="Historial" items={data.history} />
        </>
      )}
      <ConfirmDialog
        open={toCancel !== null}
        title="Cancelar reserva"
        message={
          toCancel
            ? `¿Seguro que quieres cancelar la reserva de ${toCancel.court.name} el ${formatLongDate(toCancel.date)} de ${toCancel.label}?`
            : ''
        }
        confirmLabel="Sí, cancelar"
        cancelLabel="No"
        onConfirm={onConfirmCancel}
        onCancel={closeDialog}
        busy={cancelling}
      />
    </section>
  );
};
