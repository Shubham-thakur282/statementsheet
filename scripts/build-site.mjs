// Generates the static HTML site into ./site (Vite root) and copies pdf.js assets into ./public.
// Env: SITE_URL (absolute origin+base for canonical links), SITE_BASE (path prefix, default "/"),
//      VITE_GOATCOUNTER_CODE (optional analytics).
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND, pages, legal } from './content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Load .env / .env.production for local builds (CI passes real env vars).
for (const f of ['.env', '.env.production']) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const BASE = (process.env.SITE_BASE || '/').replace(/\/?$/, '/');
const SITE_URL = (process.env.SITE_URL || 'http://localhost:5199' + BASE).replace(/\/?$/, '/');
const GC = (process.env.VITE_GOATCOUNTER_CODE || '').replace(/[^a-z0-9-]/gi, '');
const SITE = join(root, 'site');

rmSync(SITE, { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });

// pdf.js font/cmap data so text extraction works for every font encoding.
const pdfjsDir = join(root, 'node_modules/pdfjs-dist');
for (const d of ['cmaps', 'standard_fonts']) cpSync(join(pdfjsDir, d), join(root, 'public/pdfjs', d), { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (slug) => BASE + (slug ? slug.replace(/\/?$/, '/') : '');
const abs = (slug) => SITE_URL + (slug ? slug.replace(/\/?$/, '/') : '');

const csp = [
  "default-src 'self'",
  `script-src 'self'${GC ? ' https://gc.zgo.at' : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' https://api.lemonsqueezy.com${GC ? ` https://${GC}.goatcounter.com` : ''}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const navLinks = [
  ['bank-statement-to-excel', 'To Excel'],
  ['bank-statement-to-quickbooks', 'QuickBooks'],
  ['pricing', 'Pricing'],
];

function layout({ slug, title, description, body, jsonLd = [], islands = true, noindex = false, depth = slug ? slug.split('/').length : 0 }) {
  const rel = '../'.repeat(depth + 1);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${abs(slug)}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(slug)}">
<meta property="og:image" content="${SITE_URL}og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#059669">
<link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml">
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
<script type="module" src="${rel}src/islands.tsx"></script>
${GC ? `<script data-goatcounter="https://${GC}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ''}
</head>
<body class="min-h-screen bg-slate-50 text-slate-900 antialiased">
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
<header class="border-b border-slate-200 bg-white/90 backdrop-blur">
  <nav class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3" aria-label="Main">
    <a href="${link('')}" class="flex items-center gap-2 font-bold text-slate-900">
      <span aria-hidden="true" class="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-sm text-white">⇄</span>${BRAND}
    </a>
    <div class="flex items-center gap-1 sm:gap-4 text-sm">
      ${navLinks.map(([s, l], i) => `<a href="${link(s)}" class="${i < 2 ? 'hidden md:inline ' : ''}rounded px-2 py-1 text-slate-700 hover:text-emerald-700">${l}</a>`).join('')}
      <span id="nav-account">${islands ? '' : ''}</span>
    </div>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="mt-20 border-t border-slate-200 bg-white">
  <div class="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
    <div>
      <div class="font-bold">${BRAND}</div>
      <p class="mt-2 text-slate-600">Private bank statement conversion. Your files never leave your device.</p>
    </div>
    <div>
      <div class="font-semibold">Convert</div>
      <ul class="mt-2 space-y-1">
        ${pages.filter((p) => p.slug && !p.guide).map((p) => `<li><a class="text-slate-600 hover:text-emerald-700" href="${link(p.slug)}">${esc(p.h1.replace(/^Import a PDF bank statement into /, 'PDF to ').replace(/^Convert /, ''))}</a></li>`).join('\n        ')}
      </ul>
    </div>
    <div>
      <div class="font-semibold">Company</div>
      <ul class="mt-2 space-y-1">
        ${pages.filter((p) => p.guide).map((p) => `<li><a class="text-slate-600 hover:text-emerald-700" href="${link(p.slug)}">${esc(p.h1)}</a></li>`).join('\n        ')}
        <li><a class="text-slate-600 hover:text-emerald-700" href="${link('pricing')}">Pricing</a></li>
        <li><a class="text-slate-600 hover:text-emerald-700" href="${link('support')}">Support &amp; contact</a></li>
        <li><a class="text-slate-600 hover:text-emerald-700" href="${link('privacy')}">Privacy policy</a></li>
        <li><a class="text-slate-600 hover:text-emerald-700" href="${link('terms')}">Terms of service</a></li>
      </ul>
    </div>
  </div>
  <p class="pb-8 text-center text-xs text-slate-500">© 2026 ${BRAND}. Not affiliated with any bank, Intuit QuickBooks or Xero.</p>
</footer>
</body>
</html>
`;
}

function faqHtml(faq) {
  if (!faq?.length) return '';
  return `<section class="mx-auto max-w-3xl px-4 pt-16" aria-labelledby="faq">
  <h2 id="faq" class="text-2xl font-bold">Frequently asked questions</h2>
  <div class="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
  ${faq.map(([q, a]) => `<details class="group p-4"><summary class="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">${esc(q)} <span class="float-right text-slate-400 group-open:rotate-45 transition">+</span></summary><p class="mt-2 text-slate-700">${esc(a)}</p></details>`).join('\n  ')}
  </div>
</section>`;
}

const faqLd = (faq) =>
  faq?.length
    ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }]
    : [];

const appLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: BRAND,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any (web browser)',
  url: abs(''),
  description: 'Convert bank and credit card statement PDFs to Excel, CSV, OFX and QIF privately in the browser.',
  offers: [
    { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free' },
    { '@type': 'Offer', price: '9', priceCurrency: 'USD', name: 'Pro monthly' },
    { '@type': 'Offer', price: '69', priceCurrency: 'USD', name: 'Pro yearly' },
  ],
};

const trustBar = `<ul class="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
  <li>🔒 Files never leave your device</li><li>✓ Running-balance verification</li><li>⚡ No sign-up for free use</li><li>🌍 US, UK, India &amp; more</li>
</ul>`;

const homeExtra = `
<section class="mx-auto max-w-6xl px-4 pt-20" aria-labelledby="why">
  <h2 id="why" class="text-center text-3xl font-bold">Why people switch to ${BRAND}</h2>
  <div class="mt-10 grid gap-6 md:grid-cols-3">
    ${[
      ['Private by design', 'Other converters upload your statement to their servers. We built StatementSheet so conversion runs inside your browser tab: no upload, no storage, nothing to breach.'],
      ['Verified, not guessed', 'Every row is checked against the running balance. Sign errors are corrected automatically and anything suspicious is highlighted before you download.'],
      ['Ready for your books', 'CSV for spreadsheets and budgeting apps; Excel, OFX (QuickBooks, Xero, Wave) and QIF on Pro. Wrapped descriptions, dates without years and Cr/Dr markers are handled.'],
    ].map(([t, d]) => `<div class="rounded-2xl border border-slate-200 bg-white p-6"><h3 class="text-lg font-semibold">${t}</h3><p class="mt-2 text-slate-600">${d}</p></div>`).join('')}
  </div>
</section>
<section class="mx-auto max-w-6xl px-4 pt-20" aria-labelledby="how">
  <h2 id="how" class="text-center text-3xl font-bold">How it works</h2>
  <ol class="mt-10 grid gap-6 md:grid-cols-3">
    ${[
      ['Drop your PDF', 'Any digital statement from online banking. Password-protected PDFs are fine.'],
      ['Review the table', 'Columns are rebuilt from the page layout and checked against the balance. Click any cell to edit.'],
      ['Download', 'CSV, Excel, OFX or QIF, ready for Excel, Google Sheets, QuickBooks or Xero.'],
    ].map(([t, d], i) => `<li class="rounded-2xl bg-white p-6 border border-slate-200"><div class="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 font-bold text-white">${i + 1}</div><h3 class="mt-3 font-semibold">${t}</h3><p class="mt-1 text-slate-600">${d}</p></li>`).join('')}
  </ol>
</section>
<section class="mx-auto max-w-6xl px-4 pt-20" aria-labelledby="who">
  <h2 id="who" class="text-center text-3xl font-bold">Built for</h2>
  <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-center">
    ${['Bookkeepers & accountants handling client statements', 'Freelancers & small businesses catching up on books', 'Anyone doing taxes, budgets or loan paperwork', 'Finance teams with strict data-handling rules'].map((t) => `<div class="rounded-xl bg-white border border-slate-200 p-5 text-slate-700">${t}</div>`).join('')}
  </div>
</section>
${pricingCards()}
`;

function pricingCards() {
  return `<section class="mx-auto max-w-5xl px-4 pt-20" aria-labelledby="pricing-h">
  <h2 id="pricing-h" class="text-center text-3xl font-bold">Simple pricing</h2>
  <p class="mt-2 text-center text-slate-600">Start free. Upgrade when you need more statements or accounting formats.</p>
  <div class="mt-10 grid gap-6 md:grid-cols-3">
    <div class="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 class="font-semibold">Free</h3><p class="mt-2 text-3xl font-bold">$0</p>
      <ul class="mt-4 space-y-2 text-sm text-slate-700"><li>✓ 3 statements per day</li><li>✓ Up to 10 pages each</li><li>✓ CSV download</li><li>✓ Balance verification</li><li>✓ 100% in-browser</li></ul>
      <a href="${link('')}#converter-section" class="mt-6 block rounded-lg border border-slate-300 px-4 py-2 text-center font-semibold hover:bg-slate-50">Convert a statement</a>
    </div>
    <div class="rounded-2xl border-2 border-emerald-600 bg-white p-6 shadow-sm">
      <h3 class="font-semibold">Pro yearly <span class="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">Save 36%</span></h3><p class="mt-2 text-3xl font-bold">$69<span class="text-base font-normal text-slate-500">/year</span></p>
      <ul class="mt-4 space-y-2 text-sm text-slate-700"><li>✓ Unlimited statements &amp; pages</li><li>✓ Excel, OFX (QuickBooks/Xero), QIF</li><li>✓ Batch: many PDFs → one file</li><li>✓ Use on 3 devices</li><li>✓ 14-day money-back guarantee</li></ul>
      <button type="button" data-upgrade class="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">Get Pro</button>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 class="font-semibold">Pro monthly</h3><p class="mt-2 text-3xl font-bold">$9<span class="text-base font-normal text-slate-500">/month</span></p>
      <ul class="mt-4 space-y-2 text-sm text-slate-700"><li>✓ Everything in Pro</li><li>✓ Cancel anytime</li><li>✓ Ideal for a one-off catch-up</li></ul>
      <button type="button" data-upgrade class="mt-6 w-full rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50">Get Pro monthly</button>
    </div>
  </div>
</section>`;
}

const written = [];
function write(slug, html) {
  const file = slug === '404' ? join(SITE, '404.html') : join(SITE, slug, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  written.push(slug);
}

for (const p of pages) {
  const hero = `<section class="mx-auto max-w-6xl px-4 pt-12 sm:pt-16 text-center">
  ${p.guide ? `<p class="text-sm font-semibold uppercase tracking-wide text-emerald-700">Guide</p>` : ''}
  <h1 class="mx-auto max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl">${esc(p.h1)}</h1>
  <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-600">${esc(p.lead)}</p>
  ${p.guide ? '' : trustBar}
</section>`;
  const tool = p.guide
    ? ''
    : `<section id="converter-section" class="mx-auto mt-8 max-w-5xl px-4" aria-label="Statement converter"><div id="converter"><div class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading converter…</div></div></section>`;
  const body = p.body ? `<article class="prose-content mx-auto max-w-3xl px-4 pt-12">${p.body}</article>` : '';
  const cta = p.guide
    ? `<section class="mx-auto max-w-3xl px-4 pt-12"><div class="rounded-2xl bg-emerald-600 p-6 text-white"><h2 class="text-xl font-bold">Convert a statement without uploading it</h2><p class="mt-1 text-emerald-50">Free, in your browser, verified against the running balance.</p><a href="${link('')}#converter-section" class="mt-4 inline-block rounded-lg bg-white px-4 py-2 font-semibold text-emerald-800">Open the converter</a></div></section>`
    : '';
  write(
    p.slug,
    layout({
      slug: p.slug,
      title: p.home ? `${p.title}` : `${p.title}`,
      description: p.description,
      body: hero + tool + body + (p.home ? homeExtra : '') + faqHtml(p.faq) + cta,
      jsonLd: [...(p.home ? [appLd] : []), ...faqLd(p.faq), ...(p.guide ? [{ '@context': 'https://schema.org', '@type': 'Article', headline: p.h1, description: p.description, dateModified: '2026-11-09' }] : [])],
    }),
  );
}

const simple = (slug, title, description, inner) =>
  write(slug, layout({ slug, title: `${title} | ${BRAND}`, description, body: `<article class="prose-content mx-auto max-w-3xl px-4 pt-12"><h1 class="text-4xl font-extrabold">${esc(title)}</h1>${inner}</article>` }));

write(
  'pricing',
  layout({
    slug: 'pricing',
    title: `Pricing | ${BRAND}`,
    description: 'StatementSheet is free for 3 statements a day. Pro ($9/month or $69/year) unlocks unlimited statements, Excel, OFX and QIF exports and batch conversion.',
    body:
      `<section class="mx-auto max-w-3xl px-4 pt-12 text-center"><h1 class="text-4xl font-extrabold">Pricing</h1><p class="mt-3 text-lg text-slate-600">Every plan converts statements on your own device. You pay for convenience, not for access to your data.</p></section>` +
      pricingCards() +
      `<section class="mx-auto max-w-md px-4 pt-12"><div id="license-form"></div></section>` +
      faqHtml([
        ['How do I get my license key?', 'Right after checkout, Lemon Squeezy emails your license key and receipt. Click “Go Pro” → paste the key → Activate.'],
        ['Can I cancel?', 'Yes, anytime, from the billing link in your receipt email. Pro stays active until the end of the period you paid for.'],
        ['Do you offer refunds?', 'Yes. If Pro doesn’t work for your statements, ask within 14 days for a full refund.'],
        ['Do you offer invoices with VAT/GST?', 'Yes. Lemon Squeezy is our merchant of record and issues compliant invoices, handling sales tax, VAT and GST.'],
      ]),
  }),
);
simple('privacy', 'Privacy policy', 'StatementSheet privacy policy: statements are converted in your browser and never uploaded.', legal.privacy.replaceAll('{{base}}', BASE));
simple('terms', 'Terms of service', 'Terms of service for StatementSheet.', legal.terms);
simple(
  'support',
  'Support & contact',
  'Get help with StatementSheet: statement not converting, license keys, billing and refunds.',
  `
<p>We usually reply within one business day.</p>
<h2>A statement doesn’t convert correctly</h2>
<p>Please <strong>don’t send us your statement</strong>. Instead, open an issue telling us the bank name, country, statement type (checking, savings, card) and what went wrong (e.g. “amounts land in the description”). A screenshot of the table header with personal data blacked out helps a lot.</p>
<p><a href="https://github.com/Shubham-thakur282/statementsheet/issues/new" rel="noopener">Report a statement layout →</a></p>
<h2>Billing, license keys and refunds</h2>
<ul>
<li><strong>Lost license key?</strong> Use the “My orders” page on <a href="https://app.lemonsqueezy.com/my-orders" rel="noopener">Lemon Squeezy</a> with the email you purchased with.</li>
<li><strong>Cancel or change plan:</strong> use the billing link in your receipt email, or “Manage billing” in the Pro menu.</li>
<li><strong>Refunds</strong> within 14 days: reply to your receipt email or open a support request below.</li>
</ul>
<p><a href="https://github.com/Shubham-thakur282/statementsheet/issues/new" rel="noopener">Open a support request →</a></p>
<h2>Common questions</h2>
<h3>“No text layer found”</h3><p>The PDF is a scan or photo. Download the statement again from online banking as a PDF instead of scanning paper.</p>
<h3>Dates look wrong</h3><p>Switch <em>Dates</em> between DD/MM and MM/DD above the results table.</p>
<h3>Debits and credits are reversed</h3><p>Switch <em>Type</em> between Bank account and Credit card, or use <em>Flip all signs</em>.</p>`,
);
write(
  '404',
  layout({ slug: '404', depth: 0, title: `Page not found | ${BRAND}`, description: 'Page not found.', noindex: true, body: `<section class="mx-auto max-w-xl px-4 pt-20 text-center"><h1 class="text-4xl font-extrabold">Page not found</h1><p class="mt-3 text-slate-600">That page doesn’t exist.</p><a class="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white" href="${link('')}">Go to the converter</a></section>` }),
);

// sitemap + robots
const indexable = written.filter((s) => s !== '404');
writeFileSync(
  join(root, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((s) => `  <url><loc>${abs(s)}</loc><lastmod>2026-11-09</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
writeFileSync(join(root, 'public/robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);
console.log(`site: ${written.length} pages → ${relative(root, SITE)} (base ${BASE}, url ${SITE_URL})`);
