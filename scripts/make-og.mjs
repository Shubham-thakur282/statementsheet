// Renders public/og.png (1200x630 social preview) from HTML.
import { chromium } from '@playwright/test';
const html = `<html><body style="margin:0;width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box;background:linear-gradient(135deg,#ecfdf5,#f8fafc);font-family:system-ui,sans-serif;color:#0f172a">
<div style="display:flex;align-items:center;gap:16px;font-size:34px;font-weight:700"><span style="display:grid;place-items:center;width:56px;height:56px;border-radius:14px;background:#047857;color:#fff">⇄</span>StatementSheet</div>
<div style="margin-top:36px;font-size:64px;font-weight:800;line-height:1.1">Bank statement PDF → Excel, CSV &amp; QuickBooks</div>
<div style="margin-top:28px;font-size:32px;color:#334155">Converted in your browser. Your financial data never leaves your device.</div>
<div style="margin-top:36px;display:flex;gap:16px;font-size:24px;color:#047857;font-weight:600"><span>✓ Balance-verified</span><span>✓ OFX for QuickBooks/Xero</span><span>✓ Free to try</span></div>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html);
await p.screenshot({ path: new URL('../public/og.png', import.meta.url).pathname });
await b.close();
console.log('og.png written');
