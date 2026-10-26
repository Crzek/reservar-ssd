import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorCodeOf, request } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DayPicker } from '../components/DayPicker';
import { ErrorBanner } from '../components/ErrorBanner';
import { SlotGrid } from '../components/SlotGrid';
import { formatLongDate } from '../lib/dates';
import type { Availability, BookingWindow, Court, Reservation } from '../lib/types';

export const CourtAvailabilityPage = () => {
  const { courtId = '' } = useParams();
  const [date, setDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Reservation | null>(null);

  // Primera carga: la fecha por defecto (hoy del club) la da el backend.
  useEffect(() => {
    request<{ courts: Court[]; bookingWindow: BookingWindow }>('GET', '/courts')
      .then((res) => setDate(res.bookingWindow.from))
      .catch((err) => setErrorCode(errorCodeOf(err)));
  }, []);

  const loadAvailability = useCallback(
    async (forDate: string) => {
      try {
        const res = await request<Availability>(
          'GET',
          `/courts/${encodeURIComponent(courtId)}/availability?date=${encodeURIComponent(forDate)}`,
        );
        setAvailability(res);
      } catch (err) {
        setErrorCode(errorCodeOf(err));
      }
    },
    [courtId],
  );

  useEffect(() => {
    if (date) void loadAvailability(date);
  }, [date, loadAvailability]);

  const onChangeDate = (next: string) => {
    setErrorCode(null);
    setConfirmed(null);
    setDate(next);
  };

  const onSelect = (hour: number) => {
    setErrorCode(null);
    setConfirmed(null);
    setSelectedHour(hour);
  };

  const closeDialog = useCallback(() => setSelectedHour(null), []);

  const onConfirm = async () => {
    if (!availability || selectedHour === null) return;
    setSubmitting(true);
    try {
      const reservation = await request<Reservation>('POST', '/reservations', {
        courtId: availability.court.id,
        date: availability.date,
        startHour: selectedHour,
      });
      setConfirmed(reservation);
    } catch (err) {
      setErrorCode(errorCodeOf(err));
    } finally {
      setSubmitting(false);
      setSelectedHour(null);
      // Tras éxito o conflicto se muestra el estado actualizado (FR-015, research R10).
      await loadAvailability(availability.date);
    }
  };

  const selectedSlot = availability?.slots.find((s) => s.startHour === selectedHour);

  return (
    <section className="space-y-4">
      <Link to="/" className="text-sm text-slate-600 underline">
        ← Canchas
      </Link>
      <h1 className="text-2xl font-bold">{availability?.court.name ?? 'Disponibilidad'}</h1>
      <ErrorBanner code={errorCode} onClose={() => setErrorCode(null)} />
      {confirmed && (
        <div role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Reserva confirmada: {confirmed.court.name}, {formatLongDate(confirmed.date)} de {confirmed.label}.{' '}
          <Link to="/my-reservations" className="font-medium underline">
            Ver Mis Reservas
          </Link>
        </div>
      )}
      {availability && date ? (
        <>
          <DayPicker window={availability.bookingWindow} value={date} onChange={onChangeDate} />
          <SlotGrid slots={availability.slots} onSelect={onSelect} disabled={submitting} />
        </>
      ) : (
        !errorCode && <p className="text-slate-500">Cargando…</p>
      )}
      <ConfirmDialog
        open={selectedSlot !== undefined && availability !== null}
        title="Confirmar reserva"
        message={
          availability && selectedSlot
            ? `Reservar ${availability.court.name} el ${formatLongDate(availability.date)} de ${selectedSlot.label}`
            : ''
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={onConfirm}
        onCancel={closeDialog}
        busy={submitting}
      />
    </section>
  );
};
