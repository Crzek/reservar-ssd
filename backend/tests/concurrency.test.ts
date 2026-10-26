import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import request from 'supertest';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db.ts';
import { FIXED_NOW, insertUser, sessionCookie } from './helpers.ts';

const REPEATS = 20;
const USERS = 50;
const WORKERS = 8;
const SLOT = { courtId: 1, date: '2026-10-27', startHour: 18 };

const activeCount = (db: Db) =>
  (db.prepare('SELECT COUNT(*) AS n FROM reservations WHERE cancelled_at IS NULL').get() as { n: number }).n;

let dir: string;
let dbPath: string;
let db: Db;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'padel-concurrency-'));
  dbPath = join(dir, 'padel.db');
  db = openDb(dbPath);
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('SC-001: concurrencia sobre el mismo bloque', () => {
  it(`HTTP: ${USERS} confirmaciones simultáneas crean exactamente 1 reserva (×${REPEATS})`, async () => {
    const server: Server = createServer(createApp({ db, now: () => FIXED_NOW }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const cookies = Array.from({ length: USERS }, (_, i) =>
        sessionCookie(db, insertUser(db, `http${i}@test.com`), FIXED_NOW),
      );
      for (let round = 0; round < REPEATS; round++) {
        db.exec('DELETE FROM reservations');
        const responses = await Promise.all(
          cookies.map((cookie) => request(server).post('/api/reservations').set('Cookie', cookie).send(SLOT)),
        );
        const created = responses.filter((r) => r.status === 201);
        const conflicts = responses.filter((r) => r.status === 409 && r.body.error.code === 'SLOT_TAKEN');
        expect(created).toHaveLength(1);
        expect(conflicts).toHaveLength(USERS - 1);
        expect(activeCount(db)).toBe(1);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 120000);

  it(`multi-hilo: ${WORKERS} hilos sobre el mismo archivo crean exactamente 1 reserva (×${REPEATS})`, async () => {
    const signal = new SharedArrayBuffer(4);
    const gate = new Int32Array(signal);
    const workers = Array.from(
      { length: WORKERS },
      () =>
        new Worker(new URL('./concurrencyWorker.mjs', import.meta.url), {
          workerData: { dbPath, signal },
        }),
    );
    const userIds = Array.from({ length: WORKERS }, (_, i) => insertUser(db, `thread${i}@test.com`));

    const nextMessage = (w: Worker, type: string) =>
      new Promise<{ code?: string }>((resolve, reject) => {
        const onMessage = (msg: { type: string; code?: string }) => {
          if (msg.type !== type) return;
          w.off('message', onMessage);
          w.off('error', reject);
          resolve(msg);
        };
        w.on('message', onMessage);
        w.once('error', reject);
      });

    try {
      for (let round = 1; round <= REPEATS; round++) {
        db.exec('DELETE FROM reservations');
        const ready = workers.map((w) => nextMessage(w, 'ready'));
        const results = workers.map((w) => nextMessage(w, 'result'));
        workers.forEach((w, i) => w.postMessage({ round, userId: userIds[i], ...SLOT, nowMs: FIXED_NOW }));
        await Promise.all(ready);
        Atomics.store(gate, 0, round);
        Atomics.notify(gate, 0);
        const codes = (await Promise.all(results)).map((r) => r.code);
        expect(codes.filter((c) => c === 'CREATED')).toHaveLength(1);
        expect(codes.filter((c) => c === 'SLOT_TAKEN')).toHaveLength(WORKERS - 1);
        expect(activeCount(db)).toBe(1);
      }
    } finally {
      await Promise.all(workers.map((w) => w.terminate()));
    }
  }, 120000);
});
