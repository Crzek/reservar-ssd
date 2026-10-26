import { describe, expect, it } from 'vitest';
import { FALLBACK_MESSAGE, messageFor } from '../src/lib/errorMessages';
import { ERROR_CODES } from '../src/lib/types';

describe('messageFor', () => {
  it('cada ErrorCode tiene un mensaje no vacío', () => {
    for (const code of ERROR_CODES) expect(messageFor(code).trim()).not.toBe('');
  });

  it('códigos desconocidos y NETWORK usan el mensaje de respaldo', () => {
    expect(messageFor('NETWORK')).toBe(FALLBACK_MESSAGE);
    expect(messageFor('ALGO_RARO')).toBe(FALLBACK_MESSAGE);
    expect(messageFor('toString')).toBe(FALLBACK_MESSAGE);
    expect(FALLBACK_MESSAGE).toBe('Ocurrió un problema. Inténtalo de nuevo.');
  });

  it('ningún mensaje contiene detalles técnicos', () => {
    for (const code of [...ERROR_CODES, 'NETWORK']) {
      const msg = messageFor(code);
      expect(msg).not.toMatch(/Error|500|stack/);
      for (const c of ERROR_CODES) expect(msg).not.toContain(c);
    }
  });

  it('usa los mensajes clave del contrato', () => {
    expect(messageFor('SLOT_TAKEN')).toBe('La cancha ya fue reservada en este horario');
    expect(messageFor('UNAUTHENTICATED')).toBe('Tu sesión expiró o no has iniciado sesión');
    expect(messageFor('TOO_MANY_ATTEMPTS')).toBe('Demasiados intentos. Inténtalo de nuevo más tarde.');
  });
});
