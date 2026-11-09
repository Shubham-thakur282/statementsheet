import { useEffect, useSyncExternalStore } from 'react';
import { config } from '../config';
import {
  deactivateLicense,
  isLicenseActive,
  loadLicense,
  REVALIDATE_MS,
  safeStorage,
  saveLicense,
  verifyLicense,
  type FetchLike,
  type StoredLicense,
} from '../lib/plan';

const store = safeStorage();
let current: StoredLicense | null = loadLicense(store);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(l: StoredLicense | null) {
  current = l;
  saveLicense(store, l);
  emit();
}

const fetcher: FetchLike = (url, init) => fetch(url, init);

export async function activate(key: string): Promise<string | null> {
  const name = `StatementSheet ${navigator.platform || 'browser'} ${new Date().toISOString().slice(0, 10)}`;
  const r = await verifyLicense(key, config.license, fetcher, null, name);
  if (!r.ok) return r.error;
  set(r.license);
  return null;
}

export async function deactivate(): Promise<void> {
  if (current) await deactivateLicense(current, fetcher);
  set(null);
}

let revalidating = false;
async function revalidateIfStale() {
  const l = current;
  if (!l || revalidating || Date.now() - l.validatedAt < REVALIDATE_MS) return;
  revalidating = true;
  try {
    const r = await verifyLicense(l.key, config.license, fetcher, l.instanceId);
    if (r.ok) set(r.license);
    else if (!/reach the license server|server error/.test(r.error)) set({ ...l, status: 'invalid' });
    // Network errors keep the cached license within the offline grace period.
  } finally {
    revalidating = false;
  }
}

export function useLicense() {
  const l = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  useEffect(() => {
    void revalidateIfStale();
  }, []);
  return { license: l, isPro: isLicenseActive(l) };
}

export const usageStore = store;
