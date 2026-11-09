import { licenseConfigFromEnv } from './lib/plan';

const env = import.meta.env as Record<string, string | undefined>;

export const config = {
  license: licenseConfigFromEnv(env),
  checkout: {
    monthly: env.VITE_LS_CHECKOUT_MONTHLY || '',
    yearly: env.VITE_LS_CHECKOUT_YEARLY || '',
  },
  /** Lemon Squeezy customer portal (manage/cancel subscription). */
  billingPortal: env.VITE_LS_PORTAL_URL || 'https://app.lemonsqueezy.com/my-orders',
  supportUrl: env.VITE_SUPPORT_URL || 'https://github.com/Shubham-thakur282/statementsheet/issues',
};

export const checkoutConfigured = () => Boolean(config.checkout.monthly || config.checkout.yearly);

/** Only allow https links to Lemon Squeezy for checkout, to avoid open-redirect style misconfiguration. */
export function safeCheckoutUrl(url: string, email?: string | null): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !/(^|\.)lemonsqueezy\.com$/.test(u.hostname)) return null;
    if (email) u.searchParams.set('checkout[email]', email);
    return u.toString();
  } catch {
    return null;
  }
}
