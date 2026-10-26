import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { FIXED_NOW, makeTestApp, seedUser } from './helpers.ts';
import { createApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';

const MIN = 60000;
const HOUR = 3600000;

const register = (app: express.Express, email: string, password: string) =>
  request(app).post('/api/auth/register').send({ email, password });

const login = (app: express.Express, email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password });

const sidFrom = (res: request.Response): string => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (raw ?? []).find((c) => c.startsWith('sid='));
  if (!cookie) throw new Error('sin cookie sid');
  return cookie.split(';')[0];
};

const expectCleanError = (res: request.Response, status: number, code: string) => {
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ error: { code, message: expect.any(String) } });
  expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|stack|Error:/);
};

describe('POST /api/auth/register', () => {
  it('crea la cuenta, normaliza el correo y establece la cookie de sesión', async () => {
    const { app, db } = makeTestApp();
    const res = await register(app, 'Ana@Test.com', 'secreta123');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ user: { id: expect.any(Number), email: 'ana@test.com' } });
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('sid='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('ana@test.com') as {
      password_hash: string;
    };
    expect(row.password_hash.startsWith('scrypt$')).toBe(true);
    expect(row.password_hash).not.toContain('secreta123');
  });

  it('rechaza correo duplicado sin distinguir mayúsculas', async () => {
    const { app } = makeTestApp();
    expect((await register(app, 'Ana@Test.com', 'secreta123')).status).toBe(201);
    expectCleanError(await register(app, 'ana@test.com', 'otraclave1'), 409, 'EMAIL_TAKEN');
  });

  it('rechaza entradas inválidas', async () => {
    const { app } = makeTestApp();
    expectCleanError(await register(app, 'no-es-correo', 'secreta123'), 400, 'INVALID_INPUT');
    expectCleanError(await register(app, 'a'.repeat(250) + '@t.co', 'secreta123'), 400, 'INVALID_INPUT');
    expectCleanError(await register(app, 'ana@test.com', '1234567'), 400, 'INVALID_INPUT');
    const malformed = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expectCleanError(malformed, 400, 'INVALID_INPUT');
  });
});

describe('POST /api/auth/login', () => {
  it('inicia sesión con credenciales correctas', async () => {
    const { app, db } = makeTestApp();
    await seedUser(db, 'ana@test.com', 'secreta123');
    const res = await login(app, 'ANA@test.com', 'secreta123');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ana@test.com');
    expect(sidFrom(res)).toMatch(/^sid=.+/);
  });

  it('responde el mismo mensaje genérico para contraseña incorrecta y correo inexistente', async () => {
    const { app, db } = makeTestApp();
    await seedUser(db, 'ana@test.com', 'secreta123');
    const wrong = await login(app, 'ana@test.com', 'incorrecta');
    const missing = await login(app, 'noexiste@test.com', 'secreta123');
    expectCleanError(wrong, 401, 'INVALID_CREDENTIALS');
    expectCleanError(missing, 401, 'INVALID_CREDENTIALS');
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('bloquea el correo 15 min tras 5 fallos (FR-003a)', async () => {
    const { app, db, clock } = makeTestApp();
    await seedUser(db, 'ana@test.com', 'secreta123');
    for (let i = 0; i < 5; i++) expectCleanError(await login(app, 'ana@test.com', 'incorrecta'), 401, 'INVALID_CREDENTIALS');
    const locked = await login(app, 'ana@test.com', 'secreta123');
    expectCleanError(locked, 429, 'TOO_MANY_ATTEMPTS');
    expect(Number(locked.headers['retry-after'])).toBe(15 * 60);
    clock.advance(5 * MIN);
    expect(Number((await login(app, 'ana@test.com', 'secreta123')).headers['retry-after'])).toBe(10 * 60);
    clock.advance(10 * MIN);
    expect((await login(app, 'ana@test.com', 'secreta123')).status).toBe(200);
  });

  it('aplica el mismo bloqueo a correos inexistentes', async () => {
    const { app } = makeTestApp();
    for (let i = 0; i < 5; i++) expectCleanError(await login(app, 'noexiste@test.com', 'incorrecta'), 401, 'INVALID_CREDENTIALS');
    const locked = await login(app, 'noexiste@test.com', 'incorrecta');
    expectCleanError(locked, 429, 'TOO_MANY_ATTEMPTS');
    expect(locked.headers['retry-after']).toBeDefined();
  });

  it('un login exitoso reinicia el contador', async () => {
    const { app, db } = makeTestApp();
    await seedUser(db, 'ana@test.com', 'secreta123');
    for (let i = 0; i < 3; i++) await login(app, 'ana@test.com', 'incorrecta');
    expect((await login(app, 'ana@test.com', 'secreta123')).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login(app, 'ana@test.com', 'incorrecta')).status).toBe(401);
    expect((await login(app, 'ana@test.com', 'secreta123')).status).toBe(200);
  });

  it('rechaza formato inválido con 400', async () => {
    const { app } = makeTestApp();
    expectCleanError(await login(app, 'no-es-correo', 'secreta123'), 400, 'INVALID_INPUT');
  });
});

describe('GET /api/auth/me y expiración de sesión', () => {
  it('sin cookie responde 401; con cookie 200', async () => {
    const { app } = makeTestApp();
    expectCleanError(await request(app).get('/api/auth/me'), 401, 'UNAUTHENTICATED');
    const sid = sidFrom(await register(app, 'ana@test.com', 'secreta123'));
    const me = await request(app).get('/api/auth/me').set('Cookie', sid);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ user: { id: expect.any(Number), email: 'ana@test.com' } });
  });

  it('expiración deslizante de 24 h (FR-004a)', async () => {
    const { app, db, clock } = makeTestApp();
    const sid = sidFrom(await register(app, 'ana@test.com', 'secreta123'));
    const me = () => request(app).get('/api/auth/me').set('Cookie', sid);
    clock.advance(23 * HOUR);
    expect((await me()).status).toBe(200);
    clock.advance(23 * HOUR);
    expect((await me()).status).toBe(200);
    clock.advance(24 * HOUR);
    expectCleanError(await me(), 401, 'UNAUTHENTICATED');
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
  });
});

describe('POST /api/auth/logout', () => {
  it('cierra la sesión, limpia la cookie y es idempotente', async () => {
    const { app } = makeTestApp();
    const sid = sidFrom(await register(app, 'ana@test.com', 'secreta123'));
    const out = await request(app).post('/api/auth/logout').set('Cookie', sid);
    expect(out.status).toBe(204);
    expect((out.headers['set-cookie'] as unknown as string[]).some((c) => /^sid=;/.test(c))).toBe(true);
    expectCleanError(await request(app).get('/api/auth/me').set('Cookie', sid), 401, 'UNAUTHENTICATED');
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });
});

describe('errores internos (Principio V)', () => {
  it('cualquier excepción no prevista responde 500 INTERNAL sin stack', async () => {
    const db = openDb(':memory:');
    const app = createApp({ db, now: () => FIXED_NOW });
    db.close();
    const original = console.error;
    console.error = () => {};
    try {
      const res = await request(app).post('/api/auth/register').send({ email: 'ana@test.com', password: 'secreta123' });
      expectCleanError(res, 500, 'INTERNAL');
      expect(res.body.error.message).toBe('Ocurrió un problema. Inténtalo de nuevo.');
    } finally {
      console.error = original;
    }
  });

  it('rutas /api desconocidas responden JSON', async () => {
    const { app } = makeTestApp();
    expectCleanError(await request(app).get('/api/no-existe'), 404, 'INVALID_INPUT');
  });
});
