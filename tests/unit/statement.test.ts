import { describe, expect, it } from 'vitest';
import { parseStatement, reconcile } from '../../src/lib/parse/statement';
import type { PageText, Transaction } from '../../src/lib/parse/types';
import { expected, parseFixture } from '../helpers';

describe('fixture statements (end-to-end through pdf.js)', () => {
  it.each(['us-checking', 'in-savings', 'uk-signed', 'credit-card'])('%s matches expected transactions exactly', async (name) => {
    const r = await parseFixture(`${name}.pdf`);
    const exp = expected(name);
    expect(r.transactions.map(({ date, description, amount }) => ({ date, description, amount }))).toEqual(exp.map(({ date, description, amount }) => ({ date, description, amount })));
    exp.forEach((e, i) => {
      if (e.balance !== undefined) expect(r.transactions[i].balance).toBe(e.balance);
    });
    expect(r.warnings).toEqual([]);
  });

  it('reconciles every row of a multi-page statement with opening balance', async () => {
    const r = await parseFixture('us-checking.pdf');
    expect(r.pages).toBe(2);
    expect(r.openingBalance).toBe(2450);
    expect(r.reconciled).toBe(1);
    expect(r.transactions.every((t) => t.check === 'ok')).toBe(true);
    expect(r.dateOrder).toBe('MDY');
  });

  it('detects Indian conventions: DMY, INR, reference column', async () => {
    const r = await parseFixture('in-savings.pdf');
    expect(r.dateOrder).toBe('DMY');
    expect(r.currency).toBe('INR');
    expect(r.transactions[0].reference).toBe('0000509112345678');
    expect(r.transactions[1].description).toBe('NEFT CR-ACME TECH PVT LTD-SALARY');
  });

  it('detects credit card statements and inverts signs; kind can be overridden', async () => {
    const r = await parseFixture('credit-card.pdf');
    expect(r.kind).toBe('card');
    const asBank = await parseFixture('credit-card.pdf', { kind: 'bank' });
    expect(asBank.transactions[0].amount).toBe(412.6);
  });

  it('honours a forced date order', async () => {
    const r = await parseFixture('us-checking.pdf', { dateOrder: 'DMY' });
    // 01/02 read as 1 Feb; after the Jan-2025 statement end, so it's assigned the previous year.
    expect(r.transactions[0].date).toBe('2024-02-01');
  });

  it('warns on a PDF without transactions', async () => {
    const r = await parseFixture('not-a-statement.pdf');
    expect(r.transactions).toHaveLength(0);
    expect(r.warnings[0]).toMatch(/couldn't find a transaction table/);
  });
});

// Synthetic layouts built directly from positioned text (no pdf.js), to test heuristics in isolation.
const item = (str: string, x: number, y: number, w = str.length * 4.5) => ({ str, x, y, w, h: 9 });
function page(rows: Array<Array<[string, number]>>, startY = 700): PageText {
  return { page: 1, items: rows.flatMap((r, i) => r.map(([s, x]) => item(s, x, startY - i * 12))) };
}

describe('heuristics', () => {
  it('returns a scanned-PDF warning when there is no text', () => {
    const r = parseStatement([{ page: 1, items: [] }]);
    expect(r.warnings[0]).toMatch(/scanned/);
  });

  it('infers columns without a header row and fixes signs from the balance', () => {
    const r = parseStatement([
      page([
        [['03/01/2025', 40], ['Opening', 110]],
        [['03/01/2025', 40], ['SALARY', 110], ['1,000.00', 400], ['1,500.00', 480]],
        [['05/01/2025', 40], ['RENT', 110], ['800.00', 400], ['700.00', 480]],
        [['07/01/2025', 40], ['COFFEE', 110], ['3.50', 400], ['696.50', 480]],
        [['15/01/2025', 40], ['REFUND', 110], ['20.00', 400], ['716.50', 480]],
      ]),
    ]);
    expect(r.transactions.map((t) => t.amount)).toEqual([1000, -800, -3.5, 20]);
    expect(r.transactions.slice(1).every((t) => t.check === 'ok' || t.check === 'fixed')).toBe(true);
    expect(r.dateOrder).toBe('DMY');
  });

  it('handles newest-first statements', () => {
    const r = parseStatement([
      page([
        [['Date', 40], ['Description', 110], ['Amount', 380], ['Balance', 460]],
        [['2025-01-03', 40], ['C', 110], ['-5.00', 380], ['85.00', 460]],
        [['2025-01-02', 40], ['B', 110], ['-10.00', 380], ['90.00', 460]],
        [['2025-01-01', 40], ['A', 110], ['100.00', 380], ['100.00', 460]],
      ]),
    ]);
    expect(r.transactions.map((t) => t.check)).toEqual(['ok', 'ok', 'unchecked']);
  });

  it('carries the date to undated same-day rows and skips totals', () => {
    const r = parseStatement([
      page([
        [['Date', 40], ['Details', 110], ['Paid out', 380], ['Paid in', 440], ['Balance', 500]],
        [['01 Mar 2025', 40], ['TESCO', 110], ['10.00', 380], ['90.00', 500]],
        [['BOOTS', 110], ['5.00', 380], ['85.00', 500]],
        [['02 Mar 2025', 40], ['SALARY', 110], ['100.00', 440], ['185.00', 500]],
        [['Total', 110], ['15.00', 380], ['100.00', 440]],
        [['Closing balance', 110], ['185.00', 500]],
      ]),
    ]);
    expect(r.transactions.map((t) => [t.date, t.description, t.amount])).toEqual([
      ['2025-03-01', 'TESCO', -10],
      ['2025-03-01', 'BOOTS', -5],
      ['2025-03-02', 'SALARY', 100],
    ]);
    expect(r.closingBalance).toBe(185);
  });

  it('flags rows that cannot reconcile', () => {
    const r = parseStatement([
      page([
        [['Date', 40], ['Description', 110], ['Amount', 380], ['Balance', 460]],
        [['2025-01-01', 40], ['A', 110], ['100.00', 380], ['100.00', 460]],
        [['2025-01-02', 40], ['B', 110], ['-10.00', 380], ['77.00', 460]],
      ]),
    ]);
    expect(r.transactions[1].check).toBe('mismatch');
    expect(r.warnings.join(' ')).toMatch(/don't reconcile/);
  });
});

describe('reconcile()', () => {
  const t = (amount: number, balance: number | null): Transaction => ({ id: 'x', date: '2025-01-01', description: '', reference: '', amount, balance, page: 1, check: 'unchecked' });
  it('returns null without balances', () => expect(reconcile([t(1, null)], null)).toBeNull());
  it('uses the opening balance for the first row', () => {
    const rows = [t(-10, 90), t(5, 95)];
    expect(reconcile(rows, 100)).toBe(1);
    expect(rows.map((r) => r.check)).toEqual(['ok', 'ok']);
  });
  it('corrects a wrong sign', () => {
    const rows = [t(10, 90)];
    reconcile(rows, 100);
    expect(rows[0]).toMatchObject({ amount: -10, check: 'fixed' });
  });
  it('checks cumulative amounts when balances are printed once per day', () => {
    const rows = [t(-10, null), t(-5, 85)];
    reconcile(rows, 100);
    expect(rows.map((r) => r.check)).toEqual(['ok', 'ok']);
  });
});
