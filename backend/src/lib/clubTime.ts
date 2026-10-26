// Hora del club: America/Bogota, UTC−5 fijo (sin horario de verano). Ver research R3.
export const CLUB_OFFSET_MS = -5 * 3600000;
export const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;

const isoDate = (utcMs: number): string => new Date(utcMs).toISOString().slice(0, 10);

const dateToUtcMidnight = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const clubToday = (nowMs: number): string => isoDate(nowMs + CLUB_OFFSET_MS);

export const addDays = (date: string, n: number): string => isoDate(dateToUtcMidnight(date) + n * DAY_MS);

export const bookingWindow = (nowMs: number): { from: string; to: string } => {
  const from = clubToday(nowMs);
  return { from, to: addDays(from, 6) };
};

export const isInBookingWindow = (date: string, nowMs: number): boolean => {
  const { from, to } = bookingWindow(nowMs);
  return date >= from && date <= to;
};

export const slotStartMs = (date: string, hour: number): number =>
  dateToUtcMidnight(date) + hour * HOUR_MS - CLUB_OFFSET_MS;

export const slotEndMs = (date: string, hour: number): number => slotStartMs(date, hour) + HOUR_MS;

export const isSlotStarted = (date: string, hour: number, nowMs: number): boolean =>
  slotStartMs(date, hour) <= nowMs;

const pad = (n: number): string => String(n).padStart(2, '0');

export const slotLabel = (hour: number): string => `${pad(hour)}:00–${pad(hour + 1)}:00`;
