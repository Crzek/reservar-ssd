import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { FIXED_NOW, insertReservation, insertUser, makeTestApp, sessionCookie } from './helpers.ts';
import { slotStartMs } from '../src/lib/clubTime.ts';

const TODAY = '2026-10-26';
const TOMORROW = '2026-10-27';
const YESTERDAY = '2026-10-25';
const TODAY_PLUS_6 = '2026-11-01';
const TODAY_PLUS_7 = '2026-11-02';
const HOUR = 3600000;

const setup = () => {
  const ctx = makeTestApp(FIXED_NOW);
  const userFor = (email: string) => {
    const id = insertUser(ctx.db, email);
    // Sesión nueva en cada petición: las pruebas mueven el reloj más allá de las 24 h de inactividad.
    const cookie = () => sessionCookie(ctx.db, id, ctx.clock.now());
    return {
      id,
      reserve: (body: unknown) => request(ctx.app).post('/api/reservations').set('Cookie', cookie()).send(body as object),
      mine: () => request(ctx.app).get('/api/reservations/me').set('Cookie', cookie()),
      cancel: (id: number | string) => request(ctx.app).delete(`/api/reservations/${id}`).set('Cookie', cookie()),
      availability: (courtId: number, date: string) =>
        request(ctx.app).get(`/api/courts/${courtId}/availability`).query({ date }).set('Cookie', cookie()),
    };
  };
  const count = () =>
    (ctx.db.prepare('SELECT COUNT(*) AS n FROM reservations').get() as { n: number }).n;
  return { ...ctx, userFor, count };
};

const expectError = (res: request.Response, status: number, code: string) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
  expect(typeof res.body.error.message).toBe('string');
};

describe('POST /api/reservations', () => {
  it('sin sesión responde 401', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/reservations').send({ courtId: 1, date: TOMORROW, startHour: 18 });
    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it('crea la reserva y guarda start_at / end_at', async () => {
    const { db, userFor } = setup();
    const ana = userFor('ana@test.com');
    const res = await ana.reserve({ courtId: 3, date: TOMORROW, startHour: 18 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      court: { id: 3, name: 'Cancha Belén' },
      date: TOMORROW,
      startHour: 18,
      label: '18:00–19:00',
      cancellable: true,
    });
    const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(res.body.id) as {
      user_id: number;
      start_at: number;
      end_at: number;
      created_at: number;
    };
    expect(row.user_id).toBe(ana.id);
    expect(row.start_at).toBe(slotStartMs(TOMORROW, 18));
    expect(row.end_at).toBe(row.start_at + HOUR);
    expect(row.created_at).toBe(FIXED_NOW);
  });

  it('el mismo bloque por otro usuario responde 409 SLOT_TAKEN', async () => {
    const { userFor, count } = setup();
    expect((await userFor('ana@test.com').reserve({ courtId: 1, date: TOMORROW, startHour: 18 })).status).toBe(201);
    const res = await userFor('beto@test.com').reserve({ courtId: 1, date: TOMORROW, startHour: 18 });
    expectError(res, 409, 'SLOT_TAKEN');
    expect(res.body.error.message).toBe('La cancha ya fue reservada en este horario.');
    expect(count()).toBe(1);
  });

  it('una sola reserva activa por usuario; al pasar su hora de fin puede reservar otra', async () => {
    const { clock, userFor } = setup();
    const ana = userFor('ana@test.com');
    expect((await ana.reserve({ courtId: 1, date: TOMORROW, startHour: 18 })).status).toBe(201);
    expectError(await ana.reserve({ courtId: 2, date: TOMORROW, startHour: 20 }), 409, 'ACTIVE_RESERVATION_EXISTS');
    clock.set(slotStartMs(TOMORROW, 18) + 30 * 60000);
    expectError(await ana.reserve({ courtId: 2, date: TOMORROW, startHour: 20 }), 409, 'ACTIVE_RESERVATION_EXISTS');
    clock.set(slotStartMs(TOMORROW, 19));
    expect((await ana.reserve({ courtId: 2, date: TOMORROW, startHour: 20 })).status).toBe(201);
  });

  it('rechaza bloques ya iniciados, fechas pasadas y fuera de ventana', async () => {
    const { clock, userFor, count } = setup();
    const ana = userFor('ana@test.com');
    expectError(await ana.reserve({ courtId: 1, date: TODAY, startHour: 10 }), 400, 'SLOT_IN_PAST');
    expectError(await ana.reserve({ courtId: 1, date: TODAY, startHour: 9 }), 400, 'SLOT_IN_PAST');
    expectError(await ana.reserve({ courtId: 1, date: YESTERDAY, startHour: 20 }), 400, 'SLOT_IN_PAST');
    expectError(await ana.reserve({ courtId: 1, date: TODAY_PLUS_7, startHour: 10 }), 400, 'OUT_OF_BOOKING_WINDOW');
    // El diálogo quedó abierto y la confirmación llega justo a la hora de inicio.
    clock.set(slotStartMs(TODAY, 15));
    expectError(await ana.reserve({ courtId: 1, date: TODAY, startHour: 15 }), 400, 'SLOT_IN_PAST');
    expect(count()).toBe(0);
  });

  it('aplica las reglas en el orden de data-model.md', async () => {
    const { userFor } = setup();
    const ana = userFor('ana@test.com');
    const beto = userFor('beto@test.com');
    expect((await ana.reserve({ courtId: 1, date: TOMORROW, startHour: 18 })).status).toBe(201);
    expectError(await ana.reserve({ courtId: 9, date: TODAY_PLUS_7, startHour: 18 }), 400, 'INVALID_INPUT');
    expectError(await ana.reserve({ courtId: 2, date: TODAY_PLUS_7, startHour: 18 }), 400, 'OUT_OF_BOOKING_WINDOW');
    expectError(await ana.reserve({ courtId: 2, date: YESTERDAY, startHour: 18 }), 400, 'SLOT_IN_PAST');
    expectError(await ana.reserve({ courtId: 1, date: TOMORROW, startHour: 18 }), 409, 'ACTIVE_RESERVATION_EXISTS');
    expectError(await beto.reserve({ courtId: 1, date: TOMORROW, startHour: 18 }), 409, 'SLOT_TAKEN');
  });

  it('valida el cuerpo y no crea filas con datos inválidos', async () => {
    const { userFor, count } = setup();
    const ana = userFor('ana@test.com');
    const bodies: unknown[] = [
      { courtId: 9, date: TOMORROW, startHour: 18 },
      { courtId: 0, date: TOMORROW, startHour: 18 },
      { courtId: '1', date: TOMORROW, startHour: 18 },
      { courtId: 1, date: TOMORROW, startHour: 24 },
      { courtId: 1, date: TOMORROW, startHour: 1.5 },
      { courtId: 1, date: TOMORROW, startHour: '18' },
      { courtId: 1, date: '2026-13-40', startHour: 18 },
      { courtId: 1, startHour: 18 },
      { date: TOMORROW, startHour: 18 },
      { courtId: 1, date: TOMORROW },
      { courtId: 1, date: TOMORROW, startHour: 18, userId: 99 },
      [1, TOMORROW, 18],
    ];
    for (const body of bodies) expectError(await ana.reserve(body), 400, 'INVALID_INPUT');
    expect(count()).toBe(0);
  });

  it('el bloque 23 de hoy+6 termina a las 00:00 del día siguiente', async () => {
    const { db, userFor } = setup();
    const res = await userFor('ana@test.com').reserve({ courtId: 5, date: TODAY_PLUS_6, startHour: 23 });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('23:00–24:00');
    const row = db.prepare('SELECT end_at FROM reservations WHERE id = ?').get(res.body.id) as { end_at: number };
    expect(row.end_at).toBe(slotStartMs('2026-11-02', 0));
  });
});

describe('GET /api/reservations/me', () => {
  it('sin sesión responde 401', async () => {
    const { app } = setup();
    expectError(await request(app).get('/api/reservations/me'), 401, 'UNAUTHENTICATED');
  });

  it('usuario sin reservas recibe listas vacías', async () => {
    const { userFor } = setup();
    const res = await userFor('ana@test.com').mine();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ upcoming: [], history: [] });
  });

  it('separa próximas (en curso + futuras, ascendente) e historial (descendente), sin canceladas ni ajenas', async () => {
    const { db, userFor } = setup();
    const ana = userFor('ana@test.com');
    const beto = userFor('beto@test.com');
    const at = (date: string, hour: number) => slotStartMs(date, hour);
    const future = insertReservation(db, { userId: ana.id, courtId: 2, date: TOMORROW, startHour: 18, startAt: at(TOMORROW, 18) });
    const ongoing = insertReservation(db, { userId: ana.id, courtId: 1, date: TODAY, startHour: 10, startAt: at(TODAY, 10) });
    const pastOld = insertReservation(db, { userId: ana.id, courtId: 3, date: YESTERDAY, startHour: 8, startAt: at(YESTERDAY, 8) });
    const pastRecent = insertReservation(db, { userId: ana.id, courtId: 4, date: TODAY, startHour: 7, startAt: at(TODAY, 7) });
    insertReservation(db, {
      userId: ana.id, courtId: 5, date: TOMORROW, startHour: 9, startAt: at(TOMORROW, 9), cancelledAt: FIXED_NOW,
    });
    insertReservation(db, { userId: beto.id, courtId: 3, date: TOMORROW, startHour: 20, startAt: at(TOMORROW, 20) });

    const res = await ana.mine();
    expect(res.status).toBe(200);
    expect(res.body.upcoming.map((r: { id: number }) => r.id)).toEqual([ongoing, future]);
    expect(res.body.history.map((r: { id: number }) => r.id)).toEqual([pastRecent, pastOld]);
    expect(res.body.upcoming[0]).toEqual({
      id: ongoing,
      court: { id: 1, name: 'Cancha Laureles' },
      date: TODAY,
      startHour: 10,
      label: '10:00–11:00',
      cancellable: false,
    });
    expect(res.body.upcoming[1]).toMatchObject({ court: { name: 'Cancha El Poblado' }, label: '18:00–19:00', cancellable: true });
    expect(res.body.history[0]).toMatchObject({ court: { name: 'Cancha Robledo' }, cancellable: false });
  });
});

describe('DELETE /api/reservations/:id', () => {
  it('cancela una reserva futura propia y libera el bloque', async () => {
    const { db, userFor } = setup();
    const ana = userFor('ana@test.com');
    const created = await ana.reserve({ courtId: 1, date: TOMORROW, startHour: 18 });
    const res = await ana.cancel(created.body.id);
    expect(res.status).toBe(204);
    const row = db.prepare('SELECT cancelled_at FROM reservations WHERE id = ?').get(created.body.id) as {
      cancelled_at: number | null;
    };
    expect(row.cancelled_at).toBe(FIXED_NOW);
    expect((await ana.availability(1, TOMORROW)).body.slots[18].status).toBe('available');
    expect((await ana.mine()).body).toEqual({ upcoming: [], history: [] });
    expect((await ana.reserve({ courtId: 2, date: TOMORROW, startHour: 20 })).status).toBe(201);
  });

  it('responde 404 sin distinguir ya cancelada, inexistente o ajena', async () => {
    const { db, userFor } = setup();
    const ana = userFor('ana@test.com');
    const beto = userFor('beto@test.com');
    const created = await ana.reserve({ courtId: 1, date: TOMORROW, startHour: 18 });
    expectError(await beto.cancel(created.body.id), 404, 'RESERVATION_NOT_FOUND');
    const row = db.prepare('SELECT cancelled_at FROM reservations WHERE id = ?').get(created.body.id) as {
      cancelled_at: number | null;
    };
    expect(row.cancelled_at).toBeNull();
    expect((await ana.cancel(created.body.id)).status).toBe(204);
    expectError(await ana.cancel(created.body.id), 404, 'RESERVATION_NOT_FOUND');
    expectError(await ana.cancel(9999), 404, 'RESERVATION_NOT_FOUND');
  });

  it('valida el id y exige sesión', async () => {
    const { app, userFor } = setup();
    const ana = userFor('ana@test.com');
    expectError(await ana.cancel('abc'), 400, 'INVALID_INPUT');
    expectError(await ana.cancel('0'), 400, 'INVALID_INPUT');
    expectError(await request(app).delete('/api/reservations/1'), 401, 'UNAUTHENTICATED');
  });

  it('no permite cancelar reservas en curso o pasadas', async () => {
    const { db, userFor } = setup();
    const ana = userFor('ana@test.com');
    const ongoing = insertReservation(db, { userId: ana.id, courtId: 1, date: TODAY, startHour: 10, startAt: slotStartMs(TODAY, 10) });
    const past = insertReservation(db, { userId: ana.id, courtId: 2, date: YESTERDAY, startHour: 10, startAt: slotStartMs(YESTERDAY, 10) });
    for (const id of [ongoing, past]) {
      expectError(await ana.cancel(id), 400, 'RESERVATION_NOT_CANCELLABLE');
      const row = db.prepare('SELECT cancelled_at FROM reservations WHERE id = ?').get(id) as { cancelled_at: number | null };
      expect(row.cancelled_at).toBeNull();
    }
  });
});
