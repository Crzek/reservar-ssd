import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db.ts';
import { hashPassword } from '../src/lib/password.ts';
import { createSession, SESSION_COOKIE } from '../src/lib/session.ts';

// 2026-10-26 10:30 hora del club.
export const FIXED_NOW = Date.UTC(2026, 9, 26, 15, 30);

export type Clock = { now: () => number; set: (ms: number) => void; advance: (ms: number) => void };

export const makeClock = (startMs: number): Clock => {
  let current = startMs;
  return {
    now: () => current,
    set: (ms) => {
      current = ms;
    },
    advance: (ms) => {
      current += ms;
    },
  };
};

export const makeTestApp = (nowMs: number = FIXED_NOW, path = ':memory:') => {
  const db = openDb(path);
  const clock = makeClock(nowMs);
  const app = createApp({ db, now: clock.now });
  return { app, db, clock };
};

export const seedUser = async (db: Db, email: string, password = 'secreta123'): Promise<number> => {
  const hash = await hashPassword(password);
  const result = db
    .prepare('INSERT INTO users(email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, hash, FIXED_NOW);
  return Number(result.lastInsertRowid);
};

// Inserta un usuario sin scrypt (rápido) para pruebas que no ejercitan el login.
export const insertUser = (db: Db, email: string): number =>
  Number(
    db
      .prepare('INSERT INTO users(email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(email, 'scrypt$x$y', FIXED_NOW).lastInsertRowid,
  );

export const sessionCookie = (db: Db, userId: number, nowMs: number): string =>
  `${SESSION_COOKIE}=${createSession(db, userId, nowMs)}`;

export const loginAgent = (app: Express, db: Db, userId: number, nowMs: number) => {
  const agent = request.agent(app);
  agent.set('Cookie', sessionCookie(db, userId, nowMs));
  return agent;
};

export const insertReservation = (
  db: Db,
  r: { userId: number; courtId: number; date: string; startHour: number; startAt: number; cancelledAt?: number | null },
): number =>
  Number(
    db
      .prepare(
        `INSERT INTO reservations(user_id, court_id, date, start_hour, start_at, end_at, created_at, cancelled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(r.userId, r.courtId, r.date, r.startHour, r.startAt, r.startAt + 3600000, FIXED_NOW, r.cancelledAt ?? null)
      .lastInsertRowid,
  );
