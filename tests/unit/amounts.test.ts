import { describe, expect, it } from 'vitest';
import { parseAmount } from '../../src/lib/parse/amounts';

describe('parseAmount', () => {
  it.each([
    ['1,234.56', 1234.56, 0, null],
    ['3120.55', 3120.55, 0, null],
    ['0.42', 0.42, 0, null],
    ['-45.20', 45.2, -1, null],
    ['−45.20', 45.2, -1, null],
    ['(12.00)', 12, -1, null],
    ['45.20-', 45.2, -1, null],
    ['-$50.00', 50, -1, 'USD'],
    ['$-50.00', 50, -1, 'USD'],
    ['$1,000.00', 1000, 0, 'USD'],
    ['£62.35', 62.35, 0, 'GBP'],
    ['₹1,25,000.00', 125000, 0, 'INR'],
    ['1,25,000.00 Cr', 125000, 1, null],
    ['500.00 DR', 500, -1, null],
    ['500.00Dr', 500, -1, null],
    ['+250.00', 250, 1, null],
  ] as const)('%s', (s, value, sign, cur) => {
    expect(parseAmount(s)).toEqual({ value, sign, currency: cur });
  });

  it.each(['9876543210', '0000509112345678', '01/02', '2025', '12.5', '1.234', 'abc', '', '1,2,3.00', '12.345', '#1042', '01.04.25'])('rejects %s', (s) => {
    expect(parseAmount(s)).toBeNull();
  });
});
