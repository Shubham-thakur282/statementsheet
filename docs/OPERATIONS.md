# Operations runbook

## 1. Go live checklist (one-time, ~30 min, all free)

### a) GitHub Pages (hosting, free, HTTPS)
1. Push this repo to `github.com/Shubham-thakur282/statementsheet` (public).
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The `Test & deploy` workflow runs on every push to `main`. The site appears at
   `https://shubham-thakur282.github.io/statementsheet/`.

### b) Payments: Lemon Squeezy (merchant of record, no monthly fee; ~5% + 50¢ per sale)
1. Sign up at lemonsqueezy.com and complete store activation (identity + payout details). Confirm your payout country is supported on their payouts page; if not, Dodo Payments (India-based merchant of record with license keys) is the fallback.
2. Create product **StatementSheet Pro** (type: subscription) with two variants:
   - Monthly $9, Yearly $69.
   - Enable **License keys** on the product: activation limit **3**, "license length: until subscription ends".
3. Copy: Store ID (Settings → Stores), Product ID, and each variant's checkout link (Share → checkout URL).
4. GitHub repo → **Settings → Secrets and variables → Actions → Variables** (these are public IDs, not secrets):
   | Variable | Example |
   |---|---|
   | `VITE_LS_STORE_ID` | `12345` |
   | `VITE_LS_PRODUCT_IDS` | `67890` |
   | `VITE_LS_CHECKOUT_MONTHLY` | `https://statementsheet.lemonsqueezy.com/buy/…` |
   | `VITE_LS_CHECKOUT_YEARLY` | `https://statementsheet.lemonsqueezy.com/buy/…` |
5. Re-run the workflow (Actions → Test & deploy → Run workflow). The upgrade dialog now shows Buy buttons.
6. Test with Lemon Squeezy **test mode**: buy with test card `4242 4242 4242 4242`, paste the emailed key into “Go Pro”. Then switch the store to live.

Until step 4 is done, the site works fully on the free plan and the upgrade dialog honestly says
“Online checkout is being set up”.

### c) Analytics (optional, free, cookie-less)
Create a GoatCounter site (e.g. code `statementsheet`) → set repo variable `VITE_GOATCOUNTER_CODE=statementsheet`.
Events tracked: `convert-ok`, `convert-empty`, `convert-error`, `export-<fmt>`, `upgrade-open-<reason>`,
`checkout-<plan>`, `license-activated`. No file data is ever sent.

### d) Search
1. Google Search Console → add URL-prefix property for the site → verify via HTML-tag method
   (add the meta tag to `layout()` in `scripts/build-site.mjs`) → submit `sitemap.xml`.
2. Bing Webmaster Tools → import from Search Console.

### e) Custom domain (recommended for SEO, ~$10/yr, needs your approval to buy)
e.g. `statementsheet.app`. Add `public/CNAME`, set DNS, then set repo variables `SITE_BASE=/`
and `SITE_URL=https://statementsheet.app/`.

## 2. What runs automatically
- Payment, tax/VAT/GST, invoices, license-key email, renewals, dunning, cancellations, refunds UI: Lemon Squeezy.
- Pro expiry: license validated against Lemon Squeezy at most daily; lapsed subscriptions stop unlocking Pro
  (7-day offline grace).
- Free-tier metering: in-browser per-day counter.
- Deploys: every push runs the full test suite before deploying; a failing test blocks the deploy.
- No servers, databases, backups or scaling to manage. Hosting cost: $0.

## 3. What needs a human
| Task | Frequency | Time |
|---|---|---|
| Answer GitHub issues (layout reports, billing) | weekly | ~30 min |
| Add support for a reported bank layout (add fixture + test) | as reported | 30–60 min each |
| Approve refunds in Lemon Squeezy | rare | minutes |
| Review analytics funnel, tweak copy/pricing | monthly | 1 h |

## 4. Known limitations
- Scanned/photographed statements (no text layer) are not supported (needs OCR).
- European decimal-comma amounts (`1.234,56`) are not parsed yet.
- Amounts must have exactly two decimals (true for virtually all statements; excludes JPY-style).
- Free-tier limits and Pro gating are enforced client-side; a technical user can bypass them.
  This is an accepted trade-off of the no-server privacy architecture (same as most desktop tools).
- Parser was validated on 4 synthetic layouts (US, India, UK, card) + header-less, newest-first and
  once-per-day-balance variants. Real-world bank coverage will grow from user reports.
