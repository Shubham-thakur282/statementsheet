import { useState } from 'react';
import type { Row } from './Converter';
import { money } from './Converter';

const PAGE = 200;

export function ResultTable({
  rows,
  setRows,
  currency,
  multiFile,
  fileNames,
}: {
  rows: Row[];
  setRows: (r: Row[]) => void;
  currency: string | null;
  multiFile: boolean;
  fileNames: string[];
}) {
  const [limit, setLimit] = useState(PAGE);
  const update = (id: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => setRows(rows.filter((r) => r.id !== id));
  const flipAll = () => setRows(rows.map((r) => ({ ...r, amount: -r.amount })));

  return (
    <div className="border-t border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-slate-600 sm:px-6">
        <span>Click any cell to fix it before downloading. Rows marked ⚠ don’t match the running balance.</span>
        <button onClick={flipAll} className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50">
          Flip all signs
        </button>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-0 sm:min-w-[640px] border-collapse text-sm" data-testid="results-table">
          <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="w-8 px-2 py-2 sm:pl-6"><span className="sr-only">Check</span></th>
              {multiFile && <th scope="col" className="px-2 py-2">File</th>}
              <th scope="col" className="px-2 py-2">Date</th>
              <th scope="col" className="px-2 py-2">Description</th>
              <th scope="col" className="px-2 py-2 text-right">Amount</th>
              <th scope="col" className="hidden px-2 py-2 text-right sm:table-cell">Balance</th>
              <th scope="col" className="w-10 px-2 py-2 sm:pr-6"><span className="sr-only">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 ${r.check === 'mismatch' ? 'bg-amber-50' : ''}`} data-check={r.check}>
                <td className="px-2 py-1 text-center sm:pl-6" title={CHECK_TITLE[r.check]}>
                  <span aria-label={CHECK_TITLE[r.check]}>{CHECK_ICON[r.check]}</span>
                </td>
                {multiFile && <td className="max-w-[8rem] truncate px-2 py-1 text-xs text-slate-500">{fileNames[r.file]}</td>}
                <td className="px-1 py-1">
                  <input
                    aria-label="Date"
                    type="date"
                    value={r.date}
                    onChange={(e) => update(r.id, { date: e.target.value })}
                    className={`w-[7.5rem] sm:w-[8.5rem] rounded border px-1 py-0.5 ${r.date ? 'border-transparent hover:border-slate-300' : 'border-red-400 bg-red-50'} focus:border-emerald-500 focus:outline-none`}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    aria-label="Description"
                    value={r.description}
                    onChange={(e) => update(r.id, { description: e.target.value })}
                    className="w-full min-w-[7rem] sm:min-w-[12rem] rounded border border-transparent px-1 py-0.5 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
                  />
                  {r.reference && <div className="px-1 text-xs text-slate-500">Ref {r.reference}</div>}
                </td>
                <td className="px-1 py-1 text-right">
                  <input
                    aria-label="Amount"
                    type="number"
                    step="0.01"
                    value={r.amount}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) update(r.id, { amount: v });
                    }}
                    className={`w-20 sm:w-28 rounded border border-transparent px-1 py-0.5 text-right tabular-nums hover:border-slate-300 focus:border-emerald-500 focus:outline-none ${r.amount < 0 ? 'text-rose-700' : 'text-emerald-700'}`}
                  />
                </td>
                <td className="hidden px-2 py-1 text-right tabular-nums text-slate-700 sm:table-cell">{r.balance === null ? '' : money(r.balance, currency)}</td>
                <td className="px-2 py-1 text-center sm:pr-6">
                  <button onClick={() => remove(r.id)} aria-label={`Delete row ${r.description}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > limit && (
          <div className="p-3 text-center">
            <button onClick={() => setLimit(limit + PAGE * 5)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              Show more rows ({rows.length - limit} hidden. All rows are included in downloads.)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const CHECK_ICON = { ok: '✓', fixed: '↺', mismatch: '⚠', unchecked: '·' } as const;
const CHECK_TITLE = {
  ok: 'Matches the running balance',
  fixed: 'Sign auto-corrected using the running balance',
  mismatch: 'Does not match the running balance. Please check this row.',
  unchecked: 'No balance to check against',
} as const;
