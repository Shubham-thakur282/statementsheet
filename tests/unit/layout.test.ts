import { describe, expect, it } from 'vitest';
import { buildLines, detectHeader, itemsToWords, roleForLabel } from '../../src/lib/parse/layout';

describe('layout', () => {
  it('splits items into positioned words', () => {
    const ws = itemsToWords([{ str: 'AB CD', x: 10, y: 5, w: 50, h: 8 }]);
    expect(ws.map((w) => [w.text, w.x])).toEqual([['AB', 10], ['CD', 40]]);
  });
  it('groups words on the same baseline into lines, top to bottom', () => {
    const lines = buildLines([{ page: 1, items: [{ str: 'b', x: 50, y: 100.5, w: 5, h: 8 }, { str: 'a', x: 10, y: 100, w: 5, h: 8 }, { str: 'c', x: 10, y: 80, w: 5, h: 8 }] }]);
    expect(lines.map((l) => l.text)).toEqual(['a b', 'c']);
  });
  it.each([
    ['Withdrawal Amt.', 'debit'],
    ['Deposit Amt.', 'credit'],
    ['Closing Balance', 'balance'],
    ['Paid out', 'debit'],
    ['Paid in', 'credit'],
    ['Amount (GBP)', 'amount'],
    ['Chq./Ref.No.', 'ref'],
    ['Value Dt', 'vdate'],
    ['Post Date', 'vdate'],
    ['Narration', 'desc'],
    ['Particulars', 'desc'],
  ])('%s → %s', (label, role) => expect(roleForLabel(label, true)).toBe(role));
  it('detects header lines and rejects prose', () => {
    const [header] = buildLines([{ page: 1, items: [['Date', 40], ['Description', 100], ['Debit', 300], ['Credit', 360], ['Balance', 420]].map(([s, x]) => ({ str: s as string, x: x as number, y: 500, w: (s as string).length * 4, h: 8 })) }]);
    expect(detectHeader(header)?.map((c) => c.role)).toEqual(['date', 'desc', 'debit', 'credit', 'balance']);
    const [prose] = buildLines([{ page: 1, items: [{ str: 'Your balance on this date was great', x: 40, y: 500, w: 160, h: 8 }] }]);
    expect(detectHeader(prose)).toBeNull();
  });
});
