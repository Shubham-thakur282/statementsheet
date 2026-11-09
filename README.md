# StatementSheet

**Convert bank & credit card statement PDFs to Excel, CSV, OFX (QuickBooks/Xero) and QIF, entirely in the browser.** No upload, no server, no account. Every row is verified against the statement's running balance.

- Live: https://shubham-thakur282.github.io/statementsheet/ *(after first deploy)*
- Business model: Free (3 statements/day, ≤10 pages, CSV) → Pro $9/mo or $69/yr via Lemon Squeezy license keys.

## How it works

```
PDF ──pdf.js (in browser)──▶ positioned text items
      ──layout.ts──▶ words → lines → header-column detection (or x-cluster inference)
      ──statement.ts──▶ rows: date / description / reference / debit / credit / amount / balance
                        + wrapped-description joining, year inference, card-sign handling
      ──reconcile()──▶ prev balance + amount = balance  (auto-fixes signs, flags mismatches)
      ──formats.ts──▶ CSV (formula-injection safe) · XLSX · OFX 1.0.2 · QIF
```

There is **no backend and no database by design**: the product's core promise is that financial
data never leaves the device. Licensing uses Lemon Squeezy's public License API (CORS-enabled,
no secret needed), which also handles payment, tax, invoicing, key delivery and subscription expiry.

| Path | What |
|---|---|
| `src/lib/parse/` | Parser: dates, amounts, layout, statement, reconciliation |
| `src/lib/export/formats.ts` | CSV / XLSX / OFX / QIF writers |
| `src/lib/plan.ts` | Free-tier metering, license verification (store/product-pinned) |
| `src/components/` | React islands: Converter, ResultTable, Upgrade/License modal |
| `scripts/content.mjs` | All page copy (landing, SEO pages, guides, legal) |
| `scripts/build-site.mjs` | Static HTML generator (SEO pages, sitemap, robots, CSP) |
| `tests/` | unit, integration, e2e (Playwright), a11y (axe), fixtures |
| `perf/perf.mjs` | 60-page statement conversion benchmark |

## Develop

```bash
npm install
npm run dev            # http://localhost:5199
npm test               # unit + integration (Vitest)
npm run test:e2e       # Playwright E2E + accessibility (desktop + mobile)
npm run build          # → dist/
node perf/perf.mjs     # perf benchmark against a running preview (port 5299)
```

Config is via public build-time env vars, see `.env.example` and `docs/OPERATIONS.md`.

## Deploy

Push to `main` → GitHub Actions runs typecheck, unit, integration, E2E, then builds and deploys to GitHub Pages.
