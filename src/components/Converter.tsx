import { useCallback, useMemo, useRef, useState } from 'react';
import { parseStatement } from '../lib/parse/statement';
import type { DateOrder, PageText, ParseResult, Transaction } from '../lib/parse/types';
import { PasswordRequiredError, readPdf } from '../lib/pdf/load';
import { canConvert, canExport, FREE_LIMITS, recordConversion, usedToday } from '../lib/plan';
import { MIME, toCSV, toOFX, toQIF, toXLSX, type ExportFormat } from '../lib/export/formats';
import { baseName, downloadBlob } from '../lib/download';
import { track } from '../lib/analytics';
import { useLicense, usageStore } from '../state/license';
import { openUpgrade } from './UpgradeModal';
import { ResultTable } from './ResultTable';

interface Doc {
  name: string;
  pages: PageText[];
  result: ParseResult;
  dateOrder?: DateOrder;
  kind?: 'bank' | 'card';
}
export interface Row extends Transaction {
  file: number;
}

type Phase =
  | { t: 'idle' }
  | { t: 'working'; msg: string }
  | { t: 'password'; file: File; incorrect: boolean; queue: File[] }
  | { t: 'error'; msg: string };

export const money = (n: number, cur: string | null) => {
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  try {
    return cur ? new Intl.NumberFormat(undefined, { ...opts, style: 'currency', currency: cur }).format(n) : new Intl.NumberFormat(undefined, opts).format(n);
  } catch {
    return n.toFixed(2);
  }
};

export function Converter() {
  const { isPro } = useLicense();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [password, setPassword] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const rebuildRows = (ds: Doc[]) => setRows(ds.flatMap((d, fi) => d.result.transactions.map((t) => ({ ...t, id: `${fi}-${t.id}`, file: fi }))));

  const processFiles = useCallback(
    async (files: File[], pw?: string) => {
      const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      if (!pdfs.length) {
        setPhase({ t: 'error', msg: 'Please choose a PDF bank or credit card statement.' });
        return;
      }
      let queue = pdfs;
      if (!isPro && (pdfs.length > 1 || docs.length > 0)) {
        openUpgrade('batch');
        if (docs.length > 0) return;
        queue = pdfs.slice(0, 1);
      }
      const added: Doc[] = [];
      for (let i = 0; i < queue.length; i++) {
        const file = queue[i];
        try {
          const gate0 = canConvert(isPro, 0, usageStore);
          if (!gate0.ok) {
            openUpgrade(gate0.reason);
            break;
          }
          setPhase({ t: 'working', msg: `Reading ${file.name}…` });
          const loaded = await readPdf(file, {
            password: i === 0 ? pw : undefined,
            maxPages: isPro ? undefined : FREE_LIMITS.pagesPerFile,
            onProgress: (d, n) => setPhase({ t: 'working', msg: `Reading ${file.name}: page ${d} of ${n}` }),
          });
          const gate = canConvert(isPro, loaded.numPages, usageStore);
          if (!gate.ok) {
            openUpgrade(gate.reason);
            break;
          }
          const result = parseStatement(loaded.pages);
          added.push({ name: file.name, pages: loaded.pages, result });
          if (result.transactions.length) recordConversion(usageStore);
          track(result.transactions.length ? 'convert-ok' : 'convert-empty');
        } catch (e) {
          if (e instanceof PasswordRequiredError) {
            setPhase({ t: 'password', file, incorrect: e.incorrect, queue: queue.slice(i + 1) });
            if (added.length) {
              const next = [...docs, ...added];
              setDocs(next);
              rebuildRows(next);
            }
            return;
          }
          track('convert-error');
          setPhase({ t: 'error', msg: e instanceof Error ? `${file.name}: ${e.message}` : 'Something went wrong reading that file.' });
          return;
        }
      }
      const next = [...docs, ...added];
      setDocs(next);
      rebuildRows(next);
      setPhase({ t: 'idle' });
      setPassword('');
    },
    [docs, isPro],
  );

  const reparse = (fi: number, patch: Partial<Pick<Doc, 'dateOrder' | 'kind'>>) => {
    const next = docs.map((d, i) => {
      if (i !== fi) return d;
      const nd = { ...d, ...patch };
      nd.result = parseStatement(d.pages, { dateOrder: nd.dateOrder, kind: nd.kind });
      return nd;
    });
    setDocs(next);
    rebuildRows(next);
  };

  const reset = () => {
    setDocs([]);
    setRows([]);
    setPhase({ t: 'idle' });
    if (input.current) input.current.value = '';
  };

  const doExport = async (fmt: ExportFormat) => {
    const gate = canExport(isPro, fmt);
    if (!gate.ok) {
      openUpgrade('format');
      return;
    }
    const name = docs.length === 1 ? baseName(docs[0].name) : 'statements';
    const currency = docs[0]?.result.currency ?? null;
    const isCard = docs.every((d) => d.result.kind === 'card');
    track(`export-${fmt}`);
    if (fmt === 'csv') downloadBlob(toCSV(rows), `${name}.csv`, MIME.csv);
    else if (fmt === 'xlsx') downloadBlob(new Uint8Array(await toXLSX(rows)), `${name}.xlsx`, MIME.xlsx);
    else if (fmt === 'ofx') downloadBlob(toOFX(rows, { currency, accountType: isCard ? 'CREDITLINE' : 'CHECKING' }), `${name}.ofx`, MIME.ofx);
    else downloadBlob(toQIF(rows, isCard), `${name}.qif`, MIME.qif);
  };

  const totals = useMemo(() => {
    let inflow = 0;
    let out = 0;
    for (const r of rows) (r.amount >= 0 ? (inflow += r.amount) : (out += r.amount));
    return { inflow, out };
  }, [rows]);

  const currency = docs[0]?.result.currency ?? null;
  const checked = rows.filter((r) => r.check !== 'unchecked');
  const mismatched = rows.filter((r) => r.check === 'mismatch').length;
  const fixed = rows.filter((r) => r.check === 'fixed').length;
  const left = Math.max(0, FREE_LIMITS.conversionsPerDay - usedToday(usageStore));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void processFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Upload area */}
      <div className="p-4 sm:p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}
        >
          <svg aria-hidden className="h-10 w-10 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M9 13h6M9 17h6" />
          </svg>
          <p className="mt-3 font-semibold text-slate-900">{rows.length ? (isPro ? 'Add another statement' : 'Drop a statement PDF here') : 'Drop your bank statement PDF here'}</p>
          <p className="mt-1 text-sm text-slate-600">
            or{' '}
            <button type="button" onClick={() => input.current?.click()} className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900">
              choose a file
            </button>
            . It stays on your device.
          </p>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            aria-label="Choose bank statement PDF"
            data-testid="file-input"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (fs.length) void processFiles(fs);
            }}
          />
          {!isPro && <p className="mt-3 text-xs text-slate-500">Free: {left} of {FREE_LIMITS.conversionsPerDay} conversions left today · up to {FREE_LIMITS.pagesPerFile} pages · CSV</p>}
        </div>

        <div aria-live="polite" className="mt-3 min-h-[1.5rem] text-sm">
          {phase.t === 'working' && (
            <p className="flex items-center gap-2 text-slate-700">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-hidden />
              {phase.msg}
            </p>
          )}
          {phase.t === 'error' && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
              {phase.msg}
            </p>
          )}
        </div>

        {phase.t === 'password' && (
          <form
            className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const p = phase;
              void processFiles([p.file, ...p.queue], password);
            }}
          >
            <label htmlFor="pdf-password" className="block text-sm font-medium text-amber-950">
              {phase.incorrect ? 'Incorrect password. Try again.' : `“${phase.file.name}” is password-protected.`} Enter the PDF password (many banks use your date of birth or customer ID).
              The password is used only in your browser and is never stored.
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="pdf-password"
                type="password"
                autoComplete="off"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={!password}>
                Unlock
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Results */}
      {docs.length > 0 && (
        <div className="border-t border-slate-200">
          <div className="flex flex-col gap-3 p-4 sm:p-6">
            {docs.map((d, fi) => (
              <div key={fi} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="font-semibold text-slate-900 break-all">{d.name}</span>
                <span className="text-slate-600">
                  {d.result.transactions.length} transactions · {d.result.pages} page{d.result.pages === 1 ? '' : 's'}
                </span>
                <label className="flex items-center gap-1 text-slate-700">
                  Dates
                  <select value={d.result.dateOrder} onChange={(e) => reparse(fi, { dateOrder: e.target.value as DateOrder })} className="rounded border border-slate-300 px-1 py-0.5">
                    <option value="DMY">DD/MM</option>
                    <option value="MDY">MM/DD</option>
                  </select>
                </label>
                <label className="flex items-center gap-1 text-slate-700">
                  Type
                  <select value={d.result.kind} onChange={(e) => reparse(fi, { kind: e.target.value as 'bank' | 'card' })} className="rounded border border-slate-300 px-1 py-0.5">
                    <option value="bank">Bank account</option>
                    <option value="card">Credit card</option>
                  </select>
                </label>
                {d.result.warnings.map((w) => (
                  <p key={w} className="w-full rounded-lg bg-amber-50 p-2 text-amber-900" role="status">
                    {w}
                  </p>
                ))}
              </div>
            ))}

            {rows.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="summary">
                <Stat label="Transactions" value={String(rows.length)} />
                <Stat label="Money in" value={money(totals.inflow, currency)} tone="text-emerald-700" />
                <Stat label="Money out" value={money(-totals.out, currency)} tone="text-rose-700" />
                <Stat
                  label="Balance check"
                  value={checked.length ? (mismatched ? `${mismatched} to review` : '✓ All reconcile') : 'No balance column'}
                  tone={checked.length ? (mismatched ? 'text-amber-700' : 'text-emerald-700') : 'text-slate-600'}
                  hint={fixed ? `${fixed} sign${fixed > 1 ? 's' : ''} auto-corrected` : undefined}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Download:</span>
              {(['csv', 'xlsx', 'ofx', 'qif'] as ExportFormat[]).map((f) => {
                const locked = !canExport(isPro, f).ok;
                return (
                  <button
                    key={f}
                    disabled={!rows.length}
                    onClick={() => void doExport(f)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 ${f === 'csv' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-300 text-slate-800 hover:bg-slate-50'}`}
                  >
                    {{ csv: 'CSV', xlsx: 'Excel', ofx: 'OFX (QuickBooks/Xero)', qif: 'QIF' }[f]}
                    {locked && <span className="ml-1 text-xs font-normal text-slate-500">· Pro</span>}
                  </button>
                );
              })}
              <button onClick={reset} className="ml-auto rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Clear
              </button>
            </div>
          </div>
          {rows.length > 0 && <ResultTable rows={rows} setRows={setRows} currency={currency} multiFile={docs.length > 1} fileNames={docs.map((d) => d.name)} />}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'text-slate-900', hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 font-semibold ${tone}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
