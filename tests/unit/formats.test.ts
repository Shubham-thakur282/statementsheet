import { describe, expect, it } from 'vitest';
import { csvCell, fitid, toCSV, toOFX, toQIF, toXLSX } from '../../src/lib/export/formats';
import type { Transaction } from '../../src/lib/parse/types';
import * as XLSX from 'xlsx';

const t = (p: Partial<Transaction>): Transaction => ({ id: '1', date: '2025-01-02', description: 'COFFEE', reference: '', amount: -3.5, balance: 96.5, page: 1, check: 'ok', ...p });

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutralises formula injection', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+cmd')).toBe("'+cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('-10.00')).toBe('-10.00');
  });
  it('produces header, BOM, debit/credit split and signed amount', () => {
    const csv = toCSV([t({}), t({ id: '2', description: 'PAY, INC', amount: 1000, balance: 1096.5 })]);
    expect(csv.startsWith('﻿Date,Description,Reference,Debit,Credit,Amount,Balance\r\n')).toBe(true);
    expect(csv).toContain('2025-01-02,COFFEE,,3.50,,-3.50,96.50');
    expect(csv).toContain('2025-01-02,"PAY, INC",,,1000.00,1000.00,1096.50');
  });
});

describe('ofx', () => {
  it('builds a bank statement with stable FITIDs and escaped names', () => {
    const rows = [t({ description: 'A&B <shop>' }), t({ id: '2', date: '2025-01-05', amount: 50, balance: 146.5 })];
    const ofx = toOFX(rows, { currency: 'USD' });
    expect(ofx).toMatch(/^OFXHEADER:100/);
    expect(ofx).toContain('<BANKACCTFROM>');
    expect(ofx).toContain('<TRNTYPE>DEBIT');
    expect(ofx).toContain('<TRNAMT>-3.50');
    expect(ofx).toContain('<NAME>A&amp;B &lt;shop&gt;');
    expect(ofx).toContain('<DTSTART>20250102120000');
    expect(ofx).toContain('<DTEND>20250105120000');
    expect(ofx).toContain('<BALAMT>146.50');
    expect(fitid(rows[0], 0)).toBe(fitid({ ...rows[0] }, 0));
    expect(fitid(rows[0], 0)).not.toBe(fitid(rows[0], 1));
  });
  it('uses credit card message set for cards', () => {
    expect(toOFX([t({})], { currency: 'GBP', accountType: 'CREDITLINE' })).toContain('<CCACCTFROM>');
  });
  it('skips undated rows', () => {
    expect(toOFX([t({ date: '' })], { currency: null })).not.toContain('<STMTTRN>');
  });
});

describe('qif', () => {
  it('writes US-style dates and records', () => {
    expect(toQIF([t({ reference: '1042' })])).toBe('!Type:Bank\nD01/02/2025\nT-3.50\nPCOFFEE\nN1042\n^\n');
    expect(toQIF([t({})], true).startsWith('!Type:CCard')).toBe(true);
  });
});

describe('xlsx', () => {
  it('writes numeric cells', async () => {
    const bytes = await toXLSX([t({})]);
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets.Transactions;
    expect(ws.A1.v).toBe('Date');
    expect(ws.F2.t).toBe('n');
    expect(ws.F2.v).toBe(-3.5);
    expect(ws.D2.v).toBe(3.5);
  });
});
