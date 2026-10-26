import { Router } from 'express';
import type { Db } from '../db.ts';
import { bookingWindow, HOUR_MS, slotLabel, slotStartMs } from '../lib/clubTime.ts';
import { httpError } from '../lib/httpError.ts';
import { requireSession } from '../lib/session.ts';
import { parseCourtId, parseDate, parsePositiveId, parseStartHour } from '../lib/validation.ts';

export type ReservationRow = {
  id: number;
  court_id: number;
  court_name: string;
  date: string;
  start_hour: number;
  start_at: number;
  end_at: number;
};

export type NewReservation = { userId: number; courtId: number; date: string; startHour: number };

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE';

const SELECT_WITH_COURT = `SELECT r.id, r.court_id, c.name AS court_name, r.date, r.start_hour, r.start_at, r.end_at
  FROM reservations r JOIN courts c ON c.id = r.court_id`;

export const toReservationDto = (row: ReservationRow, nowMs: number) => ({
  id: row.id,
  court: { id: row.court_id, name: row.court_name },
  date: row.date,
  startHour: row.start_hour,
  label: slotLabel(row.start_hour),
  cancellable: row.start_at > nowMs,
});

// Validación + inserción atómicas en BEGIN IMMEDIATE (Principio I). Reglas 2–5 de data-model.md.
export const createReservation = (db: Db, input: NewReservation, nowMs: number): ReservationRow =>
  db
    .transaction((): ReservationRow => {
      const { userId, courtId, date, startHour } = input;
      if (date > bookingWindow(nowMs).to) throw httpError(400, 'OUT_OF_BOOKING_WINDOW');

      const startAt = slotStartMs(date, startHour);
      if (startAt <= nowMs) throw httpError(400, 'SLOT_IN_PAST');

      const active = db
        .prepare('SELECT 1 FROM reservations WHERE user_id = ? AND cancelled_at IS NULL AND end_at > ?')
        .get(userId, nowMs);
      if (active) throw httpError(409, 'ACTIVE_RESERVATION_EXISTS');

      const taken = db
        .prepare(
          'SELECT 1 FROM reservations WHERE court_id = ? AND date = ? AND start_hour = ? AND cancelled_at IS NULL',
        )
        .get(courtId, date, startHour);
      if (taken) throw httpError(409, 'SLOT_TAKEN');

      let id: number;
      try {
        id = Number(
          db
            .prepare(
              `INSERT INTO reservations(user_id, court_id, date, start_hour, start_at, end_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(userId, courtId, date, startHour, startAt, startAt + HOUR_MS, nowMs).lastInsertRowid,
        );
      } catch (err) {
        // Red final: índice único parcial ux_reservations_slot.
        if (isUniqueViolation(err)) throw httpError(409, 'SLOT_TAKEN');
        throw err;
      }
      return db.prepare(`${SELECT_WITH_COURT} WHERE r.id = ?`).get(id) as ReservationRow;
    })
    .immediate();

const ALLOWED_KEYS = new Set(['courtId', 'date', 'startHour']);

const parseNewReservationBody = (body: unknown): Omit<NewReservation, 'userId'> => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw httpError(400, 'INVALID_INPUT');
  const fields = body as Record<string, unknown>;
  if (Object.keys(fields).some((k) => !ALLOWED_KEYS.has(k))) throw httpError(400, 'INVALID_INPUT');
  const courtId = typeof fields.courtId === 'number' ? parseCourtId(fields.courtId) : parseCourtId(null);
  const date = parseDate(fields.date);
  const startHour = parseStartHour(fields.startHour);
  if (!courtId.ok || !date.ok || !startHour.ok) throw httpError(400, 'INVALID_INPUT');
  return { courtId: courtId.value, date: date.value, startHour: startHour.value };
};

export const reservationsRouter = (db: Db, now: () => number): Router => {
  const router = Router();
  router.use(requireSession(db, now));

  router.post('/', (req, res) => {
    const input = parseNewReservationBody(req.body);
    const nowMs = now();
    const row = createReservation(db, { ...input, userId: res.locals.userId as number }, nowMs);
    res.status(201).json(toReservationDto(row, nowMs));
  });

  // Declarada antes de /:reservationId.
  router.get('/me', (_req, res) => {
    const nowMs = now();
    const rows = db
      .prepare(`${SELECT_WITH_COURT} WHERE r.user_id = ? AND r.cancelled_at IS NULL ORDER BY r.start_at ASC`)
      .all(res.locals.userId) as ReservationRow[];
    const upcoming = rows.filter((r) => r.end_at > nowMs);
    const history = rows.filter((r) => r.end_at <= nowMs).reverse();
    res.json({
      upcoming: upcoming.map((r) => toReservationDto(r, nowMs)),
      history: history.map((r) => toReservationDto(r, nowMs)),
    });
  });

  router.delete('/:reservationId', (req, res) => {
    const reservationId = parsePositiveId(req.params.reservationId);
    if (!reservationId.ok) throw httpError(400, 'INVALID_INPUT');
    const userId = res.locals.userId as number;
    const nowMs = now();
    db.transaction(() => {
      const { changes } = db
        .prepare(
          `UPDATE reservations SET cancelled_at = ?
           WHERE id = ? AND user_id = ? AND cancelled_at IS NULL AND start_at > ?`,
        )
        .run(nowMs, reservationId.value, userId, nowMs);
      if (changes > 0) return;
      // No se distingue entre ajena, inexistente o ya cancelada (FR-021).
      const started = db
        .prepare('SELECT 1 FROM reservations WHERE id = ? AND user_id = ? AND cancelled_at IS NULL')
        .get(reservationId.value, userId);
      throw started ? httpError(400, 'RESERVATION_NOT_CANCELLABLE') : httpError(404, 'RESERVATION_NOT_FOUND');
    }).immediate();
    res.status(204).end();
  });

  return router;
};
