export interface ParsedAmount {
  value: number;
  /** -1 when the token itself marks a debit (minus sign, parentheses, DR); +1 for CR; 0 when unsigned. */
  sign: -1 | 0 | 1;
  currency: string | null;
}

const CURRENCY_RE = /[$₹£€¥]|\b(?:usd|inr|gbp|eur|rs\.?|aud|cad)\b/i;

/**
 * Parse a money token such as "1,234.56", "-$50.00", "(12.00)", "1,25,000.00 Cr", "45.20-".
 * Requires exactly two decimals so reference numbers and dates are not mistaken for amounts.
 */
export function parseAmount(input: string): ParsedAmount | null {
  let s = input.trim();
  if (!s || s.length > 30) return null;
  let sign: -1 | 0 | 1 = 0;
  let currency: string | null = null;

  const suffix = s.match(/(?<=[\d)\s])\s*(cr|dr)\.?$/i);
  if (suffix) {
    sign = suffix[1].toLowerCase() === 'dr' ? -1 : 1;
    s = s.slice(0, suffix.index).trim();
  }
  const cur = s.match(CURRENCY_RE);
  if (cur) {
    currency = normalizeCurrency(cur[0]);
    s = s.replace(CURRENCY_RE, '').trim();
  }
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1).trim();
  }
  if (s.endsWith('-')) {
    sign = -1;
    s = s.slice(0, -1).trim();
  } else if (s.endsWith('+')) {
    sign = 1;
    s = s.slice(0, -1).trim();
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    sign = -1;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    sign = 1;
    s = s.slice(1).trim();
  }
  // Currency symbol may come after the minus sign: "-$50.00"
  const cur2 = s.match(/^[$₹£€¥]/);
  if (cur2) {
    currency = currency ?? normalizeCurrency(cur2[0]);
    s = s.slice(1).trim();
  }
  if (!/^(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{2}$/.test(s)) return null;
  const value = parseFloat(s.replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  return { value, sign, currency };
}

export function normalizeCurrency(s: string): string {
  const t = s.toLowerCase().replace('.', '');
  if (t === '$' || t === 'usd') return 'USD';
  if (t === '₹' || t === 'inr' || t === 'rs') return 'INR';
  if (t === '£' || t === 'gbp') return 'GBP';
  if (t === '€' || t === 'eur') return 'EUR';
  if (t === 'aud') return 'AUD';
  if (t === 'cad') return 'CAD';
  if (t === '¥') return 'JPY';
  return s.toUpperCase();
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
