import { parseAmount, round2, type ParsedAmount } from './amounts';
import { detectDateOrder, findDatesInText, parseRawDate, resolveMonthDay, toISO, type RawDate } from './dates';
import { cellByStart, detectHeader, nearestCell } from './layout';
import { buildLines } from './layout';
import type { ColumnRole, DateOrder, HeaderCell, PageText, ParseResult, Transaction, Word } from './types';

export interface ParseOptions {
  /** Force day/month order instead of auto-detecting it. */
  dateOrder?: DateOrder;
  /** Force statement kind instead of auto-detecting it. */
  kind?: 'bank' | 'card';
}

type MoneyRole = 'debit' | 'credit' | 'amount' | 'balance';
interface Token {
  text: string;
  x: number;
  right: number;
  amt: ParsedAmount | null;
}
interface DraftRow {
  raw: RawDate | null;
  carriedDate: boolean;
  desc: string[];
  ref: string[];
  money: Array<{ role: MoneyRole; amt: ParsedAmount; right: number }>;
  page: number;
  descX: number;
  lastY: number;
  lastH: number;
  continuations: number;
}

const OPENING_RE = /\b(opening|beginning|previous|starting)\s+balance\b|balance\s+(brought|b\/f|forward)|brought\s+forward|\bb\/f\b/i;
const CLOSING_RE = /\b(closing|ending|new|statement)\s+balance\b|carried\s+forward|\bc\/f\b/i;
const SUMMARY_RE = /^(total|sub\s*total|grand total|totals)\b|\btotal (withdrawals|deposits|debits|credits)\b/i;
const FOOTER_RE = /^page\s*\d+(\s*(of|\/)\s*\d+)?$|^\d+\s*(of|\/)\s*\d+$|^continued\b|^\(continued\)/i;
const CARD_RE = /credit card|card\s?member|minimum payment|payment due date|statement balance|rewards card|card ending|account ending|card statement|new balance/i;
const NOT_DESC_ONLY_RE = /^[\s\-–—_.*|]*$/;

const AMOUNT_JOIN_PREFIX = /^(?:[-−+]?[$₹£€¥]|[-−+]|rs\.?|inr|usd|gbp|eur)$/i;
const AMOUNT_JOIN_SUFFIX = /^(?:cr|dr)\.?$/i;

/** Merge split tokens like "$" "12.00" or "1,200.00" "Cr" and classify amounts. */
function tokenize(words: Word[]): Token[] {
  const toks: Token[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let text = w.text;
    let right = w.right;
    let j = i;
    if (AMOUNT_JOIN_PREFIX.test(text) && words[i + 1] && parseAmount(text + words[i + 1].text)) {
      text = text + words[i + 1].text;
      right = words[i + 1].right;
      j = i + 1;
    }
    if (words[j + 1] && AMOUNT_JOIN_SUFFIX.test(words[j + 1].text) && parseAmount(text)) {
      text = text + ' ' + words[j + 1].text;
      right = words[j + 1].right;
      j = j + 1;
    }
    toks.push({ text, x: w.x, right, amt: parseAmount(text) });
    i = j;
  }
  return toks;
}

/** Try to read a date from the start of the token list (skipping a serial number). Returns tokens consumed. */
function leadingDate(toks: Token[]): { raw: RawDate; used: number } | null {
  for (let skip = 0; skip <= 1; skip++) {
    if (skip === 1 && !/^\d{1,4}\.?$/.test(toks[0]?.text ?? '')) break;
    for (let k = 3; k >= 1; k--) {
      if (toks.length < skip + k) continue;
      const s = toks.slice(skip, skip + k).map((t) => t.text).join(' ');
      const raw = parseRawDate(s);
      if (raw) return { raw, used: skip + k };
    }
  }
  return null;
}

function dateAt(toks: Token[], i: number): number {
  for (let k = 3; k >= 1; k--) {
    if (toks.length < i + k) continue;
    if (parseRawDate(toks.slice(i, i + k).map((t) => t.text).join(' '))) return k;
  }
  return 0;
}

interface Cluster {
  right: number;
  count: number;
}

/** Without a header row, infer money columns by clustering amount right-edges. */
function inferColumns(rows: Array<{ toks: Token[] }>): Map<number, MoneyRole> | null {
  const clusters: Cluster[] = [];
  for (const r of rows) {
    for (const t of r.toks) {
      if (!t.amt) continue;
      const c = clusters.find((c) => Math.abs(c.right - t.right) <= 10);
      if (c) {
        c.right = (c.right * c.count + t.right) / (c.count + 1);
        c.count++;
      } else clusters.push({ right: t.right, count: 1 });
    }
  }
  const significant = clusters.filter((c) => c.count >= Math.max(1, rows.length * 0.08)).sort((a, b) => a.right - b.right);
  if (!significant.length) return null;
  const map = new Map<number, MoneyRole>();
  const last = significant[significant.length - 1];
  const hasBalance = significant.length >= 2 && last.count >= rows.length * 0.6;
  const rest = hasBalance ? significant.slice(0, -1) : significant;
  if (hasBalance) map.set(last.right, 'balance');
  if (rest.length >= 2) {
    map.set(rest[rest.length - 2].right, 'debit');
    map.set(rest[rest.length - 1].right, 'credit');
  } else if (rest.length === 1) map.set(rest[0].right, 'amount');
  return map;
}

function roleFromClusters(map: Map<number, MoneyRole>, right: number): MoneyRole | null {
  let best: MoneyRole | null = null;
  let bd = Infinity;
  for (const [r, role] of map) {
    const d = Math.abs(r - right);
    if (d < bd) {
      bd = d;
      best = role;
    }
  }
  return bd <= 14 ? best : null;
}

function detectCurrency(text: string): string | null {
  const counts: Record<string, number> = {};
  const add = (k: string, n: number) => (counts[k] = (counts[k] ?? 0) + n);
  add('USD', (text.match(/\$|\bUSD\b/g) ?? []).length);
  add('INR', (text.match(/₹|\bINR\b|\bRs\.?\s?\d/g) ?? []).length);
  add('GBP', (text.match(/£|\bGBP\b|sort code/gi) ?? []).length);
  add('EUR', (text.match(/€|\bEUR\b/g) ?? []).length);
  add('AUD', (text.match(/\bAUD\b|\bBSB\b/g) ?? []).length);
  add('CAD', (text.match(/\bCAD\b/g) ?? []).length);
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : null;
}

export function parseStatement(pages: PageText[], opts: ParseOptions = {}): ParseResult {
  const lines = buildLines(pages);
  const fullText = lines.map((l) => l.text).join('\n');
  const warnings: string[] = [];
  const result: ParseResult = {
    transactions: [],
    dateOrder: opts.dateOrder ?? 'MDY',
    kind: 'bank',
    currency: detectCurrency(fullText),
    openingBalance: null,
    closingBalance: null,
    pages: pages.length,
    warnings,
    reconciled: null,
  };
  if (!fullText.trim()) {
    warnings.push(
      'No text layer found. This PDF looks like a scanned image. StatementSheet reads digital PDFs downloaded from online banking; scanned or photographed statements are not supported yet.',
    );
    return result;
  }

  // Header detection (first header wins; repeated headers on later pages are skipped).
  let header: HeaderCell[] | null = null;
  const headerTexts = new Set<string>();
  for (const l of lines) {
    const h = detectHeader(l);
    if (h) {
      if (!header) header = h;
      headerTexts.add(l.text.toLowerCase());
    }
  }

  const tokLines = lines.map((l) => ({ line: l, toks: tokenize(l.words) }));
  const dated = tokLines.map((tl) => ({ ...tl, lead: leadingDate(tl.toks) }));

  // Date order: explicit option > unambiguous evidence > currency hint.
  const hint: DateOrder = result.currency === 'USD' || result.currency === 'CAD' ? 'MDY' : result.currency ? 'DMY' : 'MDY';
  const allRaw = [...dated.flatMap((d) => (d.lead ? [d.lead.raw] : [])), ...findDatesInText(fullText)];
  const order = opts.dateOrder ?? detectDateOrder(allRaw, hint);
  result.dateOrder = order;

  // Statement period end: latest full date mentioned anywhere.
  let periodEnd: { year: number; month: number } | null = null;
  for (const d of findDatesInText(fullText)) {
    const { month } = resolveMonthDay(d, order);
    if (d.year === null) continue;
    if (!periodEnd || d.year * 12 + month > periodEnd.year * 12 + periodEnd.month) periodEnd = { year: d.year, month };
  }

  const clusterMap = header ? null : inferColumns(dated.filter((d) => d.lead && d.toks.some((t) => t.amt)));

  const descCell = header?.find((c) => c.role === 'desc') ?? null;
  const firstMoneyX = header
    ? Math.min(...header.filter((c) => ['debit', 'credit', 'amount', 'balance'].includes(c.role)).map((c) => c.x))
    : Infinity;

  const MONEY_ROLES: ColumnRole[] = ['debit', 'credit', 'amount', 'balance'];
  const roleOf = (t: Token): ColumnRole => {
    if (header) {
      if (t.amt) {
        const { cell, dist } = nearestCell(header, t.x, t.right);
        // An amount written inside the description column is part of the description text.
        if (cell.role === 'desc' && dist === 0) return 'desc';
        const money = header.filter((c) => MONEY_ROLES.includes(c.role));
        const near = nearestCell(money, t.x, t.right);
        return near.dist < 70 ? near.cell.role : 'desc';
      }
      const role = cellByStart(header, t.x).role;
      return MONEY_ROLES.includes(role) || role === 'other' ? 'desc' : role;
    }
    if (t.amt && clusterMap) return roleFromClusters(clusterMap, t.right) ?? 'desc';
    return t.amt ? 'amount' : 'desc';
  };

  const drafts: DraftRow[] = [];
  let current: DraftRow | null = null;
  let lastDateRaw: RawDate | null = null;

  for (const { line, toks, lead } of dated) {
    const lower = line.text.toLowerCase();
    if (headerTexts.has(lower) || FOOTER_RE.test(line.text.trim())) {
      current = null;
      continue;
    }
    if (current && line.page !== current.page) current = null;

    const startIdx = lead ? lead.used : 0;
    const money: DraftRow['money'] = [];
    const desc: string[] = [];
    const ref: string[] = [];
    let descX = Infinity;
    for (let i = startIdx; i < toks.length; i++) {
      const t = toks[i];
      if (!t.amt) {
        const k = dateAt(toks, i);
        if (k) {
          // Secondary dates (value date / posting date) are dropped unless they sit in the description column.
          const role = header ? nearestCell(header, t.x, toks[i + k - 1].right).cell.role : 'vdate';
          if (role === 'vdate' || role === 'date' || (lead && i === startIdx)) {
            i += k - 1;
            continue;
          }
        }
      }
      const role = roleOf(t);
      if (t.amt && (role === 'debit' || role === 'credit' || role === 'amount' || role === 'balance')) {
        money.push({ role, amt: t.amt, right: t.right });
      } else if (role === 'ref') {
        ref.push(t.text);
      } else if (role === 'vdate' || role === 'date') {
        continue;
      } else {
        desc.push(t.text);
        descX = Math.min(descX, t.x);
      }
    }
    const descText = desc.join(' ');

    // Opening / closing balance lines.
    if (OPENING_RE.test(line.text)) {
      const amts = toks.filter((t) => t.amt);
      if (amts.length && result.openingBalance === null && drafts.length === 0) {
        const a = amts[amts.length - 1].amt!;
        result.openingBalance = a.sign === -1 ? -a.value : a.value;
      }
      current = null;
      continue;
    }
    if (CLOSING_RE.test(line.text) || SUMMARY_RE.test(descText)) {
      const amts = toks.filter((t) => t.amt);
      if (CLOSING_RE.test(line.text) && amts.length) {
        const a = amts[amts.length - 1].amt!;
        result.closingBalance = a.sign === -1 ? -a.value : a.value;
      }
      current = null;
      continue;
    }

    const hasTxnMoney = money.some((m) => m.role !== 'balance');

    if (lead && hasTxnMoney) {
      lastDateRaw = lead.raw;
      current = {
        raw: lead.raw,
        carriedDate: false,
        desc,
        ref,
        money,
        page: line.page,
        descX,
        lastY: line.y,
        lastH: line.h,
        continuations: 0,
      };
      drafts.push(current);
      continue;
    }
    if (!lead && hasTxnMoney && lastDateRaw && desc.length && drafts.length && (header ? line.page >= drafts[0].page : true)) {
      // Same-day transaction where the bank prints the date only once.
      current = {
        raw: lastDateRaw,
        carriedDate: true,
        desc,
        ref,
        money,
        page: line.page,
        descX,
        lastY: line.y,
        lastH: line.h,
        continuations: 0,
      };
      drafts.push(current);
      continue;
    }
    if (!lead && !money.length && current && (desc.length || ref.length)) {
      // Possible wrapped description line.
      const gapOk = current.lastY - line.y <= current.lastH * 2.8 && current.lastY > line.y;
      const firstX = line.words[0].x;
      const xOk = descCell ? firstX >= descCell.x - 6 && firstX < firstMoneyX : Math.abs(firstX - current.descX) <= 14;
      if (gapOk && xOk && current.continuations < 4 && !NOT_DESC_ONLY_RE.test(descText + ref.join(''))) {
        current.desc.push(...desc);
        current.ref.push(...ref);
        current.lastY = line.y;
        current.continuations++;
        continue;
      }
    }
    current = null;
  }

  // Statement kind: card statements have no running balance and card wording.
  const anyBalance = drafts.some((d) => d.money.some((m) => m.role === 'balance'));
  result.kind = opts.kind ?? (!anyBalance && CARD_RE.test(fullText) ? 'card' : 'bank');

  let unresolved = 0;
  result.transactions = drafts.map((d, i) => {
    let amount = 0;
    let balance: number | null = null;
    for (const m of d.money) {
      const v = m.amt.value;
      if (m.role === 'debit') amount -= v;
      else if (m.role === 'credit') amount += v;
      else if (m.role === 'amount') {
        const signed = m.amt.sign === -1 ? -v : v;
        amount += result.kind === 'card' ? -signed : signed;
      } else balance = m.amt.sign === -1 ? -v : v;
    }
    const date = d.raw ? toISO(d.raw, order, periodEnd) : '';
    if (!date) unresolved++;
    return {
      id: `t${i + 1}`,
      date,
      description: d.desc.join(' ').replace(/\s+/g, ' ').trim(),
      reference: d.ref.join(' ').trim(),
      amount: round2(amount),
      balance,
      page: d.page,
      check: 'unchecked' as const,
    };
  });

  result.reconciled = reconcile(result.transactions, result.openingBalance);

  if (!result.transactions.length) {
    warnings.push(
      "We couldn't find a transaction table in this PDF. If it is a bank or card statement, please let us know which bank so we can add support.",
    );
  }
  if (unresolved) warnings.push(`${unresolved} transaction date(s) could not be resolved. Check the Date column before exporting.`);
  const mismatches = result.transactions.filter((t) => t.check === 'mismatch').length;
  if (mismatches) {
    warnings.push(`${mismatches} row(s) don't reconcile with the running balance. They are highlighted. Please review them before exporting.`);
  }
  const lastBal = [...result.transactions].reverse().find((t) => t.balance !== null)?.balance ?? null;
  if (result.closingBalance !== null && lastBal !== null && Math.abs(lastBal - result.closingBalance) > 0.005 && !isReverse(result.transactions)) {
    warnings.push('The final running balance does not match the closing balance printed on the statement.');
  }
  return result;
}

function isReverse(txns: Transaction[]): boolean {
  const ds = txns.map((t) => t.date).filter(Boolean);
  return ds.length > 1 && ds[0] > ds[ds.length - 1];
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Check each row against the running balance and auto-correct signs when the balance proves
 * the opposite direction. Handles newest-first statements. Returns the reconciled fraction.
 */
export function reconcile(txns: Transaction[], opening: number | null): number | null {
  const withBal = txns.filter((t) => t.balance !== null).length;
  if (!withBal) return null;

  const run = (seq: Transaction[], start: number | null, apply: boolean): number => {
    let prev = start;
    let pending = 0; // sum of amounts since the last printed balance
    let pendingRows: Transaction[] = [];
    let good = 0;
    for (const t of seq) {
      pending = round2(pending + t.amount);
      pendingRows.push(t);
      if (t.balance === null) continue;
      if (prev !== null) {
        const diff = round2(t.balance - prev);
        if (near(diff, pending)) {
          good++;
          if (apply) pendingRows.forEach((r) => (r.check = 'ok'));
        } else if (near(diff, round2(pending - 2 * t.amount))) {
          good++;
          if (apply) {
            t.amount = round2(-t.amount);
            t.check = 'fixed';
            pendingRows.slice(0, -1).forEach((r) => (r.check = 'ok'));
          }
        } else if (apply) {
          t.check = 'mismatch';
        }
      }
      prev = t.balance;
      pending = 0;
      pendingRows = [];
    }
    return good;
  };

  // Newest-first statements: walk in reverse; the opening balance then can't be used as a start.
  const fwd = run(txns, opening, false);
  const rev = run([...txns].reverse(), opening, false);
  if (rev > fwd) run([...txns].reverse(), opening, true);
  else run(txns, opening, true);

  const checked = txns.filter((t) => t.check !== 'unchecked');
  if (!checked.length) return null;
  return checked.filter((t) => t.check !== 'mismatch').length / checked.length;
}
