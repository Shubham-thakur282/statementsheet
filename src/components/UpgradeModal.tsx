import { useEffect, useRef, useState } from 'react';
import { checkoutConfigured, config, safeCheckoutUrl } from '../config';
import { FREE_LIMITS, PRICING } from '../lib/plan';
import { track } from '../lib/analytics';
import { activate, deactivate, useLicense } from '../state/license';

export type UpgradeReason = 'daily-limit' | 'page-limit' | 'format' | 'batch' | 'manual' | 'manage';

const REASON_TEXT: Record<UpgradeReason, string> = {
  'daily-limit': `You've used today's ${FREE_LIMITS.conversionsPerDay} free conversions.`,
  'page-limit': `Free conversions are limited to ${FREE_LIMITS.pagesPerFile} pages per statement.`,
  format: 'Excel, OFX (QuickBooks / Xero) and QIF exports are part of Pro.',
  batch: 'Converting several statements at once is part of Pro.',
  manual: 'Unlock every format and unlimited statements.',
  manage: '',
};

export function openUpgrade(reason: UpgradeReason) {
  window.dispatchEvent(new CustomEvent<UpgradeReason>('ss:upgrade', { detail: reason }));
}

export function UpgradeModalHost() {
  const [reason, setReason] = useState<UpgradeReason | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      const r = (e as CustomEvent<UpgradeReason>).detail;
      setReason(r);
      track(`upgrade-open-${r}`);
    };
    window.addEventListener('ss:upgrade', h);
    return () => window.removeEventListener('ss:upgrade', h);
  }, []);
  if (!reason) return null;
  return <UpgradeModal reason={reason} onClose={() => setReason(null)} />;
}

function UpgradeModal({ reason, onClose }: { reason: UpgradeReason; onClose: () => void }) {
  const { license, isPro } = useLicense();
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('input,button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="upgrade-title" className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="upgrade-title" className="text-xl font-semibold text-slate-900">
            {isPro ? 'Your Pro license' : 'Upgrade to StatementSheet Pro'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close">
            ✕
          </button>
        </div>
        {isPro && license ? (
          <ManageLicense email={license.email} expiresAt={license.expiresAt} onDone={onClose} />
        ) : (
          <>
            {REASON_TEXT[reason] && <p className="mt-2 text-slate-600">{REASON_TEXT[reason]}</p>}
            <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
              {['Unlimited statements and pages', 'Excel (.xlsx), OFX for QuickBooks / Xero / Wave, and QIF', 'Convert many statements at once into one file', 'Still 100% on your device: files never leave your browser'].map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-emerald-600" aria-hidden>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Plans />
            <LicenseForm onActivated={onClose} />
          </>
        )}
      </div>
    </div>
  );
}

function Plans() {
  if (!checkoutConfigured()) {
    return (
      <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Online checkout is being set up and will open shortly. Already have a license key? Enter it below.
      </p>
    );
  }
  const plans = [
    { id: 'yearly', url: config.checkout.yearly, title: 'Yearly', price: PRICING.yearly.label, note: `Save ${PRICING.yearly.saving}` },
    { id: 'monthly', url: config.checkout.monthly, title: 'Monthly', price: PRICING.monthly.label, note: 'Cancel anytime' },
  ].filter((p) => safeCheckoutUrl(p.url));
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {plans.map((p) => (
        <a
          key={p.id}
          href={safeCheckoutUrl(p.url) ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(`checkout-${p.id}`)}
          className="rounded-xl border-2 border-slate-200 p-4 text-center transition hover:border-emerald-500 focus-visible:border-emerald-500"
        >
          <div className="text-sm font-medium text-slate-500">{p.title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{p.price}</div>
          <div className="mt-1 text-xs text-emerald-700">{p.note}</div>
          <div className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Buy {p.title.toLowerCase()}</div>
        </a>
      ))}
      <p className="sm:col-span-2 text-xs text-slate-500">
        Secure checkout by Lemon Squeezy (merchant of record, handles tax and invoices). Your license key arrives by email instantly.
      </p>
    </div>
  );
}

export function LicenseForm({ onActivated }: { onActivated?: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-6 border-t border-slate-200 pt-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const err = await activate(key);
        setBusy(false);
        if (err) setError(err);
        else {
          track('license-activated');
          onActivated?.();
        }
      }}
    >
      <label htmlFor="license-key" className="block text-sm font-medium text-slate-800">
        Have a license key?
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="license-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'license-error' : undefined}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        <button disabled={busy || !key.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Checking…' : 'Activate'}
        </button>
      </div>
      {error && (
        <p id="license-error" role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

function ManageLicense({ email, expiresAt, onDone }: { email: string | null; expiresAt: string | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 space-y-3 text-sm text-slate-700">
      <p>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">● Pro active</span>
      </p>
      {email && <p>Licensed to {email}</p>}
      {expiresAt && <p>Renews / expires: {new Date(expiresAt).toLocaleDateString()}</p>}
      <div className="flex flex-wrap gap-2 pt-2">
        <a href={config.billingPortal} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50">
          Manage billing
        </a>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await deactivate();
            setBusy(false);
            onDone();
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? 'Removing…' : 'Remove license from this browser'}
        </button>
      </div>
    </div>
  );
}

export function AccountBadge() {
  const { isPro } = useLicense();
  return isPro ? (
    <button onClick={() => openUpgrade('manage')} className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
      Pro ✓
    </button>
  ) : (
    <button onClick={() => openUpgrade('manual')} className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">
      Go Pro
    </button>
  );
}
