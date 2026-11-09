// Generates synthetic (clearly fictional) bank statement PDFs used only as test fixtures,
// together with the expected transactions for each one.
// Run: node scripts/make-fixtures.mjs
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../tests/fixtures/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const fmtUS = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtIN = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round = (n) => Math.round(n * 100) / 100;

async function render(name, { title, meta, columns, rows, rowsPerPage = 18, footer = true }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) pages.push(rows.slice(i, i + rowsPerPage));
  pages.forEach((pageRows, pi) => {
    const page = doc.addPage([612, 792]);
    let y = 750;
    page.drawText(title, { x: 40, y, size: 14, font: bold });
    y -= 18;
    for (const m of meta) { page.drawText(m, { x: 40, y, size: 9, font }); y -= 12; }
    y -= 10;
    for (const c of columns) {
      const w = bold.widthOfTextAtSize(c.label, 8);
      const x = c.align === 'right' ? c.x - w : c.x;
      page.drawText(c.label, { x, y, size: 8, font: bold });
    }
    y -= 4;
    page.drawLine({ start: { x: 36, y }, end: { x: 576, y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    y -= 14;
    for (const r of pageRows) {
      const lines = Math.max(...columns.map((c) => (Array.isArray(r[c.key]) ? r[c.key].length : 1)));
      for (let li = 0; li < lines; li++) {
        for (const c of columns) {
          let v = r[c.key];
          if (Array.isArray(v)) v = v[li];
          else if (li > 0) v = undefined;
          if (v === undefined || v === '') continue;
          const w = font.widthOfTextAtSize(String(v), 8);
          const x = c.align === 'right' ? c.x - w : c.x;
          page.drawText(String(v), { x, y, size: 8, font });
        }
        y -= 12;
      }
    }
    if (footer) page.drawText(`Page ${pi + 1} of ${pages.length}`, { x: 280, y: 30, size: 8, font });
  });
  writeFileSync(new URL(`${name}.pdf`, OUT), await doc.save());
}

// ---------- 1. US checking: Date | Description | Withdrawals | Deposits | Balance ----------
{
  let bal = 2450.0;
  const raw = [
    ['01/02', ['ACH DEPOSIT ACME PAYROLL', 'PPD ID 9876543210'], 0, 3120.55],
    ['01/03', ['DEBIT CARD PURCHASE', 'COFFEE HOUSE SEATTLE WA'], 6.75, 0],
    ['01/05', ['ONLINE TRANSFER TO SAVINGS'], 500, 0],
    ['01/07', ['CHECK #1042'], 1250, 0],
    ['01/09', ['ELECTRIC UTILITY AUTOPAY'], 142.18, 0],
    ['01/10', ['ZELLE FROM J SMITH'], 0, 75],
    ['01/12', ['GROCERY MARKET #221'], 89.43, 0],
    ['01/14', ['GAS STATION 4410'], 41.02, 0],
    ['01/15', ['ACH DEPOSIT ACME PAYROLL'], 0, 3120.55],
    ['01/16', ['RENT PAYMENT', 'OAK STREET APTS'], 1850, 0],
    ['01/18', ['STREAMING SVC'], 15.99, 0],
    ['01/19', ['ATM WITHDRAWAL', '123 MAIN ST'], 100, 0],
    ['01/20', ['PHARMACY 0098'], 23.5, 0],
    ['01/21', ['INTEREST PAYMENT'], 0, 0.42],
    ['01/22', ['RESTAURANT BILL'], 64.8, 0],
    ['01/23', ['PHONE CARRIER'], 70, 0],
    ['01/24', ['REFUND ONLINE STORE'], 0, 34.99],
    ['01/25', ['INSURANCE PREMIUM'], 210.33, 0],
    ['01/26', ['GROCERY MARKET #221'], 120.07, 0],
    ['01/27', ['GYM MEMBERSHIP'], 39.99, 0],
    ['01/28', ['BOOKSTORE'], 18.25, 0],
    ['01/29', ['TRANSFER FROM SAVINGS'], 0, 300],
    ['01/30', ['WATER UTILITY'], 48.6, 0],
    ['01/31', ['MONTHLY SERVICE FEE'], 12, 0],
  ];
  const expected = [];
  const rows = [{ date: '', desc: 'Beginning Balance', bal: fmtUS(bal) }];
  for (const [d, desc, wd, dep] of raw) {
    bal = round(bal - wd + dep);
    rows.push({ date: d, desc, wd: wd ? fmtUS(wd) : '', dep: dep ? fmtUS(dep) : '', bal: fmtUS(bal) });
    expected.push({ date: `2025-${d.slice(0, 2)}-${d.slice(3)}`, description: desc.join(' '), amount: round(dep - wd), balance: bal });
  }
  await render('us-checking', {
    title: 'Example Community Bank (SAMPLE - NOT A REAL BANK)',
    meta: ['Account Number: XXXXXX4821', 'Statement Period: January 1, 2025 through January 31, 2025', 'Everyday Checking'],
    columns: [
      { key: 'date', label: 'Date', x: 40 },
      { key: 'desc', label: 'Description', x: 90 },
      { key: 'wd', label: 'Withdrawals', x: 400, align: 'right' },
      { key: 'dep', label: 'Deposits', x: 480, align: 'right' },
      { key: 'bal', label: 'Balance', x: 570, align: 'right' },
    ],
    rows,
    rowsPerPage: 14,
  });
  writeFileSync(new URL('us-checking.json', OUT), JSON.stringify(expected, null, 2));
}

// ---------- 2. Indian savings: Date | Narration | Chq/Ref | Value Dt | Withdrawal | Deposit | Closing Balance ----------
{
  let bal = 125000.0;
  const raw = [
    ['01/04/25', 'UPI-SWIGGY-PAYTM', '0000509112345678', 450, 0],
    ['03/04/25', 'NEFT CR-ACME TECH PVT LTD-SALARY', 'N093250012345', 0, 185000],
    ['05/04/25', 'ATW-ATM CASH WDL', '000000004521', 10000, 0],
    ['07/04/25', 'UPI-ELECTRICITY BOARD', '0000509712345671', 2340.5, 0],
    ['13/04/25', 'IMPS-RENT-LANDLORD', '0000510312345672', 32000, 0],
    ['15/04/25', 'SIP MUTUAL FUND', '0000510512345673', 15000, 0],
    ['18/04/25', 'INT.PD:XXXX4821', '000000000000', 0, 812.33],
    ['21/04/25', 'POS AMAZON PAY INDIA', '0000511112345674', 1299, 0],
    ['25/04/25', 'UPI-FRIEND-SPLIT', '0000511512345675', 0, 1500],
    ['28/04/25', 'EMI HOME LOAN', '0000511812345676', 48250, 0],
  ];
  const expected = [];
  const rows = [];
  for (const [d, desc, ref, wd, dep] of raw) {
    bal = round(bal - wd + dep);
    rows.push({ date: d, desc, ref, vdt: d, wd: wd ? fmtIN(wd) : '', dep: dep ? fmtIN(dep) : '', bal: fmtIN(bal) });
    expected.push({ date: `20${d.slice(6)}-${d.slice(3, 5)}-${d.slice(0, 2)}`, description: desc, amount: round(dep - wd), balance: bal });
  }
  await render('in-savings', {
    title: 'Sample Bharat Bank Ltd (SAMPLE - NOT A REAL BANK)',
    meta: ['Statement of account From : 01/04/2025 To : 30/04/2025', 'A/C No: XXXXXXXX4821  Currency: INR', 'Opening Balance: 1,25,000.00'],
    columns: [
      { key: 'date', label: 'Date', x: 40 },
      { key: 'desc', label: 'Narration', x: 82 },
      { key: 'ref', label: 'Chq./Ref.No.', x: 230 },
      { key: 'vdt', label: 'Value Dt', x: 318 },
      { key: 'wd', label: 'Withdrawal Amt.', x: 430, align: 'right' },
      { key: 'dep', label: 'Deposit Amt.', x: 500, align: 'right' },
      { key: 'bal', label: 'Closing Balance', x: 574, align: 'right' },
    ],
    rows,
  });
  writeFileSync(new URL('in-savings.json', OUT), JSON.stringify(expected, null, 2));
}

// ---------- 3. UK signed single amount: Date | Description | Amount | Balance ----------
{
  let bal = 1520.4;
  const raw = [
    ['03 Feb 2025', 'CARD PAYMENT TO TESCO STORES', -45.2],
    ['04 Feb 2025', 'DIRECT DEBIT COUNCIL TAX', -158],
    ['06 Feb 2025', 'FASTER PAYMENT RECEIVED J DOE', 250],
    ['10 Feb 2025', 'STANDING ORDER SAVINGS POT', -300],
    ['14 Feb 2025', 'SALARY WIDGET LTD', 2400],
    ['17 Feb 2025', 'CARD PAYMENT TO TRAINLINE', -62.35],
    ['21 Feb 2025', 'DIRECT DEBIT MOBILE', -18],
    ['27 Feb 2025', 'CASH WITHDRAWAL', -1200],
  ];
  const expected = [];
  const rows = [];
  for (const [d, desc, amt] of raw) {
    bal = round(bal + amt);
    rows.push({ date: d, desc, amt: (amt < 0 ? '-' : '') + fmtUS(Math.abs(amt)), bal: fmtUS(bal) });
    const [dd, mon, yyyy] = d.split(' ');
    expected.push({ date: `${yyyy}-02-${dd}`, description: desc, amount: amt, balance: bal, _mon: mon });
  }
  await render('uk-signed', {
    title: 'Sample Building Society (SAMPLE - NOT A REAL BANK)',
    meta: ['Sort code 00-00-00  Account 12345678', 'Your statement: 1 February 2025 - 28 February 2025'],
    columns: [
      { key: 'date', label: 'Date', x: 40 },
      { key: 'desc', label: 'Description', x: 110 },
      { key: 'amt', label: 'Amount (GBP)', x: 470, align: 'right' },
      { key: 'bal', label: 'Balance (GBP)', x: 570, align: 'right' },
    ],
    rows,
    footer: false,
  });
  writeFileSync(new URL('uk-signed.json', OUT), JSON.stringify(expected.map(({ _mon, ...e }) => e), null, 2));
}

// ---------- 4. Credit card: Trans Date | Post Date | Description | Amount (no balance) ----------
{
  const raw = [
    ['12/28', '12/29', 'AIRLINE TICKETS', 412.6],
    ['12/30', '12/31', 'HOTEL BOOKING', 289],
    ['01/02', '01/03', 'PAYMENT THANK YOU', -800],
    ['01/04', '01/05', 'GROCERY MARKET', 54.12],
    ['01/08', '01/09', 'SOFTWARE SUBSCRIPTION', 12],
  ];
  const expected = [];
  const rows = [];
  for (const [td, pd, desc, amt] of raw) {
    rows.push({ td, pd, desc, amt: (amt < 0 ? '-$' : '$') + fmtUS(Math.abs(amt)) });
    const yr = td.startsWith('12') ? 2024 : 2025;
    // For a card statement, purchases are money out (negative), payments are money in (positive).
    expected.push({ date: `${yr}-${td.slice(0, 2)}-${td.slice(3)}`, description: desc, amount: -amt });
  }
  await render('credit-card', {
    title: 'Sample Rewards Card (SAMPLE - NOT A REAL ISSUER)',
    meta: ['Opening/Closing Date 12/15/24 - 01/14/25', 'Account ending 4821'],
    columns: [
      { key: 'td', label: 'Trans Date', x: 40 },
      { key: 'pd', label: 'Post Date', x: 100 },
      { key: 'desc', label: 'Description', x: 160 },
      { key: 'amt', label: 'Amount', x: 570, align: 'right' },
    ],
    rows,
    footer: false,
  });
  writeFileSync(new URL('credit-card.json', OUT), JSON.stringify(expected, null, 2));
}

// ---------- 5. A non-statement PDF (negative test) ----------
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText('Meeting notes. Nothing financial here at all.', { x: 40, y: 700, size: 12, font });
  writeFileSync(new URL('not-a-statement.pdf', OUT), await doc.save());
}
console.log('fixtures written');
