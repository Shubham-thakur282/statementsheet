import type { DateOrder } from './types';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';

/** A date as written: may be missing its year, and numeric dates may be day/month ambiguous. */
export interface RawDate {
  /** For numeric dates: the two leading numbers in written order; otherwise null. */
  ambiguous: [number, number] | null;
  day: number;
  month: number;
  year: number | null;
}

const toYear = (s: string): number => {
  const n = parseInt(s, 10);
  return s.length <= 2 ? 2000 + n : n;
};

const PATTERNS: Array<{ re: RegExp; build: (m: RegExpMatchArray) => RawDate | null }> = [
  // 2025-01-31
  { re: /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/, build: (m) => ({ ambiguous: null, year: +m[1], month: +m[2], day: +m[3] }) },
  // 31/01/2025, 01-31-25, 31.01.2025
  {
    re: /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/,
    build: (m) => ({ ambiguous: [+m[1], +m[2]], day: +m[1], month: +m[2], year: toYear(m[3]) }),
  },
  // 31/01 or 01/31 (no year)
  { re: /^(\d{1,2})[-/.](\d{1,2})$/, build: (m) => ({ ambiguous: [+m[1], +m[2]], day: +m[1], month: +m[2], year: null }) },
  // 31 Jan 2025, 31-Jan-25, 31 January, 31Jan2025
  {
    re: new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/]?${MON}(?:[\\s\\-/,]+(\\d{4}|\\d{2}))?$`, 'i'),
    build: (m) => ({ ambiguous: null, day: +m[1], month: MONTHS[m[2].toLowerCase().replace('.', '')], year: m[3] ? toYear(m[3]) : null }),
  },
  // Jan 31, 2025 / January 31 2025 / Jan 31 / Jan-31-2025
  {
    re: new RegExp(`^${MON}[\\s\\-/]?(\\d{1,2})(?:st|nd|rd|th)?(?:,?[\\s\\-/]+(\\d{4}))?$`, 'i'),
    build: (m) => ({ ambiguous: null, day: +m[2], month: MONTHS[m[1].toLowerCase().replace('.', '')], year: m[3] ? +m[3] : null }),
  },
];

/** Parse a complete date string (the whole string must be a date). */
export function parseRawDate(input: string): RawDate | null {
  const s = input.trim().replace(/\s+/g, ' ');
  if (s.length < 3 || s.length > 20) return null;
  for (const p of PATTERNS) {
    const m = s.match(p.re);
    if (!m) continue;
    const d = p.build(m);
    if (!d || !d.month) continue;
    if (d.ambiguous) {
      const [a, b] = d.ambiguous;
      const okDMY = a >= 1 && a <= 31 && b >= 1 && b <= 12;
      const okMDY = b >= 1 && b <= 31 && a >= 1 && a <= 12;
      if (!okDMY && !okMDY) continue;
    } else if (d.day < 1 || d.day > 31 || d.month < 1 || d.month > 12) continue;
    if (d.year !== null && (d.year < 1990 || d.year > 2100)) continue;
    return d;
  }
  return null;
}

/** Decide DMY vs MDY from all numeric dates in a document. */
export function detectDateOrder(dates: RawDate[], hint: DateOrder): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const d of dates) {
    if (!d.ambiguous) continue;
    const [a, b] = d.ambiguous;
    if (a > 12 && b <= 12) dmy++;
    if (b > 12 && a <= 12) mdy++;
  }
  if (dmy > mdy) return 'DMY';
  if (mdy > dmy) return 'MDY';
  return hint;
}

export function resolveMonthDay(d: RawDate, order: DateOrder): { day: number; month: number } {
  if (!d.ambiguous) return { day: d.day, month: d.month };
  const [a, b] = d.ambiguous;
  if (order === 'DMY') return b <= 12 ? { day: a, month: b } : { day: b, month: a };
  return a <= 12 ? { day: b, month: a } : { day: a, month: b };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isValidYMD(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Turn a raw date into ISO. Dates without a year get the statement end year, or the year
 * before when the month is after the statement's end month (Dec → Jan rollover).
 */
export function toISO(d: RawDate, order: DateOrder, periodEnd: { year: number; month: number } | null): string {
  const { day, month } = resolveMonthDay(d, order);
  let year = d.year;
  if (year === null) {
    if (!periodEnd) return '';
    year = month > periodEnd.month ? periodEnd.year - 1 : periodEnd.year;
  }
  if (!isValidYMD(year, month, day)) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Find dates that include a year anywhere in free text (used to infer the statement period). */
export function findDatesInText(text: string): RawDate[] {
  const out: RawDate[] = [];
  const res = [
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,
    /\b\d{1,2}[-/.]\d{1,2}[-/.](?:\d{4}|\d{2})\b/g,
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?[\\s\\-]${MON}[\\s\\-,]+\\d{4}\\b`, 'gi'),
    new RegExp(`\\b${MON}\\s\\d{1,2}(?:st|nd|rd|th)?,?\\s\\d{4}\\b`, 'gi'),
  ];
  for (const re of res) {
    for (const m of text.matchAll(re)) {
      const d = parseRawDate(m[0]);
      if (d && d.year !== null) out.push(d);
    }
  }
  return out;
}
