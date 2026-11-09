// Performance check: page load metrics + conversion time for a large (60-page, ~2,000-row) statement.
// Usage: node perf/perf.mjs [baseUrl]   (requires a running server; defaults to the e2e preview)
import { chromium, devices } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const base = process.argv[2] || 'http://localhost:5299/';

async function bigStatement(pages = 60, rowsPerPage = 34) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let bal = 10000;
  const f = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (let p = 0; p < pages; p++) {
    const page = doc.addPage([612, 792]);
    let y = 740;
    [['Date', 40], ['Description', 100], ['Withdrawals', 360], ['Deposits', 440], ['Balance', 520]].forEach(([s, x]) => page.drawText(s, { x, y, size: 8, font }));
    y -= 16;
    for (let r = 0; r < rowsPerPage; r++) {
      const i = p * rowsPerPage + r;
      const amt = ((i * 37) % 500) + 0.25;
      const dep = i % 7 === 0;
      bal = Math.round((bal + (dep ? amt : -amt)) * 100) / 100;
      const d = `${String((i % 12) + 1).padStart(2, '0')}/${String((i % 28) + 1).padStart(2, '0')}/2025`;
      page.drawText(d, { x: 40, y, size: 8, font });
      page.drawText(`MERCHANT ${i} PURCHASE`, { x: 100, y, size: 8, font });
      page.drawText(f(amt), { x: dep ? 440 : 360, y, size: 8, font });
      page.drawText(f(bal), { x: 520, y, size: 8, font });
      y -= 20;
    }
  }
  return Buffer.from(await doc.save());
}

const browser = await chromium.launch();
for (const [label, opts] of [['desktop', { viewport: { width: 1366, height: 900 } }], ['mobile (Pixel 7, 4x CPU throttle)', devices['Pixel 7']]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  if (label.startsWith('mobile')) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'load' });
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: Math.round(fcp ?? -1), kb: Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024) + Math.round(n.transferSize / 1024) };
  });
  await page.getByText('Drop your bank statement PDF here').waitFor();
  const interactive = Date.now() - t0;
  const pdf = await bigStatement();
  const t1 = Date.now();
  await page.getByTestId('file-input').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: pdf });
  // free plan: >10 pages → upgrade modal (expected). Activate a fake Pro locally to measure conversion.
  await page.getByRole('dialog').waitFor();
  const gateMs = Date.now() - t1;
  await page.evaluate(() => localStorage.clear());
  await page.route('https://api.lemonsqueezy.com/**', (r) => r.fulfill({ json: { activated: true, license_key: { status: 'active' }, instance: { id: 'p' }, meta: { store_id: 111, product_id: 222 } } }));
  await page.goto(base);
  await page.getByRole('button', { name: 'Go Pro' }).click();
  await page.getByLabel('Have a license key?').fill('38b1460a-5104-4067-a91d-77b872934d51');
  await page.getByRole('button', { name: 'Activate' }).click();
  await page.getByRole('button', { name: 'Pro ✓' }).waitFor();
  const t2 = Date.now();
  await page.getByTestId('file-input').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByTestId('summary').waitFor({ timeout: 120000 });
  const convertMs = Date.now() - t2;
  const summary = (await page.getByTestId('summary').innerText()).replace(/\n/g, ' ');
  const mem = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  console.log(JSON.stringify({ label, ...nav, interactiveMs: interactive, pageGateMs: gateMs, pdfKB: Math.round(pdf.length / 1024), convert60PagesMs: convertMs, heapMB: Math.round(mem / 1048576), summary }));
  await ctx.close();
}
await browser.close();
