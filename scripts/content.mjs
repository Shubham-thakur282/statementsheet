// Page content for the static site. Every SEO page embeds the working converter, so the
// page itself solves the searcher's problem; the text explains the specific workflow.

export const BRAND = 'StatementSheet';

const faqCommon = [
  ['Is my bank statement uploaded anywhere?', 'No. The PDF is opened and converted by JavaScript running in your own browser tab. Nothing about the file (not the PDF, its text or the transactions) is sent to any server. You can verify this by turning off your internet after the page loads; conversion still works.'],
  ['Which statements work?', 'Digital (text-based) PDF statements downloaded from online banking, from banks and card issuers in the US, UK, India, Canada, Australia and elsewhere. Scanned paper statements and photos are images with no text layer, and are not supported yet.'],
  ['How do I know the conversion is correct?', 'When your statement has a running balance column, StatementSheet checks every row: previous balance + amount must equal the printed balance. Rows that don’t reconcile are highlighted so you can fix them before downloading, and amounts whose sign is contradicted by the balance are corrected automatically.'],
  ['Is it free?', 'Yes, you get 3 conversions a day, up to 10 pages each, with CSV download, and no sign-up. Pro adds unlimited statements, Excel, OFX (QuickBooks, Xero, Wave) and QIF exports, and batch conversion.'],
];

export const pages = [
  {
    slug: '',
    title: 'Bank Statement PDF to Excel & CSV Converter: Private, In-Browser',
    h1: 'Convert bank statement PDFs to Excel, CSV & QuickBooks, without uploading them',
    description: 'Convert bank and credit card statement PDFs to Excel, CSV, OFX (QuickBooks/Xero) and QIF. Runs entirely in your browser, so your financial data never leaves your device. Free to try.',
    lead: 'Drop in a PDF statement and get a clean, balance-checked transaction table in seconds. The conversion runs entirely in your browser, so your bank data is never uploaded to anyone’s server, including ours.',
    home: true,
    faq: faqCommon,
  },
  {
    slug: 'bank-statement-to-excel',
    title: 'Convert Bank Statement PDF to Excel (.xlsx), Free & Private',
    h1: 'Bank statement PDF to Excel',
    description: 'Turn a PDF bank statement into an Excel spreadsheet with Date, Description, Debit, Credit and Balance columns. Converted locally in your browser; nothing is uploaded.',
    lead: 'Get your transactions into Excel with proper date and number cells, ready for SUMIFS, pivot tables and budgeting, without copy-pasting from a PDF or uploading your statement to an unknown website.',
    body: `
<h2>How to convert a bank statement to Excel</h2>
<ol>
<li>Download your statement as a PDF from your bank’s website or app (not a photo or scan).</li>
<li>Drop it into the converter above. If the PDF is password-protected, enter the password when asked.</li>
<li>Check the summary: <strong>Balance check ✓</strong> means every row reconciles with the running balance.</li>
<li>Fix any highlighted rows directly in the table, then click <strong>Excel</strong> (Pro) or <strong>CSV</strong> (free; opens in Excel too).</li>
</ol>
<h2>What the spreadsheet contains</h2>
<table><thead><tr><th>Column</th><th>Contents</th></tr></thead><tbody>
<tr><td>Date</td><td>ISO date (YYYY-MM-DD). Excel recognises it as a real date.</td></tr>
<tr><td>Description</td><td>Merchant / narration, including wrapped second lines</td></tr>
<tr><td>Reference</td><td>Cheque or reference number when the statement has that column</td></tr>
<tr><td>Debit / Credit</td><td>Money out / money in as positive numbers</td></tr>
<tr><td>Amount</td><td>Signed amount (negative = money out), best for formulas</td></tr>
<tr><td>Balance</td><td>Running balance as printed on the statement</td></tr>
</tbody></table>
<h2>Why not just copy and paste from the PDF?</h2>
<p>Copying from a PDF usually produces one long column, merges amounts into descriptions, and loses which numbers are debits. StatementSheet reads the position of every word on the page to rebuild the columns, joins descriptions that wrap onto a second line, works out the statement year for dates like “Jan 05”, and verifies the result against the balance column.</p>
<h2>Why not an online converter that uploads the file?</h2>
<p>A bank statement contains your account number, address, salary, rent and spending history. Most converters upload it to their servers for processing. StatementSheet does the whole job inside your browser tab, so there is nothing to store, leak or sell.</p>`,
    faq: [
      ['Does the Excel file keep numbers as numbers?', 'Yes. Amounts and balances are numeric cells, not text, so formulas and pivot tables work immediately.'],
      ['Can I combine several months into one spreadsheet?', 'With Pro you can drop several statements at once; all transactions go into a single table and a single download.'],
      ...faqCommon.slice(0, 2),
    ],
  },
  {
    slug: 'bank-statement-to-csv',
    title: 'Bank Statement PDF to CSV Converter, Free, No Upload',
    h1: 'Bank statement PDF to CSV',
    description: 'Free bank statement PDF to CSV converter. Clean UTF-8 CSV with signed amounts and balances, ready for Google Sheets, budgeting apps and accounting software. Runs in your browser.',
    lead: 'CSV is the universal import format for Google Sheets, budgeting apps (YNAB, Actual, Firefly III) and accounting tools. Convert your PDF statement to a clean CSV for free, privately, in seconds.',
    body: `
<h2>The CSV format we produce</h2>
<p>The file is UTF-8 with a header row:</p>
<p><code>Date,Description,Reference,Debit,Credit,Amount,Balance</code></p>
<ul>
<li><strong>Date</strong> is ISO <code>YYYY-MM-DD</code>, the format almost every importer accepts without configuration.</li>
<li><strong>Amount</strong> is signed (negative = money out). Use it for apps that expect a single amount column.</li>
<li><strong>Debit / Credit</strong> are split columns for apps that expect them separately.</li>
<li>Descriptions that start with <code>=</code>, <code>+</code>, <code>-</code> or <code>@</code> are escaped so they can’t run as spreadsheet formulas.</li>
</ul>
<h2>Importing the CSV</h2>
<h3>Google Sheets</h3>
<p>File → Import → Upload → choose the CSV → “Replace current sheet” or “Insert new sheet”.</p>
<h3>Budgeting apps</h3>
<p>Map <em>Date → Date</em>, <em>Description → Payee/Memo</em>, and <em>Amount → Amount</em> (or Debit/Credit → Outflow/Inflow).</p>`,
    faq: [
      ['Is the CSV free?', 'Yes. CSV export is included in the free plan (3 statements a day, up to 10 pages each).'],
      ...faqCommon.slice(0, 3),
    ],
  },
  {
    slug: 'bank-statement-to-quickbooks',
    title: 'Convert PDF Bank Statement to QuickBooks (OFX / CSV) | StatementSheet',
    h1: 'Import a PDF bank statement into QuickBooks',
    description: 'QuickBooks can’t import PDF statements. Convert the PDF to OFX or CSV in your browser, then upload it to QuickBooks Online as bank transactions. Balance-checked, private.',
    lead: 'QuickBooks Online imports bank transactions from CSV, QBO, QFX and OFX files, but not from PDFs. When the bank feed is missing months or a bank can’t connect, convert the PDF statement and upload the file instead.',
    body: `
<h2>Step by step: PDF statement → QuickBooks Online</h2>
<ol>
<li>Convert the statement above and check that the <strong>Balance check</strong> shows ✓ (or fix the highlighted rows).</li>
<li>Download <strong>OFX</strong> (Pro) or <strong>CSV</strong> (free).</li>
<li>In QuickBooks Online go to <strong>Banking</strong> (or <em>Transactions → Bank transactions</em>) → <strong>Upload transactions</strong> / <strong>File upload</strong>.</li>
<li>Choose the file and the QuickBooks account it belongs to.</li>
<li>For CSV, map the columns: Date → Date, Description → Description, Amount → Amount (one column). The date format is <code>yyyy-MM-dd</code>.</li>
<li>Review the transactions in the <em>For review</em> tab and categorise or match them.</li>
</ol>
<p>Menu names differ slightly between QuickBooks versions and regions; look for “Upload transactions” or “Upload from file”.</p>
<h2>OFX vs CSV for QuickBooks</h2>
<p>OFX carries the transaction type, amount and a unique ID for every transaction, so QuickBooks can skip duplicates if you upload overlapping periods. CSV works everywhere but needs column mapping, and duplicates must be checked by hand.</p>
<h2>For bookkeepers and accountants</h2>
<p>Clients often send statements as PDFs. Converting them in the browser means client bank data never passes through a third-party conversion server. That makes it easier to meet your confidentiality obligations. Pro converts several statements in one go.</p>`,
    faq: [
      ['Does QuickBooks accept OFX files?', 'QuickBooks Online accepts CSV, QBO, QFX and OFX bank transaction files through its upload feature. QuickBooks Desktop prefers QBO/web-connect files. Use CSV there if OFX is rejected.'],
      ['Will uploading two overlapping statements create duplicates?', 'OFX files include a stable transaction ID per row, which helps QuickBooks recognise transactions it has already imported. With CSV, review the “For review” list for duplicates.'],
      ...faqCommon.slice(0, 2),
    ],
  },
  {
    slug: 'bank-statement-to-xero',
    title: 'Convert PDF Bank Statement for Xero Import (OFX, QIF, CSV)',
    h1: 'Import a PDF bank statement into Xero',
    description: 'Convert PDF bank statements into OFX, QIF or CSV files Xero can import as a manual statement. Private, in-browser conversion with running-balance checks.',
    lead: 'Xero’s manual statement import accepts OFX, QIF and CSV, but not PDF. Convert your statement here, then import it into the bank account in Xero.',
    body: `
<h2>Step by step: PDF statement → Xero</h2>
<ol>
<li>Convert your PDF above and make sure every row reconciles (✓).</li>
<li>Download <strong>OFX</strong> or <strong>QIF</strong> (Pro), or <strong>CSV</strong> (free).</li>
<li>In Xero, open <strong>Accounting → Bank accounts</strong>, find the account, then choose <strong>Manage account → Import a statement</strong>.</li>
<li>Upload the file. For CSV, map Date, Amount and Description (Payee) when Xero asks.</li>
<li>Reconcile the imported lines as usual.</li>
</ol>
<h2>Tips</h2>
<ul>
<li>Import each statement period once; Xero warns about statement lines it has already seen.</li>
<li>If the date format is reversed (e.g. 03/04 read as March 4 instead of 3 April), switch <em>Dates</em> between DD/MM and MM/DD in the converter before downloading.</li>
</ul>`,
    faq: [['Which format is best for Xero?', 'OFX is the most reliable because it needs no column mapping. CSV works too and is available on the free plan.'], ...faqCommon.slice(0, 3)],
  },
  {
    slug: 'credit-card-statement-to-excel',
    title: 'Credit Card Statement PDF to Excel / CSV Converter',
    h1: 'Credit card statement PDF to Excel',
    description: 'Convert credit card statement PDFs to Excel or CSV with correct signs: purchases as money out, payments and refunds as money in. Private, in-browser, free to try.',
    lead: 'Card statements list purchases as positive numbers and payments as negatives, the opposite of a bank account. StatementSheet detects card statements and flips the signs, so your spreadsheet or accounting import is right from the first try.',
    body: `
<h2>What’s different about credit card statements</h2>
<ul>
<li><strong>Two dates:</strong> transaction date and posting date. We keep the transaction date.</li>
<li><strong>No running balance:</strong> card statements rarely print a balance per row, so double-check totals against the statement summary.</li>
<li><strong>Year rollover:</strong> a statement from Dec 15 to Jan 14 shows dates like “12/28” and “01/03”. We assign the right year to each using the statement period.</li>
<li><strong>Signs:</strong> purchases become negative (money out), payments and refunds positive. Switch <em>Type</em> to “Bank account” if you prefer the issuer’s original signs.</li>
</ul>
<h2>Common uses</h2>
<p>Expense reports, splitting shared costs, finding forgotten subscriptions, importing card spending into QuickBooks/Xero (OFX export uses the credit-card account type), and tax-time categorisation.</p>`,
    faq: [['Can I import credit card transactions into QuickBooks?', 'Yes. Download OFX (Pro) and upload it to the credit card account in QuickBooks Online, or use the CSV with a single Amount column.'], ...faqCommon.slice(0, 2)],
  },
  {
    slug: 'password-protected-bank-statement-pdf',
    title: 'Convert a Password-Protected Bank Statement PDF to Excel',
    h1: 'Password-protected bank statement PDF to Excel',
    description: 'Many banks email statements as password-protected PDFs. Open and convert them to Excel or CSV in your browser; the password and file never leave your device.',
    lead: 'Many banks, especially in India, send e-statements as encrypted PDFs. Most online converters ask you to unlock the file first, or worse, to send them the password. Here you type it into your own browser, and it is used only to open the file locally.',
    body: `
<h2>How it works</h2>
<ol>
<li>Drop the protected PDF into the converter above.</li>
<li>When prompted, type the PDF password. It goes straight to the PDF reader running in your tab. It is never stored or transmitted.</li>
<li>Download the transactions as CSV or Excel.</li>
</ol>
<h2>Where do I find the password?</h2>
<p>Your bank sets it, and the format is usually explained in the email that carried the statement. It is often built from details like your date of birth, customer ID or part of your name. If you don’t know it, check that email or your bank’s help pages.</p>
<h2>Is it safe to type the password here?</h2>
<p>StatementSheet has no server-side processing at all. The page is static files, and the password is only held in memory while the file is opened. Closing the tab discards it.</p>`,
    faq: [['Do you store my PDF password?', 'No. It is used once to open the file inside your browser and is not saved, logged or sent anywhere.'], ...faqCommon.slice(0, 3)],
  },
  {
    slug: 'indian-bank-statement-to-excel',
    title: 'Indian Bank Statement PDF to Excel Converter (DD/MM, ₹, Password PDFs)',
    h1: 'Convert Indian bank statement PDFs to Excel',
    description: 'Convert Indian bank account statements (savings & current) from PDF to Excel or CSV. Handles DD/MM/YY dates, ₹ lakh-style amounts (1,25,000.00), Cr/Dr markers and password-protected e-statements.',
    lead: 'Indian bank statements have their own quirks: DD/MM/YY dates, lakh-style digit grouping like 1,25,000.00, separate Withdrawal and Deposit columns, value dates and cheque/ref numbers, and password-protected PDFs. StatementSheet handles all of them, and the file never leaves your device.',
    body: `
<h2>What we handle</h2>
<ul>
<li><strong>Dates:</strong> DD/MM/YY, DD/MM/YYYY, DD-Mon-YYYY; the value-date column is ignored and the transaction date kept.</li>
<li><strong>Amounts:</strong> Indian digit grouping (1,25,000.00), “Cr”/“Dr” suffixes, separate Withdrawal Amt. / Deposit Amt. columns.</li>
<li><strong>Narration & Chq./Ref. No.</strong> are separated into Description and Reference columns.</li>
<li><strong>Closing balance check:</strong> each row is reconciled against the closing balance column.</li>
<li><strong>Password-protected e-statements:</strong> enter the password in your browser; it is never uploaded.</li>
</ul>
<h2>Useful for</h2>
<p>ITR preparation, GST reconciliation, loan applications, tracking UPI spending, and handing statements to your CA in Excel format, without sending your bank data to a third-party server.</p>`,
    faq: [['Is my statement sent to any server?', 'No. Conversion happens inside your browser. This matters for Indian statements that contain PAN-linked account details.'], ...faqCommon.slice(1, 4)],
  },
  {
    slug: 'guides/is-it-safe-to-upload-bank-statements-online',
    title: 'Is It Safe to Upload Bank Statements to Online Converters?',
    h1: 'Is it safe to upload your bank statement to an online converter?',
    description: 'What happens to your bank statement when you upload it to a PDF converter, what the risks are, and how to convert statements without uploading them at all.',
    lead: 'A bank statement is one of the most sensitive documents you own. Before you drop one into a free online converter, it’s worth knowing where it goes.',
    guide: true,
    body: `
<h2>What a statement reveals</h2>
<ul>
<li>Full name, postal address and often phone or email</li>
<li>Account number and sort code / IFSC / routing information</li>
<li>Your employer and salary, rent or mortgage, loans and insurers</li>
<li>Where you shop, travel and spend time, transaction by transaction</li>
</ul>
<p>That’s enough for targeted phishing, social engineering of your bank, and identity fraud.</p>
<h2>What usually happens when you upload</h2>
<p>Most “PDF to Excel” websites send your file to their servers, where it is processed (sometimes by third-party OCR or AI APIs), stored for some period, and covered by a privacy policy you probably didn’t read. Even well-meaning services can be breached, misconfigured or acquired.</p>
<h2>Questions to ask before uploading</h2>
<ol>
<li>Where is the file processed, and by whom (including sub-processors)?</li>
<li>How long is it kept, and is deletion automatic?</li>
<li>Is it used to train models or improve the service?</li>
<li>Which country is the data stored in?</li>
</ol>
<h2>The alternative: convert without uploading</h2>
<p>Modern browsers can read PDFs locally. StatementSheet runs the whole conversion in your browser tab. The page loads once, then your statement is opened, parsed and exported on your own device. You can disconnect from the internet after the page loads and it keeps working.</p>
<h2>Limits of local conversion</h2>
<p>Local conversion reads the text layer of digital PDFs. Scanned paper statements need OCR, which we don’t offer yet. If you must use an OCR service for scans, prefer one that states its retention period and doesn’t use your data for training.</p>`,
    faq: [],
  },
  {
    slug: 'guides/check-bank-statement-conversion-accuracy',
    title: 'How to Check a Bank Statement PDF Conversion Is Accurate',
    h1: 'How to check that a converted bank statement is accurate',
    description: 'Use running-balance reconciliation and totals to verify a PDF-to-Excel bank statement conversion: the checks accountants use, with Excel formulas.',
    lead: 'Any PDF converter can misread a row: a wrapped description, a missing minus sign, an amount in the wrong column. These checks catch those errors in a couple of minutes.',
    guide: true,
    body: `
<h2>1. Running-balance check (the strongest test)</h2>
<p>If the statement prints a balance after each transaction, every row must satisfy:</p>
<p><code>previous balance + amount = balance</code></p>
<p>In Excel, with Amount in column F and Balance in column G (data from row 2):</p>
<p><code>=IF(ROUND(G2+F3-G3,2)=0,"OK","CHECK")</code> in H3, filled down.</p>
<p>A sign error shows up immediately because the difference is exactly twice the amount. StatementSheet runs this check automatically and fixes those sign errors for you.</p>
<h2>2. Totals check</h2>
<p>Most statements print total withdrawals and deposits in a summary box. Compare them with <code>=SUMIF(F:F,"&lt;0")</code> and <code>=SUMIF(F:F,"&gt;0")</code>.</p>
<h2>3. Opening + net = closing</h2>
<p><code>opening balance + SUM(Amount) = closing balance</code>. If this holds, no transaction is missing or duplicated.</p>
<h2>4. Count check</h2>
<p>Spot-check the number of rows on the first and last page against the PDF, especially around page breaks where headers and “continued” lines appear.</p>
<h2>5. Dates</h2>
<p>For statements that show only day and month, make sure December transactions on a January statement got the previous year. Also check that 03/04 means what your bank intends (3 April vs March 4).</p>`,
    faq: [],
  },
];

export const legal = {
  privacy: `
<p><em>Last updated: 9 November 2026</em></p>
<h2>The short version</h2>
<p>Your statements never leave your device. StatementSheet converts PDFs entirely inside your web browser. We do not receive, store or see your files, their text, your transactions or PDF passwords.</p>
<h2>What we do process</h2>
<ul>
<li><strong>Hosting logs.</strong> Our static hosting provider may log standard request data (IP address, user agent, pages requested) for security and operations, under its own privacy policy.</li>
<li><strong>Analytics (if enabled).</strong> We may use privacy-friendly, cookie-less analytics (GoatCounter) to count page views and anonymous events such as “conversion succeeded” or “CSV downloaded”. These events never include file names, file contents or amounts.</li>
<li><strong>Purchases.</strong> Payments are handled by Lemon Squeezy, our merchant of record. They process your name, email, billing address and payment details under their privacy policy. We receive your email and order details so we can provide support.</li>
<li><strong>License checks.</strong> When you activate Pro, your browser sends your license key and a device label directly to Lemon Squeezy’s license API to verify it.</li>
<li><strong>Local storage.</strong> Your browser stores your license key and a daily free-conversion counter in localStorage on your device. Clear your site data to remove them.</li>
</ul>
<h2>What we don’t do</h2>
<ul><li>No cookies for advertising or tracking.</li><li>No selling or sharing of personal data.</li><li>No AI/ML training on your data. We never have your data.</li></ul>
<h2>Your rights</h2>
<p>Under GDPR, UK GDPR, India’s DPDP Act and similar laws you may request access to or deletion of personal data we hold (in practice, purchase records). Contact us via the <a href="{{base}}support/">support page</a>.</p>
<h2>Changes</h2>
<p>We will update this page and its date if anything changes.</p>`,
  terms: `
<p><em>Last updated: 9 November 2026</em></p>
<h2>1. The service</h2>
<p>StatementSheet is browser-based software that converts PDF bank and credit card statements into spreadsheet and accounting file formats. Conversion runs on your device.</p>
<h2>2. Accuracy and your responsibility</h2>
<p>PDF layouts vary widely and automated extraction can make mistakes. The software provides reconciliation checks to help you find errors, but <strong>you are responsible for reviewing converted data before relying on it</strong> for accounting, tax, lending or legal purposes. The service is provided “as is”, without warranties of any kind, to the extent permitted by law.</p>
<h2>3. Acceptable use</h2>
<p>Use StatementSheet only with statements you are entitled to access. Do not attempt to bypass licensing or usage limits, or to resell the service.</p>
<h2>4. Pro subscriptions</h2>
<ul>
<li>Pro is sold by our reseller and merchant of record, Lemon Squeezy, which processes payments, taxes and invoices.</li>
<li>Subscriptions renew automatically until cancelled. You can cancel at any time from the billing portal link in your receipt email; Pro remains active until the end of the paid period.</li>
<li><strong>Refunds:</strong> if Pro doesn’t work for your statements, request a refund within 14 days of purchase via the support page and we will refund you in full.</li>
<li>A license may be used by one person on up to 3 browsers/devices.</li>
</ul>
<h2>5. Limitation of liability</h2>
<p>To the extent permitted by law, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.</p>
<h2>6. Changes</h2>
<p>We may update these terms; material changes will be shown on this page with a new date.</p>`,
};
