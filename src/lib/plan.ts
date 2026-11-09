/**
 * Plans, free-tier limits and license handling.
 *
 * Licenses are Lemon Squeezy license keys (emailed automatically on purchase; subscription keys
 * expire automatically when a subscription lapses). Validation happens directly against the
 * public Lemon Squeezy License API, which needs no secret and allows CORS, so the product has no
 * server and never sees users' files.
 */

export const FREE_LIMITS = {
  conversionsPerDay: 3,
  pagesPerFile: 10,
  formats: ['csv'] as const,
};

export const PRICING = {
  monthly: { price: 9, label: '$9 / month' },
  yearly: { price: 69, label: '$69 / year', saving: '36%' },
};

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const memory = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

export function safeStorage(): StorageLike {
  try {
    const s = globalThis.localStorage;
    const probe = '__ss_probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return memoryStorage;
  }
}

// ---------------- usage metering (free tier) ----------------

const USAGE_KEY = 'ss_usage_v1';

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function usedToday(store: StorageLike, now = new Date()): number {
  try {
    const raw = JSON.parse(store.getItem(USAGE_KEY) ?? 'null') as { day: string; count: number } | null;
    return raw && raw.day === todayKey(now) && Number.isFinite(raw.count) ? raw.count : 0;
  } catch {
    return 0;
  }
}

export function recordConversion(store: StorageLike, now = new Date()): number {
  const count = usedToday(store, now) + 1;
  store.setItem(USAGE_KEY, JSON.stringify({ day: todayKey(now), count }));
  return count;
}

export type Gate = { ok: true } | { ok: false; reason: 'daily-limit' | 'page-limit' | 'format' };

export function canConvert(isPro: boolean, pages: number, store: StorageLike, now = new Date()): Gate {
  if (isPro) return { ok: true };
  if (pages > FREE_LIMITS.pagesPerFile) return { ok: false, reason: 'page-limit' };
  if (usedToday(store, now) >= FREE_LIMITS.conversionsPerDay) return { ok: false, reason: 'daily-limit' };
  return { ok: true };
}

export function canExport(isPro: boolean, format: string): Gate {
  if (isPro || (FREE_LIMITS.formats as readonly string[]).includes(format)) return { ok: true };
  return { ok: false, reason: 'format' };
}

// ---------------- licensing ----------------

export interface LicenseConfig {
  storeId: number | null;
  productIds: number[];
}

export function licenseConfigFromEnv(env: Record<string, string | undefined>): LicenseConfig {
  const storeId = env.VITE_LS_STORE_ID ? parseInt(env.VITE_LS_STORE_ID, 10) : null;
  const productIds = (env.VITE_LS_PRODUCT_IDS ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  return { storeId: Number.isFinite(storeId) ? storeId : null, productIds };
}

export interface StoredLicense {
  key: string;
  instanceId: string | null;
  validatedAt: number;
  status: string;
  expiresAt: string | null;
  email: string | null;
}

const LICENSE_KEY = 'ss_license_v1';
/** Re-check with Lemon Squeezy at most once a day; allow 7 days offline grace. */
export const REVALIDATE_MS = 24 * 3600 * 1000;
export const GRACE_MS = 7 * 24 * 3600 * 1000;

export const LICENSE_KEY_RE = /^[A-Za-z0-9-]{16,64}$/;

export function loadLicense(store: StorageLike): StoredLicense | null {
  try {
    const l = JSON.parse(store.getItem(LICENSE_KEY) ?? 'null') as StoredLicense | null;
    return l && typeof l.key === 'string' && LICENSE_KEY_RE.test(l.key) ? l : null;
  } catch {
    return null;
  }
}

export function saveLicense(store: StorageLike, l: StoredLicense | null) {
  if (l) store.setItem(LICENSE_KEY, JSON.stringify(l));
  else store.removeItem(LICENSE_KEY);
}

export function isLicenseActive(l: StoredLicense | null, now = Date.now()): boolean {
  if (!l) return false;
  if (l.status !== 'active') return false;
  if (l.expiresAt && Date.parse(l.expiresAt) < now) return false;
  return now - l.validatedAt < GRACE_MS;
}

interface LsResponse {
  valid?: boolean;
  activated?: boolean;
  error?: string | null;
  license_key?: { status?: string; expires_at?: string | null };
  instance?: { id?: string } | null;
  meta?: { store_id?: number; product_id?: number; customer_email?: string };
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const LS_API = 'https://api.lemonsqueezy.com/v1/licenses';

/**
 * Activate (first time) or validate a key against Lemon Squeezy and make sure it belongs to OUR
 * store/product — otherwise any Lemon Squeezy key from any store would unlock Pro.
 */
export async function verifyLicense(
  key: string,
  cfg: LicenseConfig,
  fetcher: FetchLike,
  existingInstance: string | null = null,
  instanceName = 'browser',
): Promise<{ ok: true; license: StoredLicense } | { ok: false; error: string }> {
  const k = key.trim();
  if (!LICENSE_KEY_RE.test(k)) return { ok: false, error: 'That doesn’t look like a license key. Copy it from your purchase email.' };
  if (cfg.storeId === null) return { ok: false, error: 'Licensing is not configured on this site yet.' };

  const action = existingInstance ? 'validate' : 'activate';
  const params = new URLSearchParams({ license_key: k });
  if (existingInstance) params.set('instance_id', existingInstance);
  else params.set('instance_name', instanceName.slice(0, 60));

  let data: LsResponse;
  try {
    const res = await fetcher(`${LS_API}/${action}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    data = (await res.json()) as LsResponse;
    if (!res.ok && !data?.error) return { ok: false, error: `License server error (${res.status}). Please try again.` };
  } catch {
    return { ok: false, error: 'Could not reach the license server. Check your connection and try again.' };
  }

  const good = action === 'activate' ? data.activated === true : data.valid === true;
  if (!good) {
    const msg = data.error ?? 'This license key is not valid.';
    return { ok: false, error: /activation limit/i.test(msg) ? 'This key has reached its device limit. Deactivate it on another browser first, or contact support.' : msg };
  }
  if (data.meta?.store_id !== cfg.storeId || (cfg.productIds.length > 0 && !cfg.productIds.includes(data.meta?.product_id ?? -1))) {
    return { ok: false, error: 'This license key is for a different product.' };
  }
  const status = data.license_key?.status ?? 'inactive';
  if (status !== 'active') return { ok: false, error: `This license is ${status}. Renew your subscription to keep using Pro.` };
  return {
    ok: true,
    license: {
      key: k,
      instanceId: data.instance?.id ?? existingInstance,
      validatedAt: Date.now(),
      status,
      expiresAt: data.license_key?.expires_at ?? null,
      email: data.meta?.customer_email ?? null,
    },
  };
}

export async function deactivateLicense(l: StoredLicense, fetcher: FetchLike): Promise<boolean> {
  if (!l.instanceId) return true;
  try {
    const res = await fetcher(`${LS_API}/deactivate`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ license_key: l.key, instance_id: l.instanceId }).toString(),
    });
    const d = (await res.json()) as { deactivated?: boolean };
    return d.deactivated === true;
  } catch {
    return false;
  }
}
