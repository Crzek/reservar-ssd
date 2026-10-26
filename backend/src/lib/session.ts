import { createHash, randomBytes } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import type { Db } from '../db.ts';
import { httpError } from './httpError.ts';

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_MS = 24 * 3600000;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const createSession = (db: Db, userId: number, nowMs: number): string => {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions(token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)').run(
    hashToken(token),
    userId,
    nowMs,
    nowMs,
  );
  return token;
};

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

export const setSessionCookie = (res: Response, token: string): void => {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
};

export const destroySession = (db: Db, token: string): void => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
};

export const requireSession =
  (db: Db, now: () => number): RequestHandler =>
  (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token === '') return next(httpError(401, 'UNAUTHENTICATED'));
    const tokenHash = hashToken(token);
    const session = db
      .prepare('SELECT user_id, last_seen_at FROM sessions WHERE token_hash = ?')
      .get(tokenHash) as { user_id: number; last_seen_at: number } | undefined;
    const nowMs = now();
    if (!session) return next(httpError(401, 'UNAUTHENTICATED'));
    if (nowMs - session.last_seen_at >= SESSION_TTL_MS) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return next(httpError(401, 'UNAUTHENTICATED'));
    }
    // Expiración deslizante (FR-004a).
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowMs, tokenHash);
    res.locals.userId = session.user_id;
    next();
  };
