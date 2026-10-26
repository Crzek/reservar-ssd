export type Parsed<T> = { ok: true; value: T } | { ok: false; code: 'INVALID_INPUT' };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const invalid = { ok: false, code: 'INVALID_INPUT' } as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INT_RE = /^\d+$/;

export const parseEmail = (x: unknown): Parsed<string> => {
  if (typeof x !== 'string') return invalid;
  const email = x.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? ok(email) : invalid;
};

export const parsePassword = (x: unknown): Parsed<string> =>
  typeof x === 'string' && x.length >= 8 ? ok(x) : invalid;

export const parseDate = (x: unknown): Parsed<string> => {
  if (typeof x !== 'string' || !DATE_RE.test(x)) return invalid;
  const [y, m, d] = x.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? ok(x) : invalid;
};

export const parseStartHour = (x: unknown): Parsed<number> =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 23 ? ok(x) : invalid;

const toInt = (x: unknown): number | null => {
  if (typeof x === 'number') return Number.isInteger(x) ? x : null;
  if (typeof x === 'string' && INT_RE.test(x)) return Number(x);
  return null;
};

export const parseCourtId = (x: unknown): Parsed<number> => {
  const n = toInt(x);
  return n !== null && n >= 1 && n <= 5 ? ok(n) : invalid;
};

export const parsePositiveId = (x: unknown): Parsed<number> => {
  const n = typeof x === 'string' ? toInt(x) : null;
  return n !== null && n >= 1 && Number.isSafeInteger(n) ? ok(n) : invalid;
};
