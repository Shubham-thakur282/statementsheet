/** A positioned run of text from a PDF page (PDF user-space units, origin bottom-left). */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageText {
  page: number;
  items: TextItem[];
}

/** One whitespace-free word with an estimated position. */
export interface Word {
  text: string;
  x: number;
  right: number;
  y: number;
  h: number;
}

export interface Line {
  page: number;
  y: number;
  h: number;
  words: Word[];
  text: string;
}

export type ColumnRole =
  | 'date'
  | 'vdate'
  | 'desc'
  | 'ref'
  | 'debit'
  | 'credit'
  | 'amount'
  | 'balance'
  | 'other';

export interface HeaderCell {
  role: ColumnRole;
  label: string;
  x: number;
  right: number;
}

export type DateOrder = 'DMY' | 'MDY';

export type CheckStatus = 'ok' | 'fixed' | 'mismatch' | 'unchecked';

export interface Transaction {
  id: string;
  /** ISO yyyy-mm-dd, or '' if the date could not be resolved. */
  date: string;
  description: string;
  reference: string;
  /** Signed amount: negative = money out, positive = money in. */
  amount: number;
  balance: number | null;
  page: number;
  check: CheckStatus;
}

export interface ParseResult {
  transactions: Transaction[];
  dateOrder: DateOrder;
  kind: 'bank' | 'card';
  currency: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  pages: number;
  warnings: string[];
  /** Fraction of transactions whose running balance reconciled (null when there is no balance column). */
  reconciled: number | null;
}
