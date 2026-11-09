import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { encryptedFixture } from '../encrypt';

const fx = (n: string) => new URL(`../fixtures/${n}`, import.meta.url).pathname;
const KEY = '38b1460a-5104-4067-a91d-77b872934d51';

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

async function upload(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByTestId('file-input').setInputFiles(typeof file === 'string' ? fx(file) : file);
}

async function mockLicenseApi(page: Page, meta = { store_id: 111, product_id: 222, customer_email: 'buyer@example.com' }) {
  await page.route('https://api.lemonsqueezy.com/v1/licenses/**', async (route) => {
    const body = new URLSearchParams(route.request().postData() ?? '');
    const url = route.request().url();
    if (body.get('license_key') !== KEY) return route.fulfill({ status: 404, json: { valid: false, activated: false, error: 'license_key not found.' } });
    if (url.endsWith('/deactivate')) return route.fulfill({ json: { deactivated: true } });
    return route.fulfill({ json: { activated: true, valid: true, error: null, license_key: { status: 'active', expires_at: null }, instance: { id: 'inst-e2e' }, meta } });
  });
}

test.describe('landing page', () => {
  test('loads with SEO essentials and no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('./');
    await expect(page).toHaveTitle(/Bank Statement PDF to Excel/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('without uploading');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /browser/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
    await expect(page.getByText('Drop your bank statement PDF here')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('has no horizontal overflow', async ({ page }) => {
    await page.goto('./');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('skip link and file picker are keyboard reachable', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard test on desktop only');
    await page.goto('./');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    const chooser = page.getByRole('button', { name: 'choose a file' });
    await chooser.focus();
    await expect(chooser).toBeFocused();
  });
});

test.describe('conversion journey (free plan)', () => {
  test('converts a US statement, shows reconciliation, edits a row and downloads CSV', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('./');
    await upload(page, 'us-checking.pdf');
    const table = page.getByTestId('results-table');
    await expect(table.locator('tbody tr')).toHaveCount(24);
    await expect(page.getByTestId('summary')).toContainText('All reconcile');
    await expect(page.getByTestId('summary')).toContainText('24');
    await expect(table.locator('tbody tr').first().getByLabel('Description')).toHaveValue('ACH DEPOSIT ACME PAYROLL PPD ID 9876543210');

    // edit and delete
    await table.locator('tbody tr').nth(1).getByLabel('Description').fill('Coffee (edited)');
    await table.locator('tbody tr').nth(2).getByRole('button', { name: /Delete row/ }).click();
    await expect(table.locator('tbody tr')).toHaveCount(23);

    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^CSV/ }).click()]);
    expect(dl.suggestedFilename()).toBe('us-checking.csv');
    const csv = readFileSync(await dl.path(), 'utf8');
    expect(csv).toContain('Date,Description,Reference,Debit,Credit,Amount,Balance');
    expect(csv).toContain('2025-01-03,Coffee (edited),,6.75,,-6.75,5563.80');
    expect(csv).not.toContain('ONLINE TRANSFER TO SAVINGS');
    expect(csv.trim().split('\n')).toHaveLength(24);
    expect(errors).toEqual([]);
  });

  test('Indian statement: DD/MM detection and date-order toggle', async ({ page }) => {
    await page.goto('./');
    await upload(page, 'in-savings.pdf');
    const firstDate = page.getByTestId('results-table').locator('tbody tr').nth(1).getByLabel('Date');
    await expect(firstDate).toHaveValue('2025-04-03');
    await page.getByLabel('Dates').selectOption('MDY');
    await expect(firstDate).toHaveValue('2025-03-04');
  });

  test('password-protected PDF prompts, rejects wrong password, then converts', async ({ page }) => {
    await page.goto('./');
    await upload(page, { name: 'locked.pdf', mimeType: 'application/pdf', buffer: encryptedFixture('in-savings.pdf', '01011990') });
    await expect(page.getByText('is password-protected')).toBeVisible();
    await page.getByLabel(/PDF password/).fill('nope');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText('Incorrect password')).toBeVisible();
    await page.getByLabel(/PDF password/).fill('01011990');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByTestId('results-table').locator('tbody tr')).toHaveCount(10);
  });

  test('rejects non-PDF files and explains non-statement PDFs', async ({ page }) => {
    await page.goto('./');
    await upload(page, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.getByRole('alert')).toContainText('Please choose a PDF');
    await upload(page, { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>not a pdf</html>') });
    await expect(page.getByRole('alert')).toContainText('not a PDF');
    await upload(page, 'not-a-statement.pdf');
    await expect(page.getByText(/couldn't find a transaction table/)).toBeVisible();
  });

  test('premium formats open the upgrade dialog with checkout links', async ({ page }) => {
    await page.goto('./');
    await upload(page, 'uk-signed.pdf');
    await page.getByRole('button', { name: /^Excel/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Excel, OFX (QuickBooks / Xero) and QIF exports are part of Pro');
    await expect(dialog.getByRole('link', { name: /Buy yearly/ })).toHaveAttribute('href', 'https://statementsheet.lemonsqueezy.com/buy/test-yearly');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('daily free limit triggers upgrade on the 4th conversion', async ({ page }) => {
    await page.goto('./');
    for (let i = 0; i < 3; i++) {
      await upload(page, 'credit-card.pdf');
      await expect(page.getByTestId('results-table')).toBeVisible();
      await page.getByRole('button', { name: 'Clear' }).click();
    }
    await expect(page.getByText('Free: 0 of 3 conversions left today')).toBeVisible();
    await upload(page, 'credit-card.pdf');
    await expect(page.getByRole('dialog')).toContainText("You've used today's 3 free conversions");
  });

  test('multiple files on free plan prompts for Pro', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('file-input').setInputFiles([fx('us-checking.pdf'), fx('uk-signed.pdf')]);
    await expect(page.getByRole('dialog')).toContainText('several statements at once is part of Pro');
  });
});

test.describe('Pro license journey', () => {
  test('invalid key is rejected; valid key unlocks Excel/OFX/batch; license can be removed', async ({ page }) => {
    await mockLicenseApi(page);
    await page.goto('./');
    await page.getByRole('button', { name: 'Go Pro' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Have a license key?').fill('00000000-0000-0000-0000-000000000000');
    await dialog.getByRole('button', { name: 'Activate' }).click();
    await expect(dialog.getByRole('alert')).toContainText('license_key not found');

    await dialog.getByLabel('Have a license key?').fill(KEY);
    await dialog.getByRole('button', { name: 'Activate' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Pro ✓' })).toBeVisible();

    // batch
    await page.getByTestId('file-input').setInputFiles([fx('us-checking.pdf'), fx('uk-signed.pdf')]);
    await expect(page.getByTestId('results-table').locator('tbody tr')).toHaveCount(32);

    const [x] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Excel/ }).click()]);
    expect(x.suggestedFilename()).toBe('statements.xlsx');
    const [o] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^OFX/ }).click()]);
    expect(readFileSync(await o.path(), 'utf8')).toContain('<STMTTRN>');
    const [q] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^QIF/ }).click()]);
    expect(readFileSync(await q.path(), 'utf8')).toMatch(/^!Type:Bank/);

    // persists across reload
    await page.reload();
    await expect(page.getByRole('button', { name: 'Pro ✓' })).toBeVisible();

    // "logout": remove license
    await page.getByRole('button', { name: 'Pro ✓' }).click();
    await page.getByRole('button', { name: 'Remove license from this browser' }).click();
    await expect(page.getByRole('button', { name: 'Go Pro' })).toBeVisible();
  });

  test('a key from another Lemon Squeezy store is refused', async ({ page }) => {
    await mockLicenseApi(page, { store_id: 999, product_id: 222, customer_email: 'x@example.com' });
    await page.goto('./pricing/');
    await page.getByLabel('Have a license key?').fill(KEY);
    await page.getByRole('button', { name: 'Activate' }).click();
    await expect(page.getByRole('alert')).toContainText('different product');
  });

  test('tampered localStorage cannot fake Pro', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => localStorage.setItem('ss_license_v1', JSON.stringify({ key: '<img src=x onerror=alert(1)>', status: 'active', validatedAt: Date.now() })));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Go Pro' })).toBeVisible();
  });
});

test.describe('content pages', () => {
  test('every internal link resolves (no broken links)', async ({ page, request, isMobile }) => {
    test.skip(isMobile, 'crawl once');
    const seen = new Set<string>();
    const queue = ['./'];
    while (queue.length) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      if (!(res.headers()['content-type'] ?? '').includes('html')) continue;
      await page.goto(path);
      const hrefs = await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!.split('#')[0]));
      for (const h of hrefs) if (h && !seen.has(h)) queue.push(h);
    }
    for (const asset of ['./sitemap.xml', './robots.txt', './favicon.svg', './og.png', './pdfjs/standard_fonts/LiberationSans-Regular.ttf', './pdfjs/cmaps/78-H.bcmap']) expect((await request.get(asset)).status(), asset).toBe(200);
    expect(seen.size).toBeGreaterThanOrEqual(14);
    // Guard: the server must really 404 missing files, otherwise this check proves nothing.
    expect((await request.get('./definitely-missing-page/')).status()).toBe(404);
  });

  test('SEO landing page embeds a working converter', async ({ page }) => {
    await page.goto('./bank-statement-to-quickbooks/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Import a PDF bank statement into QuickBooks');
    await upload(page, 'in-savings.pdf');
    await expect(page.getByTestId('results-table').locator('tbody tr')).toHaveCount(10);
  });
});
