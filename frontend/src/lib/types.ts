// Tipos espejo de specs/001-padel-court-booking/contracts/openapi.yaml.
export type User = { id: number; email: string };

export type Court = { id: number; name: string };

export type BookingWindow = { from: string; to: string };

export type SlotStatus = 'available' | 'reserved' | 'unavailable';

export type Slot = { startHour: number; label: string; status: SlotStatus };

export type Availability = { court: Court; date: string; bookingWindow: BookingWindow; slots: Slot[] };

export type Reservation = {
  id: number;
  court: Court;
  date: string;
  startHour: number;
  label: string;
  cancellable: boolean;
};

export type MyReservations = { upcoming: Reservation[]; history: Reservation[] };

export const ERROR_CODES = [
  'INVALID_INPUT',
  'OUT_OF_BOOKING_WINDOW',
  'SLOT_IN_PAST',
  'RESERVATION_NOT_CANCELLABLE',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'RESERVATION_NOT_FOUND',
  'EMAIL_TAKEN',
  'SLOT_TAKEN',
  'ACTIVE_RESERVATION_EXISTS',
  'TOO_MANY_ATTEMPTS',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiError = { code: ErrorCode | 'NETWORK' };
