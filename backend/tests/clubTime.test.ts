import { describe, expect, it } from 'vitest';
import {
  addDays,
  bookingWindow,
  clubToday,
  isInBookingWindow,
  isSlotStarted,
  slotEndMs,
  slotLabel,
  slotStartMs,
} from '../src/lib/clubTime.ts';

describe('clubTime', () => {
  it('clubToday cambia de día a las 00:00 hora del club (05:00Z)', () => {
    expect(clubToday(Date.parse('2026-10-27T04:59:59.999Z'))).toBe('2026-10-26');
    expect(clubToday(Date.parse('2026-10-27T05:00:00.000Z'))).toBe('2026-10-27');
  });

  it('addDays cruza meses y años', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('bookingWindow cubre hoy … hoy+6, incluyendo cruce de mes', () => {
    const now = Date.UTC(2026, 9, 28, 15);
    expect(bookingWindow(now)).toEqual({ from: '2026-10-28', to: '2026-11-03' });
    expect(isInBookingWindow('2026-10-28', now)).toBe(true);
    expect(isInBookingWindow('2026-11-03', now)).toBe(true);
    expect(isInBookingWindow('2026-10-27', now)).toBe(false);
    expect(isInBookingWindow('2026-11-04', now)).toBe(false);
  });

  it('slotStartMs y slotEndMs usan UTC−5', () => {
    expect(slotStartMs('2026-10-27', 0)).toBe(Date.UTC(2026, 9, 27, 5));
    expect(slotStartMs('2026-10-27', 18)).toBe(Date.UTC(2026, 9, 27, 23));
    expect(slotEndMs('2026-10-27', 23)).toBe(Date.UTC(2026, 9, 28, 5));
  });

  it('isSlotStarted es true en el instante exacto de inicio y false 1 ms antes', () => {
    const start = slotStartMs('2026-10-27', 10);
    expect(isSlotStarted('2026-10-27', 10, start)).toBe(true);
    expect(isSlotStarted('2026-10-27', 10, start - 1)).toBe(false);
  });

  it('slotLabel usa 24 h, dos dígitos y guion –', () => {
    expect(slotLabel(0)).toBe('00:00–01:00');
    expect(slotLabel(9)).toBe('09:00–10:00');
    expect(slotLabel(23)).toBe('23:00–24:00');
  });
});
