// Fechas `YYYY-MM-DD` del club formateadas sin depender de la zona horaria del navegador.
const toUtcDate = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const addDays = (date: string, n: number): string => {
  const dt = toUtcDate(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

const weekdayFmt = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short' });
const dayMonthFmt = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

export const formatWeekday = (date: string): string => weekdayFmt.format(toUtcDate(date)).replace('.', '');
export const formatDayMonth = (date: string): string => dayMonthFmt.format(toUtcDate(date)).replace('.', '');
export const formatLongDate = (date: string): string => longFmt.format(toUtcDate(date));
export const formatLongDateCapitalized = (date: string): string => {
  const text = formatLongDate(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
