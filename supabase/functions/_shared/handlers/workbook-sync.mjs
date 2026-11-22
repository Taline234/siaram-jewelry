// POST /functions/v1/workbook-sync — called every 10 minutes by the database (see supabase/cron.sql).
// Keeps the finance workbook in Google Sheets up to date with website orders and sales recorded on the account page:
//   - each new piece sold becomes a row in the Sales tab (columns A to Z; formula columns are never touched),
//   - each new customer becomes a row in the Customers tab (matched by name, like the workbook does),
//   - Cash Received Now is filled in once a website order is delivered,
//   - the rows of a cancelled order are removed.
// Rows are matched by invoice number and SKU, so rows pasted by hand from the download are never added twice,
// and anything you type in the sheet yourself is left as it is. If a copy fails, you get one email saying why.
import { configured, emailLayout, env, escapeHtml, json, rpc, sendEmail } from '../store.mjs';
import { customerRows, salesRows } from '../workbook.mjs';
import { deleteRows, googleToken, readRange, sheetsConfigured, tab, tabIds, writeRanges } from '../google-sheets.mjs';

// Sales columns the website fills (0 = A). The others hold the workbook's formulas or your own entries.
const SALES_BLOCKS = [[0, 4], [6, 9], [11, 12], [24, 25]];
const NUMERIC = new Set([6, 7, 9, 12, 25]);
const CASH = 12; // M, Cash Received Now
const SKU = 4;   // E
const CUSTOMER_BLOCKS = [[0, 1], [3, 4], [6, 6]]; // Name, Phone · Email, Address · How They Found Us

const letter = (c) => String.fromCharCode(65 + c);
const number = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
// Text that Sheets would read as a formula is kept as text.
const safeText = (v) => (/^[=+\-@]/.test(String(v ?? '')) ? `'${v}` : String(v ?? ''));

function salesCell(v, c) {
  if (NUMERIC.has(c) && v !== '' && v != null) return Number(v);
  if (c === 1) return v || '';
  return safeText(v);
}

// The row (0-based) whose first cell is the heading, or an error naming the tab.
function headingRow(rows, heading, tabName) {
  const at = rows.slice(0, 30).findIndex((r) => String(r[0] || '').trim().toLowerCase() === heading.toLowerCase());
  if (at < 0) throw new Error(`The ${tabName} tab has no "${heading}" heading in column A.`);
  return at;
}

const blocksFor = (tabName, row, values, blocks, cell = (v) => v) => blocks.map(([from, to]) => ({
  range: `${tab(tabName)}!${letter(from)}${row}:${letter(to)}${row}`,
  values: [values.slice(from, to + 1).map((v, i) => cell(v, from + i))],
}));

export async function syncWorkbook(orders, token) {
  const salesTab = env('WORKBOOK_SALES_TAB') || 'Sales';
  const customersTab = env('WORKBOOK_CUSTOMERS_TAB') || 'Customers';
  const writes = [];
  const result = { added: 0, updated: 0, removed: 0, customers: 0 };

  // ---- Sales
  const sales = await readRange(token, `${tab(salesTab)}!A1:Z`);
  const head = headingRow(sales, 'Invoice #', salesTab);
  const byKey = new Map();     // "S017|NK-07" -> [{ row, cash }]
  const byInvoice = new Map(); // "S017" -> [row]
  let last = head + 1;         // 1-based number of the last row in use
  sales.forEach((r, i) => {
    const invoice = String(r[0] || '').trim();
    if (i <= head || !invoice) return;
    const row = i + 1;
    last = Math.max(last, row);
    const key = `${invoice}|${String(r[SKU] || '').trim()}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ row, cash: r[CASH] });
    if (!byInvoice.has(invoice)) byInvoice.set(invoice, []);
    byInvoice.get(invoice).push(row);
  });

  const remove = [];
  for (const order of orders) {
    if (order.status === 'cancelled') {
      remove.push(...(byInvoice.get(order.reference) || []));
      continue;
    }
    const used = new Map();
    for (const line of salesRows([order]).slice(1)) {
      const key = `${line[0]}|${line[SKU]}`;
      const n = used.get(key) || 0;
      used.set(key, n + 1);
      const existing = (byKey.get(key) || [])[n];
      if (existing) {
        // Fill in the cash once it has been received, unless an amount is already there.
        if (number(line[CASH]) > 0 && number(existing.cash) === 0) {
          writes.push({ range: `${tab(salesTab)}!M${existing.row}`, values: [[Number(line[CASH])]] });
          result.updated += 1;
        }
        continue;
      }
      last += 1;
      writes.push(...blocksFor(salesTab, last, line, SALES_BLOCKS, salesCell));
      result.added += 1;
    }
  }

  // ---- Customers
  const customers = await readRange(token, `${tab(customersTab)}!A1:A`);
  const nameHead = headingRow(customers, 'Name', customersTab);
  const known = new Set();
  let lastCustomer = nameHead + 1;
  customers.forEach((r, i) => {
    const name = String(r[0] || '').trim().toLowerCase();
    if (i <= nameHead || !name) return;
    known.add(name);
    lastCustomer = Math.max(lastCustomer, i + 1);
  });
  for (const row of customerRows(orders.filter((o) => o.status !== 'cancelled')).slice(1)) {
    const name = String(row[0] || '').trim().toLowerCase();
    if (!name || known.has(name)) continue;
    known.add(name);
    lastCustomer += 1;
    // A phone number starting with + or 0 stays text, as typed.
    writes.push(...blocksFor(customersTab, lastCustomer, row, CUSTOMER_BLOCKS,
      (v, c) => (c === 1 && v ? `'${v}` : safeText(v))));
    result.customers += 1;
  }

  await writeRanges(token, writes);
  if (remove.length) {
    const ids = await tabIds(token);
    await deleteRows(token, ids[salesTab], remove);
    result.removed = new Set(remove).size;
  }
  return result;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Not set up.' }, 503);
  const secret = req.headers.get('x-cron-secret') || '';
  if (!secret || !(await rpc('cron_secret_ok', { p_secret: secret }))) return json({ error: 'Not allowed.' }, 403);
  if (!sheetsConfigured()) return json({ skipped: 'Google Sheets secrets not set.' });
  if (!(await rpc('claim_workbook_sync', {}))) return json({ skipped: 'Already running.' });

  try {
    const result = await syncWorkbook(await rpc('workbook_orders', {}), await googleToken());
    await rpc('finish_workbook_sync', { p_error: '' });
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('workbook-sync', err);
    const previous = await rpc('finish_workbook_sync', { p_error: message }).catch(() => message);
    if (!previous) {
      await sendEmail({
        to: env('ORDER_NOTIFY_EMAIL'),
        subject: 'The workbook could not be updated',
        html: emailLayout('The workbook could not be updated',
          `<p style="font-size:15px;line-height:1.6">The website could not copy the latest sales into your Google Sheets
           workbook. It tries again every 10 minutes, and nothing is lost in the meantime.</p>
           <p style="font-size:15px;line-height:1.6">The reason Google gave: <strong>${escapeHtml(message)}</strong></p>
           <p style="font-size:15px;line-height:1.6">See "Finance workbook in Google Sheets" in STORE-SETUP.md. You won't get
           this email again until it has worked once.</p>`),
      });
    }
    return json({ error: message }, 500);
  }
};
