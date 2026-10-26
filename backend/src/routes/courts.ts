import { Router } from 'express';
import type { Db } from '../db.ts';
import { bookingWindow, isInBookingWindow, isSlotStarted, slotLabel } from '../lib/clubTime.ts';
import { httpError } from '../lib/httpError.ts';
import { requireSession } from '../lib/session.ts';
import { parseCourtId, parseDate } from '../lib/validation.ts';

type SlotStatus = 'available' | 'reserved' | 'unavailable';

export const courtsRouter = (db: Db, now: () => number): Router => {
  const router = Router();

  // Ningún handler escribe en courts (Principio II).
  router.get('/', (_req, res) => {
    const courts = db.prepare('SELECT id, name FROM courts ORDER BY id').all();
    res.json({ courts, bookingWindow: bookingWindow(now()) });
  });

  router.get('/:courtId/availability', requireSession(db, now), (req, res) => {
    const courtId = parseCourtId(req.params.courtId);
    const date = parseDate(req.query.date);
    if (!courtId.ok || !date.ok) throw httpError(400, 'INVALID_INPUT');
    const nowMs = now();
    if (!isInBookingWindow(date.value, nowMs)) throw httpError(400, 'OUT_OF_BOOKING_WINDOW');

    const court = db.prepare('SELECT id, name FROM courts WHERE id = ?').get(courtId.value) as
      | { id: number; name: string }
      | undefined;
    if (!court) throw httpError(400, 'INVALID_INPUT');

    const reserved = new Set(
      (
        db
          .prepare('SELECT start_hour FROM reservations WHERE court_id = ? AND date = ? AND cancelled_at IS NULL')
          .all(court.id, date.value) as { start_hour: number }[]
      ).map((r) => r.start_hour),
    );

    const slots = Array.from({ length: 24 }, (_, hour) => {
      const status: SlotStatus = isSlotStarted(date.value, hour, nowMs)
        ? 'unavailable'
        : reserved.has(hour)
          ? 'reserved'
          : 'available';
      return { startHour: hour, label: slotLabel(hour), status };
    });

    res.json({ court, date: date.value, bookingWindow: bookingWindow(nowMs), slots });
  });

  return router;
};
