import type { Transaction } from '../parse/types';

export type ExportFormat = 'csv' | 'xlsx' | 'ofx' | 'qif';

export interface ExportMeta {
  currency: string | null;
  /** Used for OFX account fields. */
  accountType?: 'CHECKING' | 'SAVINGS' | 'CREDITLINE';
}

const fmt = (n: number) => n.toFixed(2);

/** Neutralise spreadsheet formula injection (CWE-1236) and quote per RFC 4180. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const COLUMNS = ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Amount', 'Balance'] as const;

export function rowValues(t: Transaction): Array<string | number | null> {
  return [
    t.date,
    t.description,
    t.reference,
    t.amount < 0 ? Number(fmt(-t.amount)) : null,
    t.amount > 0 ? Number(fmt(t.amount)) : null,
    Number(fmt(t.amount)),
    t.balance === null ? null : Number(fmt(t.balance)),
  ];
}

export function toCSV(txns: Transaction[]): string {
  const lines = [COLUMNS.join(',')];
  for (const t of txns) {
    const v = rowValues(t);
    lines.push(
      [v[0], v[1], v[2], v[3] === null ? '' : fmt(v[3] as number), v[4] === null ? '' : fmt(v[4] as number), fmt(t.amount), t.balance === null ? '' : fmt(t.balance)]
        .map((x) => csvCell(x as string))
        .join(','),
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ofxDate = (iso: string) => iso.replace(/-/g, '') + '120000';

/** Small stable hash for OFX FITIDs so re-importing the same statement doesn't duplicate rows. */
export function fitid(t: Transaction, index: number): string {
  const s = `${t.date}|${t.amount}|${t.description}|${index}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${t.date.replace(/-/g, '')}${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/** OFX 1.0.2 (SGML) — accepted by QuickBooks Online, Xero, Wave, Quicken, GnuCash and most banks' importers. */
export function toOFX(txns: Transaction[], meta: ExportMeta): string {
  const dated = txns.filter((t) => t.date);
  const dates = dated.map((t) => t.date).sort();
  const start = dates[0] ?? new Date().toISOString().slice(0, 10);
  const end = dates[dates.length - 1] ?? start;
  const isCard = meta.accountType === 'CREDITLINE';
  const lastBal = [...dated].reverse().find((t) => t.balance !== null)?.balance;
  const body = dated
    .map(
      (t, i) => `<STMTTRN>
<TRNTYPE>${t.amount < 0 ? 'DEBIT' : 'CREDIT'}
<DTPOSTED>${ofxDate(t.date)}
<TRNAMT>${fmt(t.amount)}
<FITID>${fitid(t, i)}
<NAME>${xmlEscape(t.description.slice(0, 32) || 'Transaction')}
<MEMO>${xmlEscape([t.description, t.reference].filter(Boolean).join(' ').slice(0, 255))}
</STMTTRN>`,
    )
    .join('\n');
  const tranList = `<BANKTRANLIST>
<DTSTART>${ofxDate(start)}
<DTEND>${ofxDate(end)}
${body}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${fmt(lastBal ?? 0)}
<DTASOF>${ofxDate(end)}
</LEDGERBAL>`;
  const cur = meta.currency ?? 'USD';
  const rs = isCard
    ? `<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<TRNUID>1
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<CCSTMTRS>
<CURDEF>${cur}
<CCACCTFROM><ACCTID>STATEMENT</CCACCTFROM>
${tranList}
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>`
    : `<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>${cur}
<BANKACCTFROM><BANKID>000000000<ACCTID>STATEMENT<ACCTTYPE>${meta.accountType ?? 'CHECKING'}</BANKACCTFROM>
${tranList}
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>`;
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<DTSERVER>${ofxDate(end)}
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
${rs}
</OFX>
`;
}

/** QIF — for Quicken, Moneydance, GnuCash, older desktop accounting tools. */
export function toQIF(txns: Transaction[], isCard = false): string {
  const out = [isCard ? '!Type:CCard' : '!Type:Bank'];
  for (const t of txns) {
    if (!t.date) continue;
    const [y, m, d] = t.date.split('-');
    out.push(`D${m}/${d}/${y}`, `T${fmt(t.amount)}`, `P${t.description.replace(/[\r\n]/g, ' ')}`);
    if (t.reference) out.push(`N${t.reference}`);
    out.push('^');
  }
  return out.join('\n') + '\n';
}

export async function toXLSX(txns: Transaction[]): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const aoa: Array<Array<string | number | null>> = [[...COLUMNS], ...txns.map(rowValues)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 48 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

export const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ofx: 'application/x-ofx',
  qif: 'application/qif',
};
