import { describe, expect, it } from 'vitest';
import { detectDateOrder, findDatesInText, parseRawDate, toISO } from '../../src/lib/parse/dates';

const iso = (s: string, order: 'DMY' | 'MDY' = 'DMY', end: { year: number; month: number } | null = { year: 2025, month: 1 }) => {
  const r = parseRawDate(s);
  return r ? toISO(r, order, end) : null;
};

describe('parseRawDate / toISO', () => {
  it.each([
    ['2025-01-31', 'DMY', '2025-01-31'],
    ['31/01/2025', 'DMY', '2025-01-31'],
    ['01/31/2025', 'MDY', '2025-01-31'],
    ['31-01-25', 'DMY', '2025-01-31'],
    ['31.01.2025', 'DMY', '2025-01-31'],
    ['05 Feb 2025', 'DMY', '2025-02-05'],
    ['05-Feb-25', 'DMY', '2025-02-05'],
    ['5th February 2025', 'DMY', '2025-02-05'],
    ['Feb 5, 2025', 'MDY', '2025-02-05'],
    ['February 5 2025', 'MDY', '2025-02-05'],
    ['Sept 5, 2025', 'MDY', '2025-09-05'],
  ] as const)('%s → %s', (s, order, out) => expect(iso(s, order)).toBe(out));

  it('uses the statement end year for dates without a year, rolling December back', () => {
    expect(iso('12/28', 'MDY', { year: 2025, month: 1 })).toBe('2024-12-28');
    expect(iso('01/03', 'MDY', { year: 2025, month: 1 })).toBe('2025-01-03');
    expect(iso('Jan 05', 'MDY', { year: 2025, month: 1 })).toBe('2025-01-05');
    expect(iso('28 Dec', 'DMY', { year: 2025, month: 1 })).toBe('2024-12-28');
  });

  it('returns empty ISO when the year cannot be inferred', () => {
    expect(iso('12/28', 'MDY', null)).toBe('');
  });

  it('swaps automatically when one component is > 12', () => {
    expect(iso('25/12/2024', 'MDY')).toBe('2024-12-25');
    expect(iso('12/25/2024', 'DMY')).toBe('2024-12-25');
  });

  it.each(['hello', '123456', '1,234.56', '32/13/2025', '00/00/2025', 'Page 1 of 2', '2025', '13/13'])('rejects %s', (s) => {
    expect(parseRawDate(s)).toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    expect(iso('31/02/2025', 'DMY')).toBe('');
    expect(iso('29/02/2024', 'DMY')).toBe('2024-02-29');
  });
});

describe('detectDateOrder', () => {
  it('detects DMY from a day > 12', () => {
    expect(detectDateOrder(['01/04/25', '13/04/25'].map((s) => parseRawDate(s)!), 'MDY')).toBe('DMY');
  });
  it('detects MDY from a day > 12 in second position', () => {
    expect(detectDateOrder(['04/01/25', '04/13/25'].map((s) => parseRawDate(s)!), 'DMY')).toBe('MDY');
  });
  it('falls back to the hint when ambiguous', () => {
    expect(detectDateOrder([parseRawDate('01/02/25')!], 'DMY')).toBe('DMY');
  });
});

describe('findDatesInText', () => {
  it('finds period dates in prose', () => {
    const ds = findDatesInText('Statement Period: January 1, 2025 through January 31, 2025');
    expect(ds.length).toBe(2);
    expect(ds[1]).toMatchObject({ day: 31, month: 1, year: 2025 });
  });
});
