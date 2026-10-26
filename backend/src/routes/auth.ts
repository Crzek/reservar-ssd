import { Router } from 'express';
import type { Db } from '../db.ts';
import { asyncHandler, httpError } from '../lib/httpError.ts';
import { checkLock, recordFailure, recordSuccess } from '../lib/loginLimiter.ts';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../lib/password.ts';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  requireSession,
  SESSION_COOKIE,
  setSessionCookie,
} from '../lib/session.ts';
import { parseEmail, parsePassword } from '../lib/validation.ts';

type UserRow = { id: number; email: string; password_hash: string };

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE';

const parseCredentials = (body: unknown): { email: string; password: string } => {
  const { email, password } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const parsedEmail = parseEmail(email);
  const parsedPassword = parsePassword(password);
  if (!parsedEmail.ok || !parsedPassword.ok) throw httpError(400, 'INVALID_INPUT');
  return { email: parsedEmail.value, password: parsedPassword.value };
};

export const authRouter = (db: Db, now: () => number): Router => {
  const router = Router();

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const { email, password } = parseCredentials(req.body);
      const passwordHash = await hashPassword(password);
      const nowMs = now();
      let userId: number;
      try {
        userId = Number(
          db.prepare('INSERT INTO users(email, password_hash, created_at) VALUES (?, ?, ?)').run(email, passwordHash, nowMs)
            .lastInsertRowid,
        );
      } catch (err) {
        if (isUniqueViolation(err)) throw httpError(409, 'EMAIL_TAKEN');
        throw err;
      }
      setSessionCookie(res, createSession(db, userId, nowMs));
      res.status(201).json({ user: { id: userId, email } });
    }),
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { email, password } = parseCredentials(req.body);
      const lock = checkLock(db, email, now());
      if (lock.locked) throw httpError(429, 'TOO_MANY_ATTEMPTS', { 'Retry-After': String(lock.retryAfterSec) });

      const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
        | UserRow
        | undefined;
      const valid = user ? await verifyPassword(password, user.password_hash) : await verifyAgainstDummy(password);
      if (!user || !valid) {
        recordFailure(db, email, now());
        throw httpError(401, 'INVALID_CREDENTIALS');
      }
      recordSuccess(db, email);
      setSessionCookie(res, createSession(db, user.id, now()));
      res.json({ user: { id: user.id, email: user.email } });
    }),
  );

  router.post('/logout', (req, res) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token !== '') destroySession(db, token);
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', requireSession(db, now), (_req, res) => {
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(res.locals.userId) as
      | { id: number; email: string }
      | undefined;
    if (!user) throw httpError(401, 'UNAUTHENTICATED');
    res.json({ user });
  });

  return router;
};
