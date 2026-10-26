import type { Db } from '../db.ts';

// Reglas FR-003a sobre login_attempts (ver data-model.md § login_attempts).
export const LOCK_THRESHOLD = 5;
export const LOCK_MS = 15 * 60000;

type AttemptRow = { failed_count: number; locked_until: number | null };

export const checkLock = (
  db: Db,
  email: string,
  nowMs: number,
): { locked: true; retryAfterSec: number } | { locked: false } => {
  const row = db.prepare('SELECT failed_count, locked_until FROM login_attempts WHERE email = ?').get(email) as
    | AttemptRow
    | undefined;
  if (row?.locked_until == null) return { locked: false };
  if (row.locked_until > nowMs) return { locked: true, retryAfterSec: Math.ceil((row.locked_until - nowMs) / 1000) };
  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
  return { locked: false };
};

export const recordFailure = (db: Db, email: string, nowMs: number): void => {
  db.prepare(
    `INSERT INTO login_attempts(email, failed_count, locked_until) VALUES (?, 1, NULL)
     ON CONFLICT(email) DO UPDATE SET failed_count = failed_count + 1`,
  ).run(email);
  db.prepare('UPDATE login_attempts SET locked_until = ? WHERE email = ? AND failed_count >= ?').run(
    nowMs + LOCK_MS,
    email,
    LOCK_THRESHOLD,
  );
};

export const recordSuccess = (db: Db, email: string): void => {
  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
};
