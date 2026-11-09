// Integration: real PDF → pdf.js → parser → exporters; and the live Lemon Squeezy License API.
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseFixture } from '../helpers';
import { toCSV, toOFX, toXLSX } from '../../src/lib/export/formats';
import { verifyLicense } from '../../src/lib/plan';

describe('pdf → csv/xlsx/ofx pipeline', () => {
  it('exports the Indian statement to all formats consistently', async () => {
    const r = await parseFixture('in-savings.pdf');
    const csv = toCSV(r.transactions);
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(11);
    expect(csv).toContain('2025-04-03,NEFT CR-ACME TECH PVT LTD-SALARY,N093250012345,,185000.00,185000.00,309550.00');
    const wb = XLSX.read(await toXLSX(r.transactions), { type: 'array' });
    expect(XLSX.utils.sheet_to_json(wb.Sheets.Transactions)).toHaveLength(10);
    const ofx = toOFX(r.transactions, { currency: r.currency });
    expect(ofx.match(/<STMTTRN>/g)).toHaveLength(10);
    expect(ofx).toContain('<CURDEF>INR');
    const sum = r.transactions.reduce((s, t) => s + t.amount, 0);
    expect(Math.round((125000 + sum) * 100) / 100).toBe(r.transactions.at(-1)!.balance);
  });
});

describe.skipIf(process.env.OFFLINE === '1')('Lemon Squeezy License API (live network)', () => {
  it('rejects an unknown key through the real API', async () => {
    const r = await verifyLicense('00000000-0000-0000-0000-000000000000', { storeId: 1, productIds: [] }, (u, i) => fetch(u, i));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not found|not valid|license/i);
  }, 20000);
});
