import type { ColumnRole, HeaderCell, Line, PageText, Word } from './types';


/** Split pdf.js text items into words, estimating each word's x-position proportionally. */
export function itemsToWords(items: PageText['items']): Word[] {
  const words: Word[] = [];
  for (const it of items) {
    const str = it.str;
    if (!str || !str.trim()) continue;
    const len = str.length;
    const charW = len > 0 ? it.w / len : 0;
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(str))) {
      const x = it.x + m.index * charW;
      words.push({ text: m[0], x, right: x + m[0].length * charW, y: it.y, h: it.h || 8 });
    }
  }
  return words;
}

/** Group words into visual lines (same baseline within tolerance), ordered top-to-bottom, left-to-right. */
export function buildLines(pages: PageText[]): Line[] {
  const lines: Line[] = [];
  for (const p of pages) {
    const words = itemsToWords(p.items).sort((a, b) => b.y - a.y || a.x - b.x);
    let current: Word[] = [];
    let cy = Number.NaN;
    let ch = 8;
    const flush = () => {
      if (!current.length) return;
      current.sort((a, b) => a.x - b.x);
      lines.push({ page: p.page, y: cy, h: ch, words: current, text: current.map((w) => w.text).join(' ') });
      current = [];
    };
    for (const w of words) {
      const tol = Math.max(2, Math.min(w.h, ch) * 0.45);
      if (current.length && Math.abs(w.y - cy) <= tol) {
        current.push(w);
      } else {
        flush();
        current = [w];
        cy = w.y;
        ch = w.h;
      }
    }
    flush();
  }
  return lines;
}

/** Merge adjacent words into cells separated by visible gaps. */
export function wordsToCells(words: Word[]): Word[] {
  const cells: Word[] = [];
  for (const w of words) {
    const last = cells[cells.length - 1];
    const gap = last ? w.x - last.right : Infinity;
    if (last && gap < Math.max(2.5, w.h * 0.55)) {
      last.text += ' ' + w.text;
      last.right = w.right;
    } else {
      cells.push({ ...w });
    }
  }
  return cells;
}

const HEADER_AMOUNT_RE = /balance|withdraw|debit|deposit|credit|amount|amt|paid (?:in|out)|money (?:in|out)/i;

export function roleForLabel(label: string, seenDate: boolean): ColumnRole {
  const l = label.toLowerCase();
  if (/value\s*d(?:a)?te?|value\s*dt|post(?:ing|ed)?\s*date/.test(l)) return 'vdate';
  if (/\bdate\b|^dt\.?$|txn\s*dt|tran\s*dt/.test(l)) return seenDate ? 'vdate' : 'date';
  if (/balance|\bbal\b/.test(l)) return 'balance';
  if (/withdraw|debit|paid out|money out|^dr\.?$|\bdr\b/.test(l)) return 'debit';
  if (/deposit|credit|paid in|money in|^cr\.?$|\bcr\b|receipt/.test(l)) return 'credit';
  if (/amount|\bamt\b/.test(l)) return 'amount';
  if (/chq|cheque|check\s*(?:no|#)|ref|instrument/.test(l)) return 'ref';
  if (/desc|narration|particular|detail|transaction|payee|memo|remark/.test(l)) return 'desc';
  return 'other';
}

/** Detect a table header line such as "Date | Description | Withdrawals | Deposits | Balance". */
export function detectHeader(line: Line): HeaderCell[] | null {
  const t = line.text;
  if (t.length > 220 || !/date|\bdt\b/i.test(t)) return null;
  const amountHits = t.match(new RegExp(HEADER_AMOUNT_RE.source, 'gi'));
  if (!amountHits || amountHits.length < 1) return null;
  const rawCells = wordsToCells(line.words);
  // Units/qualifiers like "(GBP)" or "(₹)" belong to the label before them.
  const cells: Word[] = [];
  for (const c of rawCells) {
    const prev = cells[cells.length - 1];
    if (prev && /^\(.*\)$|^(?:in\s+)?(?:gbp|usd|inr|eur|aud|cad|rs\.?|[$₹£€])$/i.test(c.text) && c.x - prev.right < c.h * 2) {
      prev.text += ' ' + c.text;
      prev.right = c.right;
    } else cells.push({ ...c });
  }
  if (cells.length < 3) return null;
  let seenDate = false;
  const out: HeaderCell[] = cells.map((c) => {
    const role = roleForLabel(c.text, seenDate);
    if (role === 'date') seenDate = true;
    return { role, label: c.text, x: c.x, right: c.right };
  });
  const roles = new Set(out.map((c) => c.role));
  const hasDate = roles.has('date');
  const moneyCols = out.filter((c) => ['debit', 'credit', 'amount', 'balance'].includes(c.role)).length;
  if (!hasDate || moneyCols < 1) return null;
  // Real headers are mostly recognised labels; prose that happens to say "date" and "balance" is not.
  const known = out.filter((c) => c.role !== 'other').length;
  if (known < 3 || known < out.length / 2) return null;
  // A description column is implied when not labelled: treat the first 'other' after the date as description.
  if (!roles.has('desc')) {
    const firstOther = out.findIndex((c, i) => i > 0 && c.role === 'other');
    if (firstOther > 0) out[firstOther].role = 'desc';
  }
  return out;
}

/** Find the header cell a token belongs to: best horizontal overlap, else nearest edge/centre. */
export function nearestCell(header: HeaderCell[], x: number, right: number): { cell: HeaderCell; dist: number } {
  let best: HeaderCell = header[0];
  let bestScore = -Infinity;
  let bestDist = Infinity;
  for (const c of header) {
    const overlap = Math.min(right, c.right) - Math.max(x, c.x);
    const dist = Math.min(Math.abs(right - c.right), Math.abs((x + right) / 2 - (c.x + c.right) / 2), Math.abs(x - c.x));
    const score = overlap > 0 ? 1000 + overlap : -dist;
    if (score > bestScore) {
      bestScore = score;
      best = c;
      bestDist = overlap > 0 ? 0 : dist;
    }
  }
  return { cell: best, dist: bestDist };
}

/** Column of a left-aligned text token: the last header cell starting at or before it. */
export function cellByStart(header: HeaderCell[], x: number): HeaderCell {
  const sorted = [...header].sort((a, b) => a.x - b.x);
  let found = sorted[0];
  for (const c of sorted) if (c.x - 4 <= x) found = c;
  return found;
}
