import type { ErrorCode } from './types';

export const FALLBACK_MESSAGE = 'Ocurrió un problema. Inténtalo de nuevo.';

const catalog: Record<ErrorCode, string> = {
  INVALID_INPUT: 'Revisa los datos ingresados e inténtalo de nuevo.',
  OUT_OF_BOOKING_WINDOW: 'Solo puedes reservar desde hoy hasta dentro de 6 días.',
  SLOT_IN_PAST: 'Ese horario ya comenzó o ya pasó. Elige otro bloque.',
  RESERVATION_NOT_CANCELLABLE: 'Esta reserva ya comenzó o ya pasó, por lo que no se puede cancelar.',
  UNAUTHENTICATED: 'Tu sesión expiró o no has iniciado sesión',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  RESERVATION_NOT_FOUND: 'No encontramos esa reserva. Es posible que ya haya sido cancelada.',
  EMAIL_TAKEN: 'Este correo ya está registrado',
  SLOT_TAKEN: 'La cancha ya fue reservada en este horario',
  ACTIVE_RESERVATION_EXISTS: 'Ya tienes una reserva activa. Solo se permite una a la vez.',
  TOO_MANY_ATTEMPTS: 'Demasiados intentos. Inténtalo de nuevo más tarde.',
  INTERNAL: FALLBACK_MESSAGE,
};

export const messageFor = (code: string): string =>
  Object.prototype.hasOwnProperty.call(catalog, code) ? catalog[code as ErrorCode] : FALLBACK_MESSAGE;
