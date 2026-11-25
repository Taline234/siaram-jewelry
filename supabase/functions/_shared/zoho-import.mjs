// Imports the finance workbook (Google Sheets) into Zoho, once, when the owner clicks "Import my workbook":
//   Customers tab     -> Zoho customers (name, phone, email, address, how they found us)
//   Suppliers tab     -> Zoho vendors (and anyone paid on the Expenses tab)
//   Sales tab         -> Zoho invoices with the same numbers (S001, SC001...), each with its payment
//   Expenses tab      -> Zoho Books expenses, by category (Gold = cost of goods sold), paid in cash
//   Payments tab      -> owner investment / withdrawal as journal entries (owner's equity <-> cash)
// Past sales are invoiced by name and price, without touching stock: Zoho's stock follows the website's.
// It runs in portions within zoho-sync (Zoho allows about 100 calls a minute) and records everything it creates,
// so a portion that stops halfway is finished by the next one and nothing is added twice.
import { env, rpc } from './store.mjs';
import { CATALOGUE } from './catalogue.mjs';
import { googleToken, readRange, sheetsConfigured, tab } from './google-sheets.mjs';
import { ZohoError, zoho, zohoCalls } from './zoho.mjs';

const BUDGET = 70; // Zoho calls per portion

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// "07-Nov-2025", "7 Nov 2025" or "2025-11-07" -> "2025-11-07"
export function isoDate(value) {
  const v = String(value ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/](\d{4})$/.exec(v);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
export const amount = (value) => {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const text = (v) => String(v ?? '').trim();

// Reads a tab from its heading row down, checking the heading so a moved column is noticed, not imported wrongly.
async function readTab(token, name, firstHeading, lastColumn) {
  const rows = await readRange(token, `${tab(name)}!A1:${lastColumn}`);
  const head = rows.findIndex((r) => text(r[0]).toLowerCase() === firstHeading.toLowerCase());
  if (head < 0) throw new ZohoError(`The ${name} tab has no "${firstHeading}" heading in column A.`);
  return rows.slice(head + 1).filter((r) => text(r[0]));
}

export async function readWorkbook() {
  if (!sheetsConfigured()) throw new ZohoError('The Google Sheets workbook is not connected (see "Finance workbook in Google Sheets").');
  const token = await googleToken();
  const [customers, suppliers, sales, expenses, payments] = await Promise.all([
    readTab(token, 'Customers', 'Name', 'H'),
    readTab(token, 'Suppliers', 'Supplier Name', 'E'),
    readTab(token, 'Sales', 'Invoice #', 'AA'),
    readTab(token, 'Expenses', 'Date', 'I'),
    readTab(token, 'Payments', 'Payment ID (auto)', 'J'),
  ]);
  return { customers, suppliers, sales, expenses, payments };
}

const EXPENSE_ACCOUNT = {
  gold: 'Cost of Goods Sold', stones: 'Cost of Goods Sold', labour: 'Cost of Goods Sold',
  packaging: 'Packaging', advertising: 'Advertising And Marketing', marketing: 'Advertising And Marketing',
  website: 'IT and Internet Expenses', miscellaneous: 'Other Expenses',
};
const PAYMENT_MODE = { cash: 'Cash', card: 'Credit Card', 'bank transfer': 'Bank Transfer', whish: 'Bank Transfer' };

// The Zoho Books accounts the import needs, creating "Packaging" if it is not there yet.
async function accounts(done) {
  const list = (await zoho('GET', 'chartofaccounts', { app: 'books', query: { per_page: 200 } })).chartofaccounts || [];
  const byName = Object.fromEntries(list.map((a) => [a.account_name.toLowerCase(), String(a.account_id)]));
  const first = (type) => String((list.find((a) => a.account_type === type) || {}).account_id || '');
  if (!byName.packaging) {
    if (done['account:Packaging']) byName.packaging = done['account:Packaging'];
    else {
      const made = (await zoho('POST', 'chartofaccounts', { app: 'books', body: { account_name: 'Packaging', account_type: 'expense',
        description: 'Pouches, boxes, bags and cards for the pieces.' } })).chart_of_account;
      byName.packaging = String(made.account_id);
      await rpc('zoho_save_import', { p_kind: 'account', p_key: 'Packaging', p_zoho_id: byName.packaging });
    }
  }
  return {
    expense: (category) => byName[(EXPENSE_ACCOUNT[text(category).toLowerCase()] || 'Other Expenses').toLowerCase()]
      || byName['other expenses'] || first('expense'),
    cash: byName['petty cash'] || first('cash'),
    equity: byName["owner's equity"] || byName['owners equity'] || first('equity'),
    drawings: byName.drawings || byName["owner's equity"] || first('equity'),
  };
}

async function findOrCreate(kind, name, create, done, search) {
  const key = `${kind}:${name.toLowerCase()}`;
  if (done[key]) return done[key];
  const found = (await zoho('GET', 'contacts', { app: 'books', query: search })).contacts
    ?.find((c) => text(c.contact_name).toLowerCase() === name.toLowerCase() && (!c.contact_type || c.contact_type === kind));
  const id = String(found ? found.contact_id : (await zoho('POST', 'contacts', { app: 'books', body: create })).contact.contact_id);
  done[key] = id;
  await rpc('zoho_save_import', { p_kind: kind, p_key: name.toLowerCase(), p_zoho_id: id });
  return id;
}

function customerBody(name, row = []) {
  const [first, ...rest] = name.split(/\s+/);
  const notes = [row[2] && `Instagram: ${text(row[2])}`, row[5] && `Birthday: ${text(row[5])}`,
    row[6] && `Found us through: ${text(row[6])}`, text(row[7])].filter(Boolean).join('\n');
  return {
    contact_name: name, contact_type: 'customer',
    billing_address: text(row[4]) ? { address: text(row[4]) } : undefined,
    contact_persons: [{ first_name: first, last_name: rest.join(' '), email: text(row[3]) || undefined,
      phone: text(row[1]) || undefined, is_primary_contact: true }],
    notes: notes || 'Imported from the Siaram finance workbook.',
  };
}

const customer = (name, row, done) => findOrCreate('customer', name, customerBody(name, row), done, { contact_name: name });
const vendor = (name, row, done) => {
  const [first, ...rest] = text(row?.[1] || name).split(/\s+/);
  return findOrCreate('vendor', name, {
    contact_name: name, contact_type: 'vendor',
    contact_persons: [{ first_name: first, last_name: rest.join(' '), phone: text(row?.[2]) || undefined,
      email: text(row?.[3]) || undefined, is_primary_contact: true }],
    notes: text(row?.[4]) || 'Imported from the Siaram finance workbook.',
  }, done, { contact_name: name });
};

// One invoice per invoice number on the Sales tab, with its payment.
async function importInvoice(number, lines, ids, done) {
  const first = lines[0];
  const name = text(first[2]);
  const customerId = await customer(name, ids.customerRows[name.toLowerCase()], done);
  const date = isoDate(first[1]);
  if (!date) throw new ZohoError(`${number}: the sale date "${text(first[1])}" is not a date.`);
  const voucher = lines.reduce((s, r) => s + amount(r[25]), 0);
  const body = {
    customer_id: customerId, invoice_number: number, date, reference_number: text(first[3]) || 'In Person',
    line_items: lines.map((r) => {
      const sku = text(r[4]);
      const qty = Number(text(r[6])) || 1;
      const total = amount(r[10]) || amount(r[7]) * qty;
      const piece = CATALOGUE[sku];
      return {
        name: piece ? piece.name : (/^C/.test(sku) ? `Custom piece ${sku}` : sku),
        description: [`SKU ${sku}`, text(r[26]) && `custom order ${text(r[26])}`].filter(Boolean).join(', '),
        rate: Math.round((total / qty) * 100) / 100, quantity: qty,
      };
    }),
    notes: 'Imported from the Siaram finance workbook.',
  };
  if (voucher > 0) {
    body.adjustment = -voucher;
    body.adjustment_description = `Gift voucher ${lines.map((r) => text(r[24])).filter(Boolean)[0] || ''}`.trim();
  }
  let invoice;
  try {
    invoice = (await zoho('POST', 'invoices', { app: 'books', body, query: { ignore_auto_number_generation: 'true' } })).invoice;
  } catch (err) {
    invoice = (await zoho('GET', 'invoices', { app: 'books', query: { invoice_number: number } })).invoices
      ?.find((i) => i.invoice_number === number);
    if (!invoice) throw err;
  }
  await zoho('POST', `invoices/${invoice.invoice_id}/status/sent`, { app: 'books' }).catch(() => {});
  const paid = Math.round((Number(invoice.total ?? 0) || lines.reduce((s, r) => s + amount(r[10]), 0) - voucher) * 100) / 100;
  if (paid > 0 && Number(invoice.balance ?? paid) > 0) {
    await zoho('POST', 'customerpayments', { app: 'books', body: {
      customer_id: customerId, payment_mode: PAYMENT_MODE[text(first[11]).toLowerCase()] || 'Cash', amount: paid, date,
      reference_number: number, description: 'Imported from the Siaram finance workbook.',
      invoices: [{ invoice_id: invoice.invoice_id, amount_applied: paid }],
    } });
  }
  return String(invoice.invoice_id);
}

// Owner investment / withdrawal rows on the Payments tab -> journal entries. False when the call budget ran out.
async function ownerMoney(wb, acc, done, counts) {
  // Owner money first, so the cash account is never below zero in Zoho.
  for (const r of wb.payments) {
    const type = text(r[2]).toLowerCase();
    if (text(r[9]).toLowerCase() !== 'manual' || !['owner investment', 'owner withdrawal'].includes(type)) continue;
    if (done[`journal:${text(r[0])}`]) continue;
    if (zohoCalls() >= BUDGET) return false;
    const value = amount(type === 'owner investment' ? r[5] : r[6]);
    const date = isoDate(r[1]);
    if (!value || !date) continue;
    const investing = type === 'owner investment';
    const journal = (await zoho('POST', 'journals', { app: 'books', body: {
      journal_date: date, reference_number: text(r[0]), notes: `${text(r[4]) || text(r[2])} (imported from the finance workbook)`,
      line_items: [
        { account_id: investing ? acc.cash : acc.drawings, debit_or_credit: 'debit', amount: value },
        { account_id: investing ? acc.equity : acc.cash, debit_or_credit: 'credit', amount: value },
      ],
    } })).journal;
    await rpc('zoho_save_import', { p_kind: 'journal', p_key: text(r[0]), p_zoho_id: String(journal.journal_id) });
    counts.owner += 1;
  }

  return true;
}

// Expenses tab rows -> Zoho Books expenses. With paidOnly, rows without a Date Paid wait until it is filled in.
async function expenses(wb, acc, done, counts, supplierRows, paidOnly) {
  for (const r of wb.expenses) {
    const key = text(r[8]) || `${text(r[0])}|${text(r[2])}|${text(r[3])}`;
    if (done[`expense:${key}`]) continue;
    if (zohoCalls() > BUDGET - 2) return false;
    if (paidOnly && !isoDate(r[6])) continue;
    const date = isoDate(r[6]) || isoDate(r[0]);
    if (!date || !amount(r[3])) continue;
    const vendorName = text(r[4]);
    const expense = (await zoho('POST', 'expenses', { app: 'books', body: {
      account_id: acc.expense(r[1]), paid_through_account_id: acc.cash, date, amount: amount(r[3]),
      vendor_id: vendorName ? await vendor(vendorName, supplierRows[vendorName.toLowerCase()], done) : undefined,
      reference_number: text(r[8]) || undefined, description: [text(r[1]), text(r[2])].filter(Boolean).join(': '),
    } })).expense;
    await rpc('zoho_save_import', { p_kind: 'expense', p_key: key, p_zoho_id: String(expense.expense_id) });
    counts.expenses += 1;
  }
  return true;
}

// One portion of the import. Returns { finished, counts }.
export async function importPortion() {
  const state = await rpc('zoho_import_state', {});
  if (!state?.requested) return null;
  const done = state.done || {};
  const wb = await readWorkbook();
  const counts = { customers: 0, vendors: 0, invoices: 0, expenses: 0, owner: 0 };
  const left = () => zohoCalls() < BUDGET;
  const acc = await accounts(done);

  const customerRows = {};
  for (const r of wb.customers) customerRows[text(r[0]).toLowerCase()] = r;
  for (const r of wb.customers) {
    if (!left()) return { finished: false, counts };
    if (done[`customer:${text(r[0]).toLowerCase()}`]) continue;
    await customer(text(r[0]), r, done);
    counts.customers += 1;
  }
  const supplierRows = {};
  for (const r of wb.suppliers) supplierRows[text(r[0]).toLowerCase()] = r;
  const vendorNames = [...new Set([...wb.suppliers.map((r) => text(r[0])), ...wb.expenses.map((r) => text(r[4]))].filter(Boolean))];
  for (const name of vendorNames) {
    if (!left()) return { finished: false, counts };
    if (done[`vendor:${name.toLowerCase()}`]) continue;
    await vendor(name, supplierRows[name.toLowerCase()], done);
    counts.vendors += 1;
  }

  if (!(await ownerMoney(wb, acc, done, counts))) return { finished: false, counts };

  const invoices = new Map();
  for (const r of wb.sales) {
    const n = text(r[0]);
    if (!invoices.has(n)) invoices.set(n, []);
    invoices.get(n).push(r);
  }
  for (const [number, lines] of invoices) {
    if (done[`invoice:${number}`]) continue;
    if (zohoCalls() > BUDGET - 6) return { finished: false, counts };
    const id = await importInvoice(number, lines, { customerRows }, done);
    await rpc('zoho_save_import', { p_kind: 'invoice', p_key: number, p_zoho_id: id });
    counts.invoices += 1;
  }

  if (!(await expenses(wb, acc, done, counts, supplierRows, false))) return { finished: false, counts };
  return { finished: true, counts };
}

// After the import: new expenses (once paid) and owner money typed in the workbook are copied to Zoho too.
// Sales are not: they reach Zoho from the website itself. Returns the counts, or null when there was nothing new.
export async function followWorkbook() {
  const state = await rpc('zoho_import_state', {});
  if (!state?.finished || state.requested) return null;
  const done = state.done || {};
  const wb = await readWorkbook();
  const owner = (r) => text(r[9]).toLowerCase() === 'manual' && ['owner investment', 'owner withdrawal'].includes(text(r[2]).toLowerCase());
  const waiting = wb.payments.some((r) => owner(r) && !done[`journal:${text(r[0])}`])
    || wb.expenses.some((r) => isoDate(r[6]) && amount(r[3])
      && !done[`expense:${text(r[8]) || `${text(r[0])}|${text(r[2])}|${text(r[3])}`}`]);
  if (!waiting) return null; // nothing new: no Zoho calls at all
  const counts = { expenses: 0, owner: 0 };
  const acc = await accounts(done);
  const supplierRows = {};
  for (const r of wb.suppliers) supplierRows[text(r[0]).toLowerCase()] = r;
  await ownerMoney(wb, acc, done, counts);
  await expenses(wb, acc, done, counts, supplierRows, true);
  return counts;
}

// Count of everything imported so far, for the summary email and the Zoho tab.
export async function importSummary() {
  const done = (await rpc('zoho_import_state', {}))?.done || {};
  const n = (kind) => Object.keys(done).filter((k) => k.startsWith(`${kind}:`)).length;
  return `${n('customer')} customers, ${n('vendor')} suppliers, ${n('invoice')} past sales (invoices with their payments), `
    + `${n('expense')} expenses and ${n('journal')} owner investment entries are in Zoho.`;
}

export const importEmailTo = () => env('ORDER_NOTIFY_EMAIL');
