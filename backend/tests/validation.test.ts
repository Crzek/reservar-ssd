import { describe, expect, it } from 'vitest';
import {
  parseCourtId,
  parseDate,
  parseEmail,
  parsePassword,
  parsePositiveId,
  parseStartHour,
} from '../src/lib/validation.ts';

const invalid = { ok: false, code: 'INVALID_INPUT' };

describe('parseEmail', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(parseEmail('  Ana@Test.COM ')).toEqual({ ok: true, value: 'ana@test.com' });
  });
  it('rechaza formatos inválidos y no-strings', () => {
    for (const x of ['ana', 'ana@test', '@test.com', 'a b@test.com', '', 42, null, undefined]) {
      expect(parseEmail(x)).toEqual(invalid);
    }
  });
  it('acepta 254 caracteres y rechaza 255', () => {
    const domain = '@test.com';
    expect(parseEmail('a'.repeat(254 - domain.length) + domain).ok).toBe(true);
    expect(parseEmail('a'.repeat(255 - domain.length) + domain)).toEqual(invalid);
  });
});

describe('parsePassword', () => {
  it('exige al menos 8 caracteres sin recortar', () => {
    expect(parsePassword('1234567')).toEqual(invalid);
    expect(parsePassword('12345678')).toEqual({ ok: true, value: '12345678' });
    expect(parsePassword(' 123456 ')).toEqual({ ok: true, value: ' 123456 ' });
    expect(parsePassword(12345678)).toEqual(invalid);
  });
});

describe('parseDate', () => {
  it('acepta fechas reales', () => {
    expect(parseDate('2026-10-27')).toEqual({ ok: true, value: '2026-10-27' });
    expect(parseDate('2028-02-29').ok).toBe(true);
  });
  it('rechaza fechas imposibles o mal formadas', () => {
    for (const x of ['2026-13-40', '2026-02-30', '2027-02-29', '2026-1-01', '27-10-2026', '', undefined, 20261027]) {
      expect(parseDate(x)).toEqual(invalid);
    }
  });
});

describe('parseStartHour', () => {
  it('acepta enteros 0–23', () => {
    expect(parseStartHour(0)).toEqual({ ok: true, value: 0 });
    expect(parseStartHour(23)).toEqual({ ok: true, value: 23 });
  });
  it('rechaza fuera de rango, decimales y strings', () => {
    for (const x of [24, -1, 1.5, '18', null]) expect(parseStartHour(x)).toEqual(invalid);
  });
});

describe('parseCourtId', () => {
  it('acepta 1–5 como number o string', () => {
    expect(parseCourtId(1)).toEqual({ ok: true, value: 1 });
    expect(parseCourtId(5)).toEqual({ ok: true, value: 5 });
    expect(parseCourtId('3')).toEqual({ ok: true, value: 3 });
  });
  it('rechaza 0, 6, "abc" y decimales', () => {
    for (const x of [0, 6, 'abc', 1.5, '1.0', '']) expect(parseCourtId(x)).toEqual(invalid);
  });
});

describe('parsePositiveId', () => {
  it('acepta strings de enteros ≥ 1', () => {
    expect(parsePositiveId('1')).toEqual({ ok: true, value: 1 });
    expect(parsePositiveId('42')).toEqual({ ok: true, value: 42 });
  });
  it('rechaza 0, negativos, decimales y texto', () => {
    for (const x of ['0', '-1', '1.5', 'abc', '', 1]) expect(parsePositiveId(x)).toEqual(invalid);
  });
});
