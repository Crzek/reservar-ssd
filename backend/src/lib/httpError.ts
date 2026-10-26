import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'OUT_OF_BOOKING_WINDOW'
  | 'SLOT_IN_PAST'
  | 'RESERVATION_NOT_CANCELLABLE'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'RESERVATION_NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'SLOT_TAKEN'
  | 'ACTIVE_RESERVATION_EXISTS'
  | 'TOO_MANY_ATTEMPTS'
  | 'INTERNAL';

// Objeto plano, no subclase de Error (Principio IV).
export type HttpError = { status: number; code: ErrorCode; headers?: Record<string, string> };

export const messages: Record<ErrorCode, string> = {
  INVALID_INPUT: 'Los datos enviados no son válidos. Revísalos e inténtalo de nuevo.',
  OUT_OF_BOOKING_WINDOW: 'Solo puedes reservar desde hoy hasta dentro de 6 días.',
  SLOT_IN_PAST: 'Ese horario ya comenzó o ya pasó. Elige otro bloque.',
  RESERVATION_NOT_CANCELLABLE: 'Esta reserva ya comenzó o ya pasó, por lo que no se puede cancelar.',
  UNAUTHENTICATED: 'Tu sesión expiró o no has iniciado sesión.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  RESERVATION_NOT_FOUND: 'No encontramos esa reserva.',
  EMAIL_TAKEN: 'Este correo ya está registrado.',
  SLOT_TAKEN: 'La cancha ya fue reservada en este horario.',
  ACTIVE_RESERVATION_EXISTS: 'Ya tienes una reserva activa. Solo se permite una a la vez.',
  TOO_MANY_ATTEMPTS: 'Demasiados intentos. Inténtalo de nuevo más tarde.',
  INTERNAL: 'Ocurrió un problema. Inténtalo de nuevo.',
};

export const httpError = (status: number, code: ErrorCode, headers?: Record<string, string>): HttpError =>
  headers ? { status, code, headers } : { status, code };

export const isHttpError = (x: unknown): x is HttpError =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as HttpError).status === 'number' &&
  typeof (x as HttpError).code === 'string' &&
  (x as HttpError).code in messages;

export const sendError = (res: Response, err: HttpError): void => {
  if (err.headers) res.set(err.headers);
  res.status(err.status).json({ error: { code: err.code, message: messages[err.code] } });
};

// Express 4 no captura promesas rechazadas; este envoltorio las pasa a next.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };

const isBodyParserError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && typeof (err as { type?: unknown }).type === 'string' &&
  typeof (err as { status?: unknown }).status === 'number' && (err as { status: number }).status < 500;

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isHttpError(err)) return sendError(res, err);
  if (isBodyParserError(err)) return sendError(res, httpError(400, 'INVALID_INPUT'));
  console.error(err);
  sendError(res, httpError(500, 'INTERNAL'));
};
