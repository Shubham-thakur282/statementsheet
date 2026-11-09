import { describe, expect, it, vi } from 'vitest';
import {
  canConvert,
  canExport,
  FREE_LIMITS,
  GRACE_MS,
  isLicenseActive,
  licenseConfigFromEnv,
  loadLicense,
  recordConversion,
  saveLicense,
  usedToday,
  verifyLicense,
  type FetchLike,
  type StorageLike,
  type StoredLicense,
} from '../../src/lib/plan';
import { safeCheckoutUrl } from '../../src/config';

const mem = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const KEY = '38b1460a-5104-4067-a91d-77b872934d51';
const cfg = { storeId: 111, productIds: [222] };

const respond = (body: unknown, status = 200): FetchLike => vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));

describe('free tier metering', () => {
  it('counts per day and resets the next day', () => {
    const s = mem();
    const d1 = new Date('2026-11-09T10:00:00Z');
    for (let i = 0; i < FREE_LIMITS.conversionsPerDay; i++) expect(canConvert(false, 1, s, d1).ok).toBe(true), recordConversion(s, d1);
    expect(canConvert(false, 1, s, d1)).toEqual({ ok: false, reason: 'daily-limit' });
    expect(canConvert(true, 500, s, d1).ok).toBe(true);
    expect(usedToday(s, new Date('2026-11-10T10:00:00Z'))).toBe(0);
  });
  it('limits pages per file on free', () => {
    expect(canConvert(false, FREE_LIMITS.pagesPerFile + 1, mem())).toEqual({ ok: false, reason: 'page-limit' });
  });
  it('tolerates corrupted storage', () => {
    const s = mem();
    s.setItem('ss_usage_v1', '{not json');
    expect(usedToday(s)).toBe(0);
  });
  it('gates formats', () => {
    expect(canExport(false, 'csv').ok).toBe(true);
    expect(canExport(false, 'xlsx').ok).toBe(false);
    expect(canExport(true, 'ofx').ok).toBe(true);
  });
});

describe('license verification (Lemon Squeezy)', () => {
  const okActivate = { activated: true, error: null, license_key: { status: 'active', expires_at: null }, instance: { id: 'inst-1' }, meta: { store_id: 111, product_id: 222, customer_email: 'a@b.co' } };

  it('activates a valid key for our store and product', async () => {
    const f = respond(okActivate);
    const r = await verifyLicense(KEY, cfg, f);
    expect(r).toMatchObject({ ok: true, license: { key: KEY, instanceId: 'inst-1', status: 'active', email: 'a@b.co' } });
    const [url, init] = (f as unknown as { mock: { calls: [string, { body: string; headers: Record<string, string> }][] } }).mock.calls[0];
    expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/activate');
    expect(init.body).toContain(`license_key=${KEY}`);
    expect(init.headers.Accept).toBe('application/json');
  });
  it('validates with the stored instance id', async () => {
    const f = respond({ ...okActivate, activated: undefined, valid: true });
    const r = await verifyLicense(KEY, cfg, f, 'inst-1');
    expect(r.ok).toBe(true);
    expect((f as unknown as { mock: { calls: [string][] } }).mock.calls[0][0]).toMatch(/validate$/);
  });
  it('rejects keys from another store (cross-store key reuse)', async () => {
    const r = await verifyLicense(KEY, cfg, respond({ ...okActivate, meta: { store_id: 999, product_id: 222 } }));
    expect(r).toEqual({ ok: false, error: 'This license key is for a different product.' });
  });
  it('rejects keys for another product in our store', async () => {
    const r = await verifyLicense(KEY, cfg, respond({ ...okActivate, meta: { store_id: 111, product_id: 5 } }));
    expect(r.ok).toBe(false);
  });
  it('rejects expired/disabled licenses', async () => {
    const r = await verifyLicense(KEY, cfg, respond({ ...okActivate, license_key: { status: 'expired' } }));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
  });
  it('surfaces API errors', async () => {
    const r = await verifyLicense(KEY, cfg, respond({ activated: false, error: 'license_key not found.' }, 404));
    expect(r).toEqual({ ok: false, error: 'license_key not found.' });
  });
  it('explains activation limit', async () => {
    const r = await verifyLicense(KEY, cfg, respond({ activated: false, error: 'This license key has reached the activation limit.' }, 400));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/device limit/) });
  });
  it('handles network failures', async () => {
    const r = await verifyLicense(KEY, cfg, async () => {
      throw new Error('offline');
    });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/reach the license server/) });
  });
  it('rejects malformed input without calling the API', async () => {
    const f = respond(okActivate);
    expect((await verifyLicense('<script>', cfg, f)).ok).toBe(false);
    expect((await verifyLicense('', cfg, f)).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('refuses when licensing is not configured', async () => {
    expect(await verifyLicense(KEY, { storeId: null, productIds: [] }, respond(okActivate))).toMatchObject({ ok: false });
  });
});

describe('license state', () => {
  const lic = (p: Partial<StoredLicense> = {}): StoredLicense => ({ key: KEY, instanceId: 'i', validatedAt: Date.now(), status: 'active', expiresAt: null, email: null, ...p });
  it('is active within grace and inactive after', () => {
    expect(isLicenseActive(lic())).toBe(true);
    expect(isLicenseActive(lic({ validatedAt: Date.now() - GRACE_MS - 1 }))).toBe(false);
    expect(isLicenseActive(lic({ status: 'invalid' }))).toBe(false);
    expect(isLicenseActive(lic({ expiresAt: '2000-01-01T00:00:00Z' }))).toBe(false);
    expect(isLicenseActive(null)).toBe(false);
  });
  it('round-trips through storage and ignores tampered entries', () => {
    const s = mem();
    saveLicense(s, lic());
    expect(loadLicense(s)?.key).toBe(KEY);
    s.setItem('ss_license_v1', JSON.stringify({ key: '<img onerror=x>' }));
    expect(loadLicense(s)).toBeNull();
    saveLicense(s, null);
    expect(loadLicense(s)).toBeNull();
  });
  it('parses env config', () => {
    expect(licenseConfigFromEnv({ VITE_LS_STORE_ID: '42', VITE_LS_PRODUCT_IDS: '1, 2,x' })).toEqual({ storeId: 42, productIds: [1, 2] });
    expect(licenseConfigFromEnv({})).toEqual({ storeId: null, productIds: [] });
  });
});

describe('checkout url safety', () => {
  it('only allows https lemonsqueezy.com links', () => {
    expect(safeCheckoutUrl('https://shop.lemonsqueezy.com/buy/abc')).toBe('https://shop.lemonsqueezy.com/buy/abc');
    expect(safeCheckoutUrl('https://shop.lemonsqueezy.com/buy/abc', 'a@b.co')).toContain('checkout%5Bemail%5D=a%40b.co');
    expect(safeCheckoutUrl('http://shop.lemonsqueezy.com/buy/abc')).toBeNull();
    expect(safeCheckoutUrl('https://evil.com/lemonsqueezy.com')).toBeNull();
    expect(safeCheckoutUrl('https://lemonsqueezy.com.evil.com/x')).toBeNull();
    expect(safeCheckoutUrl('javascript:alert(1)')).toBeNull();
  });
});
