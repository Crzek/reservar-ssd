import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { FIXED_NOW, insertReservation, insertUser, makeTestApp, sessionCookie } from './helpers.ts';
import { slotStartMs } from '../src/lib/clubTime.ts';

const TODAY = '2026-10-26';
const TOMORROW = '2026-10-27';

const setup = () => {
  const ctx = makeTestApp(FIXED_NOW);
  const userId = insertUser(ctx.db, 'ana@test.com');
  const cookie = sessionCookie(ctx.db, userId, FIXED_NOW);
  const availability = (courtId: string | number, date?: string) =>
    request(ctx.app)
      .get(`/api/courts/${courtId}/availability`)
      .query(date === undefined ? {} : { date })
      .set('Cookie', cookie);
  return { ...ctx, userId, availability };
};

describe('GET /api/courts', () => {
  it('es público y lista las 5 canchas fijas con la ventana de 7 días', async () => {
    const { app } = makeTestApp(FIXED_NOW);
    const res = await request(app).get('/api/courts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      courts: [
        { id: 1, name: 'Cancha Laureles' },
        { id: 2, name: 'Cancha El Poblado' },
        { id: 3, name: 'Cancha Belén' },
        { id: 4, name: 'Cancha Robledo' },
        { id: 5, name: 'Cancha Envigado' },
      ],
      bookingWindow: { from: '2026-10-26', to: '2026-11-01' },
    });
  });
});

describe('GET /api/courts/:courtId/availability', () => {
  it('sin sesión responde 401', async () => {
    const { app } = makeTestApp(FIXED_NOW);
    const res = await request(app).get('/api/courts/1/availability').query({ date: TODAY });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('hoy: 24 slots ordenados; los ya iniciados (incluido el en curso) están no disponibles', async () => {
    const { availability } = setup();
    const res = await availability(1, TODAY);
    expect(res.status).toBe(200);
    expect(res.body.court).toEqual({ id: 1, name: 'Cancha Laureles' });
    expect(res.body.date).toBe(TODAY);
    expect(res.body.bookingWindow).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    const slots = res.body.slots as { startHour: number; label: string; status: string }[];
    expect(slots).toHaveLength(24);
    expect(slots.map((s) => s.startHour)).toEqual([...Array(24).keys()]);
    expect(slots[0].label).toBe('00:00–01:00');
    expect(slots[23].label).toBe('23:00–24:00');
    for (const s of slots) expect(s.status).toBe(s.startHour <= 10 ? 'unavailable' : 'available');
  });

  it('refleja reservas sin exponer datos del usuario; canceladas vuelven a estar disponibles', async () => {
    const { db, userId, availability } = setup();
    insertReservation(db, { userId, courtId: 1, date: TOMORROW, startHour: 18, startAt: slotStartMs(TOMORROW, 18) });
    insertReservation(db, {
      userId,
      courtId: 1,
      date: TOMORROW,
      startHour: 19,
      startAt: slotStartMs(TOMORROW, 19),
      cancelledAt: FIXED_NOW,
    });
    insertReservation(db, { userId, courtId: 1, date: TODAY, startHour: 8, startAt: slotStartMs(TODAY, 8) });

    const tomorrow = await availability(1, TOMORROW);
    expect(tomorrow.body.slots[18].status).toBe('reserved');
    expect(tomorrow.body.slots[19].status).toBe('available');
    expect(JSON.stringify(tomorrow.body)).not.toMatch(/userId|user_id|email|ana@test/);
    for (const s of tomorrow.body.slots) expect(Object.keys(s).sort()).toEqual(['label', 'startHour', 'status']);

    const today = await availability(1, TODAY);
    expect(today.body.slots[8].status).toBe('unavailable');

    const otherCourt = await availability(2, TOMORROW);
    expect(otherCourt.body.slots[18].status).toBe('available');
  });

  it('valida cancha y fecha', async () => {
    const { availability } = setup();
    for (const [courtId, date] of [
      [9, TOMORROW],
      ['abc', TOMORROW],
      [1, '2026-13-40'],
      [1, undefined],
    ] as const) {
      const res = await availability(courtId, date);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
    }
    for (const date of ['2026-10-25', '2026-11-02']) {
      const res = await availability(1, date);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OUT_OF_BOOKING_WINDOW');
    }
  });
});
