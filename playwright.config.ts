import { defineConfig, devices } from '@playwright/test';

const PORT = 5299;
// E2E_SITE_BASE lets us rehearse the production sub-path (e.g. /statementsheet/ on GitHub Pages).
const BASE = process.env.E2E_SITE_BASE || '/';
// E2E runs against a production build configured with TEST Lemon Squeezy identifiers.
// The License API is mocked per-test with page.route — no real purchases or keys are used.
const env = [
  `SITE_BASE=${BASE}`,
  `SITE_URL=http://localhost:${PORT}${BASE}`,
  'VITE_LS_STORE_ID=111',
  'VITE_LS_PRODUCT_IDS=222',
  'VITE_LS_CHECKOUT_MONTHLY=https://statementsheet.lemonsqueezy.com/buy/test-monthly',
  'VITE_LS_CHECKOUT_YEARLY=https://statementsheet.lemonsqueezy.com/buy/test-yearly',
  'VITE_GOATCOUNTER_CODE=',
].join(' ');

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: process.env.E2E_BASE_URL || `http://localhost:${PORT}${BASE}`, trace: 'retain-on-failure', acceptDownloads: true },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `env ${env} npm run site && env ${env} npx vite build --outDir ../dist-e2e --emptyOutDir && env ${env} npx vite preview --outDir ../dist-e2e --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}${BASE}`,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
