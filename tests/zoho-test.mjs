// Tests for the Zoho connection (zoho-connect) and copy (zoho-sync), against an in-memory fake of Zoho Inventory.
// Run: node --test tests/zoho-test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJservice';
process.env.RESEND_API_KEY = 'resend-key';
process.env.ORDER_NOTIFY_EMAIL = 'shop@siaram.test';
process.env.SITE_URL = 'https://siaram.test';
process.env.ZOHO_CLIENT_ID = 'client-1';
process.env.ZOHO_CLIENT_SECRET = 'secret-1';
globalThis.RETRY_DELAY_MS = 0;
const busy = { get: 0, post: 0 }; // how many Zoho Inventory GETs / POSTs answer 503 first
const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const { Buffer } = await import('node:buffer');
process.env.GOOGLE_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'robot@x.iam.gserviceaccount.com',
  private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----\n` });
process.env.WORKBOOK_SHEET_ID = 'sheet123';

const { default: zohoSync } = await import('../supabase/functions/_shared/handlers/zoho-sync.mjs');
const { default: zohoConnect } = await import('../supabase/functions/_shared/handlers/zoho-connect.mjs');

let z;        // the fake Zoho organisation
let db;       // the fake database state
let emails;
let calls;
let books;    // the fake Zoho Books organisation
let sheet;    // the fake Google Sheets workbook

function fakeBooks(method, path, query, body) {
  const ok = (data) => [200, { code: 0, message: 'success', ...data }];
  const [kind, id] = path.split('/');
  if (kind === 'chartofaccounts' && method === 'GET') return ok({ chartofaccounts: books.accounts });
  if (kind === 'chartofaccounts') {
    const a = { account_id: `a-${body.account_name.toLowerCase()}`, ...body };
    books.accounts.push(a);
    return ok({ chart_of_account: a });
  }
  if (kind === 'contacts' && method === 'GET') return ok({ contacts: Object.values(books.contacts).filter((c) => c.contact_name === query.get('contact_name')) });
  if (kind === 'contacts') {
    const c = { contact_id: `bc-${Object.keys(books.contacts).length + 1}`, ...body };
    books.contacts[c.contact_id] = c;
    return ok({ contact: c });
  }
  if (kind === 'invoices' && method === 'GET') return ok({ invoices: Object.values(books.invoices).filter((i) => i.invoice_number === query.get('invoice_number')) });
  if (kind === 'invoices' && id) return ok({});
  if (kind === 'invoices') {
    if (books.invoices[body.invoice_number]) return [400, { code: 1001, message: 'Invoice number already exists' }];
    const total = body.line_items.reduce((s, l) => s + l.rate * l.quantity, 0) + (body.adjustment || 0);
    const inv = { invoice_id: `binv-${body.invoice_number}`, total, balance: total, ...body };
    books.invoices[body.invoice_number] = inv;
    return ok({ invoice: inv });
  }
  if (kind === 'customerpayments') {
    books.payments.push(body);
    books.invoices[body.reference_number].balance -= body.amount;
    return ok({ payment: { payment_id: `bpay-${books.payments.length}` } });
  }
  if (kind === 'expenses') { books.expenses.push(body); return ok({ expense: { expense_id: `bexp-${books.expenses.length}` } }); }
  if (kind === 'journals') { books.journals.push(body); return ok({ journal: { journal_id: `bj-${books.journals.length}` } }); }
  return [404, { code: 5, message: `unknown books ${method} ${path}` }];
}

const WORKBOOK = () => ({
  Customers: [['Customers'], ['…'], ['…'], ['Name', 'Phone', 'Instagram', 'Email', 'Address', 'Birthday', 'How They Found Us', 'Notes'],
    ['Valerie Labeye', '+27763695175', '', 'valerie@example.com', 'Fourways Garden', '27-May-1975', 'Friend / family'],
    ['Corinne Ghandour', '+9613467462', '', '', 'One Oak Block A']],
  Suppliers: [['Suppliers'], ['…'], ['…'], ['Supplier Name', 'Contact Person', 'Phone', 'Email', 'Notes'],
    ['Raffos', 'Rafi', '+96170775268', '', 'Pieces manufacturer']],
  Sales: [['Sales'], ['…'], ['…'], ['Invoice #', 'Sale Date', 'Customer', 'Sales Channel', 'SKU'],
    ['S001', '07-Nov-2025', 'Valerie Labeye', 'In Person', 'NK-01', 'NK-01-B1', '1', '$490.00', 'Percentage', '0.', '$490.00', 'Cash', '$490.00'],
    ['S002', '10-Dec-2025', 'Corinne Ghandour', 'In Person', 'RG-03', 'RG-03-B1', '1', '$355.00', 'Percentage', '0.', '$355.00', 'Cash', '$355.00'],
    ['S002', '10-Dec-2025', 'Corinne Ghandour', 'In Person', 'RG-02', 'RG-02-B1', '1', '$430.00', 'Percentage', '0.', '$430.00', 'Cash', '$430.00'],
    ['SC001', '24-Jan-2026', 'Corinne Ghandour', 'In Person', 'CNK-01', 'CNK-01-B1', '1', '$899.99', 'Percentage', '0.', '$899.99', 'Cash', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', 'CO001']],
  Expenses: [['Expenses'], ['…'], ['…'], ['Date', 'Category', 'Description', 'Amount', 'Paid To (supplier)', 'Payment Method', 'Date Paid', 'Notes', 'Expense ID (auto)'],
    ['24-Sep-2025', 'Gold', 'Initial Pieces', '$459.00', 'Raffos', 'Cash', '24-Sep-2025', '', 'EX001'],
    ['09-Oct-2025', 'Packaging', 'Pouches', '$50.00', 'Georgi Sabounjian Showroom', 'Cash', '09-Oct-2025', '', 'EX002'],
    ['19-Feb-2026', 'Miscellaneous', 'Lawyer fee', '$3,500.00', '', 'Cash', '19-Feb-2026', '', 'EX010']],
  Payments: [['Payments'], ['…'], ['…'], ['Payment ID (auto)', 'Date', 'Type', 'Reference', 'Description', 'Money In', 'Money Out', 'Method', 'Notes', 'Source'],
    ['PAY001', '24-Sep-2025', 'Owner Investment', 'OWNER001', 'Starting capital', '$15,000.00', '', 'Cash', '', 'Manual'],
    ['AUTO-S001/1', '07-Nov-2025', 'Customer receipt', 'S001/1', 'Sale S001', '$490.00', '', 'Cash', '', 'From Sales']],
});

const product = (slug, sku, name, price, stock) => ({ slug, sku, name, category: 'Necklaces', price, stock, item_id: null });
const order = (reference, extra = {}) => ({
  id: `id-${reference}`, reference, status: 'received', channel: 'Website', payment_method: 'cash', sale_date: '2026-11-25',
  customer_name: 'Rana Haddad', email: 'rana@example.com', phone: '+961 70 123 456', address: 'St 1, Achrafieh, Beirut',
  subtotal: 489, voucher_code: null, voucher_amount: 0, total: 489, invoice_id: null, payment_id: null, voided: false,
  items: [{ slug: 'v-pendant-necklace', sku: 'NK-08', name: 'Vertex Necklace', unit_price: 489, quantity: 1, metal: 'yellow',
    size: '', stone: '', made_to_order: false }],
  ...extra,
});

// The database functions zoho-sync uses, over the fake state (zoho_work picks the orders with work left, like the SQL).
function work() {
  const orders = db.orders.map((o) => ({ ...o, ...(db.zohoOrders[o.id] || {}) })).filter((o) => {
    const zo = db.zohoOrders[o.id];
    if (!zo) return true;
    if (o.status === 'cancelled') return zo.invoice_id && !zo.voided;
    return !zo.invoice_id || (!zo.payment_id && o.total > 0 && (o.channel !== 'Website' || o.status === 'delivered'));
  });
  return { products: db.products.map((p) => ({ ...p, item_id: db.items[p.slug] || null })), contacts: { ...db.contacts }, orders };
}

const RPC = {
  cron_secret_ok: (b) => b.p_secret === 'right',
  claim_zoho_sync: () => db.connected,
  zoho_credentials: () => ({ refresh_token: 'refresh-1', organization_id: 'org-1', access_token: db.access }),
  zoho_save_access: (b) => { db.access = b.p_access_token; },
  zoho_work: () => work(),
  zoho_save_item: (b) => { db.items[b.p_slug] = b.p_item_id; },
  zoho_save_contact: (b) => { db.contacts[b.p_key] = b.p_contact_id; },
  zoho_save_order: (b) => {
    const prev = db.zohoOrders[b.p_order_id] || { invoice_id: null, payment_id: null, voided: false };
    db.zohoOrders[b.p_order_id] = {
      invoice_id: b.p_invoice_id ?? prev.invoice_id,
      payment_id: b.p_voided ? null : (b.p_payment_id ?? prev.payment_id),
      voided: b.p_voided ?? prev.voided, last_error: b.p_error || null,
    };
  },
  finish_zoho_sync: (b) => { const prev = db.error; db.error = b.p_error || null; return prev; },
  zoho_begin_connect: () => 'state-1',
  zoho_finish_connect: (b) => { db.finished = b; return b.p_state === 'state-1'; },
  zoho_status: () => ({ connected: db.connected, organization: 'Siaram Jewelry' }),
  zoho_import_state: () => ({ requested: db.importRequested, finished: Boolean(db.importSummary), done: { ...db.imports } }),
  zoho_save_import: (b) => { db.imports[`${b.p_kind}:${b.p_key}`] = b.p_zoho_id; },
  zoho_finish_import: (b) => { db.importRequested = false; db.importSummary = b.p_summary; },
  zoho_request_import: () => { db.importRequested = true; },
  zoho_set_organizations: (b) => { db.orgs = b.p_list; },
  zoho_choose_organization: (b) => { const o = (db.orgs || []).find((x) => x.id === b.p_id); if (o) db.chosen = o.id; return Boolean(o); },
};

function fakeZoho(method, path, query, body) {
  const ok = (data) => [200, { code: 0, message: 'success', ...data }];
  const [kind, id, , action] = path.split('/');
  if (kind === 'organizations') return ok({ organizations: [{ organization_id: 'org-1', name: 'Siaram Jewelry', is_default_org: true },
    { organization_id: 'org-2', name: 'Siaram Jewelry', is_default_org: false }] });
  if (query.get('organization_id') !== 'org-1') return [400, { code: 6041, message: 'organization_id missing' }];
  if (kind === 'items' && method === 'GET') {
    const items = Object.values(z.items).filter((i) => !query.get('sku') || i.sku === query.get('sku'));
    return ok({ items, page_context: { has_more_page: false } });
  }
  if (kind === 'items' && method === 'POST') {
    const item = { item_id: `item-${body.sku}`, ...body, stock_on_hand: 0 };
    z.items[item.item_id] = item;
    return ok({ item });
  }
  if (kind === 'inventoryadjustments') {
    for (const l of body.line_items) z.items[l.item_id].stock_on_hand += l.quantity_adjusted;
    z.adjustments.push(body);
    return ok({ inventory_adjustment: { inventory_adjustment_id: `adj-${z.adjustments.length}` } });
  }
  if (kind === 'contacts' && method === 'GET') {
    const contacts = Object.values(z.contacts).filter((c) => (query.get('email') ? c.email === query.get('email') : c.contact_name === query.get('contact_name')));
    return ok({ contacts });
  }
  if (kind === 'contacts' && method === 'POST') {
    const contact = { contact_id: `contact-${Object.keys(z.contacts).length + 1}`, contact_name: body.contact_name, email: body.contact_persons[0].email };
    z.contacts[contact.contact_id] = { ...contact, body };
    return ok({ contact });
  }
  if (kind === 'invoices' && method === 'POST' && !id) {
    if (Object.values(z.invoices).some((i) => i.invoice_number === body.invoice_number)) return [400, { code: 1001, message: 'Invoice number already exists' }];
    const invoice = { invoice_id: `inv-${body.invoice_number}`, ...body, status: 'draft', query: Object.fromEntries(query) };
    z.invoices[invoice.invoice_id] = invoice;
    // Zoho Inventory takes invoiced pieces out of stock.
    for (const l of body.line_items) z.items[l.item_id].stock_on_hand -= l.quantity;
    return ok({ invoice });
  }
  if (kind === 'invoices' && method === 'GET') {
    return ok({ invoices: Object.values(z.invoices).filter((i) => i.invoice_number === query.get('invoice_number')) });
  }
  if (kind === 'invoices' && action) {
    z.invoices[id].status = action === 'void' ? 'void' : 'sent';
    if (action === 'void') for (const l of z.invoices[id].line_items) z.items[l.item_id].stock_on_hand += l.quantity;
    return ok({});
  }
  if (kind === 'customerpayments' && method === 'POST') {
    const payment = { payment_id: `pay-${body.reference_number}`, ...body };
    z.payments[payment.payment_id] = payment;
    return ok({ payment });
  }
  if (kind === 'customerpayments' && method === 'DELETE') { delete z.payments[id]; return ok({}); }
  return [404, { code: 5, message: `unknown ${method} ${path}` }];
}

beforeEach(() => {
  z = { items: {}, contacts: {}, invoices: {}, payments: {}, adjustments: [] };
  books = { accounts: [
    { account_id: 'a-cogs', account_name: 'Cost of Goods Sold', account_type: 'cost_of_goods_sold' },
    { account_id: 'a-adv', account_name: 'Advertising And Marketing', account_type: 'expense' },
    { account_id: 'a-it', account_name: 'IT and Internet Expenses', account_type: 'expense' },
    { account_id: 'a-other', account_name: 'Other Expenses', account_type: 'expense' },
    { account_id: 'a-cash', account_name: 'Petty Cash', account_type: 'cash' },
    { account_id: 'a-eq', account_name: "Owner's Equity", account_type: 'equity' }],
    contacts: {}, invoices: {}, payments: [], expenses: [], journals: [] };
  db = {
    connected: true, access: null, error: null, items: {}, contacts: {}, zohoOrders: {}, importRequested: false, imports: {},
    products: [product('v-pendant-necklace', 'NK-08', 'Vertex Necklace', 489, 2), product('sun-ring', 'RG-07', 'Soleil Ring', 380, 0),
      product('no-sku', null, 'Draft piece', 100, 0)],
    orders: [],
  };
  emails = [];
  calls = [];
  sheet = WORKBOOK();
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    calls.push({ url: u, method: init.method || 'GET', body: init.body });
    const reply = ([status, data]) => new Response(JSON.stringify(data), { status });
    if (u.hostname === 'accounts.zoho.eu') {
      const p = new URLSearchParams(init.body);
      if (p.get('client_secret') !== 'secret-1') return reply([400, { error: 'invalid_client' }]);
      if (p.get('grant_type') === 'authorization_code') {
        return reply([200, p.get('code') === 'good' ? { access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 3600 } : { error: 'invalid_code' }]);
      }
      return reply([200, { access_token: 'access-1', expires_in: 3600 }]);
    }
    if (u.hostname === 'oauth2.googleapis.com') return reply([200, { access_token: 'gtok' }]);
    if (u.hostname === 'sheets.googleapis.com') {
      const range = decodeURIComponent(u.pathname.split('/values/')[1]);
      const name = range.split('!')[0].replace(/'/g, '');
      return reply([200, { values: sheet[name] || [] }]);
    }
    if (u.hostname === 'www.zohoapis.eu' && u.pathname.startsWith('/books/v3/')) {
      return reply(fakeBooks(init.method || 'GET', u.pathname.replace('/books/v3/', ''), u.searchParams, init.body ? JSON.parse(init.body) : null));
    }
    if (u.hostname === 'www.zohoapis.eu' && !u.pathname.startsWith('/books/')) {
      const m = (init.method || 'GET') === 'GET' ? 'get' : 'post';
      if (busy[m] > 0) { busy[m] -= 1; return reply([503, { code: 503, message: 'Service unavailable' }]); }
    }
    if (u.hostname === 'www.zohoapis.eu') {
      if (!String(init.headers?.authorization).startsWith('Zoho-oauthtoken access-')) return reply([401, { code: 57, message: 'unauthorised' }]);
      const path = u.pathname.replace('/inventory/v1/', '');
      return reply(fakeZoho(init.method || 'GET', path, u.searchParams, init.body ? JSON.parse(init.body) : null));
    }
    if (u.hostname === 'api.resend.com') { emails.push(JSON.parse(init.body)); return reply([200, { id: 'e' }]); }
    if (u.hostname === 'db.test') {
      if (u.pathname === '/auth/v1/user') return reply([200, db.user || { email: 'siaramjewelry@hotmail.com', email_confirmed_at: '2026-01-01' }]);
      const name = u.pathname.split('/').pop();
      return reply([200, RPC[name] ? RPC[name](init.body ? JSON.parse(init.body) : {}) ?? null : null]);
    }
    return reply([404, {}]);
  };
  console.error = () => {};
});

const run = async (secret = 'right') => {
  const res = await zohoSync(new Request('https://siaram.test/zoho-sync', { method: 'POST', body: '{}', headers: { 'x-cron-secret': secret } }));
  return { status: res.status, body: await res.json() };
};
const stockOf = (sku) => z.items[`item-${sku}`].stock_on_hand;

test('only the database scheduler may start a copy, and nothing happens until Zoho is connected', async () => {
  assert.equal((await run('wrong')).status, 403);
  db.connected = false;
  assert.match((await run()).body.skipped, /Not connected/);
  assert.equal(calls.filter((c) => c.url.hostname.includes('zoho')).length, 0);
});

test('the pieces are created in Zoho with their SKU and price, and Zoho stock matches the website', async () => {
  const { body } = await run();
  assert.equal(body.items, 2, 'pieces without a SKU are skipped');
  assert.deepEqual(Object.values(z.items).map((i) => [i.sku, i.name, i.rate]), [['NK-08', 'Vertex Necklace', 489], ['RG-07', 'Soleil Ring', 380]]);
  assert.equal(stockOf('NK-08'), 2);
  assert.equal(stockOf('RG-07'), 0);
  assert.equal(db.access, 'access-1', 'the access token is saved for the next runs');
  await run();
  assert.equal(calls.filter((c) => c.url.hostname === 'accounts.zoho.eu').length, 1, 'no new sign-in while the token is valid');
  assert.equal(z.adjustments.length, 1, 'no adjustment when nothing changed');
  assert.equal(Object.keys(z.items).length, 2, 'items are not created twice');
});

test('a website order becomes an invoice numbered like the order, and is paid once delivered', async () => {
  db.orders = [order('S030')];
  db.products[0].stock = 1; // the website took the piece off its stock
  await run();
  const inv = z.invoices['inv-S030'];
  assert.equal(inv.invoice_number, 'S030');
  assert.equal(inv.query.ignore_auto_number_generation, 'true');
  assert.equal(inv.status, 'sent');
  assert.deepEqual(inv.line_items, [{ item_id: 'item-NK-08', rate: 489, quantity: 1, description: 'Yellow gold' }]);
  assert.equal(Object.values(z.contacts)[0].contact_name, 'Rana Haddad');
  assert.equal(Object.keys(z.payments).length, 0, 'not paid before delivery');
  assert.equal(stockOf('NK-08'), 1, 'Zoho stock equals the website after invoicing');
  db.orders = [order('S030', { status: 'delivered' })];
  await run();
  assert.deepEqual([z.payments['pay-S030'].amount, z.payments['pay-S030'].payment_mode], [489, 'Cash']);
  await run();
  assert.equal(Object.keys(z.invoices).length, 1, 'nothing is sent twice');
  assert.equal(Object.keys(z.payments).length, 1);
  assert.equal(stockOf('NK-08'), 1);
});

test('a recorded Instagram sale is paid at once; the same customer is reused; vouchers reduce the invoice', async () => {
  db.orders = [order('S031', { channel: 'Instagram', payment_method: 'card', status: 'delivered', voucher_code: 'GV0001-AAAAAA',
    voucher_amount: 100, total: 389 }), order('S032', { channel: 'WhatsApp', payment_method: 'whish', status: 'delivered' })];
  db.products[0].stock = 0;
  await run();
  assert.equal(Object.keys(z.contacts).length, 1, 'one customer, found again by email');
  assert.deepEqual([z.invoices['inv-S031'].adjustment, z.invoices['inv-S031'].adjustment_description], [-100, 'Gift voucher GV0001-AAAAAA']);
  assert.deepEqual([z.payments['pay-S031'].amount, z.payments['pay-S031'].payment_mode, z.payments['pay-S031'].date], [389, 'Credit Card', '2026-11-25']);
  assert.equal(z.payments['pay-S032'].payment_mode, 'Bank Transfer');
  assert.equal(stockOf('NK-08'), 0);
});

test('a made-to-order piece does not leave Zoho stock below the website stock', async () => {
  db.orders = [order('S033', { items: [{ ...order('x').items[0], metal: 'rose', made_to_order: true }] })];
  await run();
  assert.equal(z.invoices['inv-S033'].line_items[0].description, 'Rose gold, made to order');
  assert.equal(stockOf('NK-08'), 2, 'website stock unchanged, so Zoho too');
});

test('a cancelled order has its payment removed, its invoice voided, and stock follows the website', async () => {
  db.orders = [order('S034', { status: 'delivered' })];
  db.products[0].stock = 1;
  await run();
  db.orders = [order('S034', { status: 'cancelled' })];
  db.products[0].stock = 2;
  const { body } = await run();
  assert.equal(body.voided, 1);
  assert.equal(z.invoices['inv-S034'].status, 'void');
  assert.equal(Object.keys(z.payments).length, 0);
  assert.equal(stockOf('NK-08'), 2);
  await run();
  assert.equal(z.adjustments.length >= 1, true);
  assert.equal(stockOf('NK-08'), 2, 'still equal after another run');
});

test('an invoice already in Zoho (an earlier answer lost) is reused instead of failing', async () => {
  await run();
  z.invoices['inv-S035'] = { invoice_id: 'inv-S035', invoice_number: 'S035', line_items: [], status: 'sent' };
  db.orders = [order('S035')];
  await run();
  assert.equal(db.zohoOrders['id-S035'].invoice_id, 'inv-S035');
  assert.equal(db.error, null);
});

test('a problem is emailed once per reason and kept for the Zoho tab', async () => {
  db.products[0].sku = null;
  db.orders = [order('S036')];
  await run();
  assert.match(db.error, /S036: Vertex Necklace has no SKU/);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].subject, 'Zoho could not be updated');
  await run();
  assert.equal(emails.length, 1, 'not again for the same reason');
});

test('Connect Zoho: only the owner gets the Zoho page; coming back with a good code saves the connection', async () => {
  const post = (action) => zohoConnect(new Request('https://siaram.test/zoho-connect',
    { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ action }) }));
  db.user = { email: 'rana@example.com', email_confirmed_at: '2026-01-01' };
  assert.equal((await post('start')).status, 403);
  db.user = null;
  const start = new URL((await (await post('start')).json()).url);
  assert.equal(start.origin, 'https://accounts.zoho.eu');
  assert.equal(start.searchParams.get('scope'), 'ZohoInventory.FullAccess.all,ZohoBooks.fullaccess.all');
  assert.equal(start.searchParams.get('access_type'), 'offline');
  assert.equal(start.searchParams.get('state'), 'state-1');
  assert.equal(start.searchParams.get('redirect_uri'), 'https://db.test/functions/v1/zoho-connect');
  assert.equal((await (await post('status')).json()).keys_added, true);

  const back = (q) => zohoConnect(new Request(`https://db.test/functions/v1/zoho-connect?${q}`));
  let res = await back('code=good&state=state-1');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://siaram.test/account.html?zoho=connected#zoho');
  assert.deepEqual([db.finished.p_refresh_token, db.finished.p_organization_id, db.finished.p_organization_name],
    ['refresh-new', 'org-1', 'Siaram Jewelry']);
  res = await back('code=good&state=forged');
  assert.match(res.headers.get('location'), /zoho=expired/, 'a wrong state is refused');
  res = await back('error=access_denied&state=state-1');
  assert.match(res.headers.get('location'), /zoho=cancelled/);
  res = await back('code=bad&state=state-1');
  assert.match(res.headers.get('location'), /zoho=failed/);
});

test('the workbook import copies customers, suppliers, past sales with payments, expenses and the starting capital', async () => {
  db.importRequested = true;
  const { body } = await run();
  assert.equal(body.import.finished, true);
  assert.deepEqual(Object.values(books.contacts).map((c) => [c.contact_type, c.contact_name]),
    [['customer', 'Valerie Labeye'], ['customer', 'Corinne Ghandour'], ['vendor', 'Raffos'], ['vendor', 'Georgi Sabounjian Showroom']]);
  assert.match(Object.values(books.contacts)[0].notes, /Birthday: 27-May-1975/);
  assert.deepEqual(books.journals[0].line_items, [
    { account_id: 'a-cash', debit_or_credit: 'debit', amount: 15000 }, { account_id: 'a-eq', debit_or_credit: 'credit', amount: 15000 }]);
  assert.equal(books.journals.length, 1, 'only owner money, not the automatic receipts');
  const s002 = books.invoices.S002;
  assert.deepEqual([s002.date, s002.line_items.map((l) => [l.name, l.rate])], ['2025-12-10', [['Hamsa Ring', 355], ['Qamar Ring', 430]]]);
  assert.equal(books.invoices.SC001.line_items[0].name, 'Custom piece CNK-01');
  assert.match(books.invoices.SC001.line_items[0].description, /custom order CO001/);
  assert.deepEqual(books.payments.map((p) => [p.reference_number, p.amount, p.payment_mode, p.date]),
    [['S001', 490, 'Cash', '2025-11-07'], ['S002', 785, 'Cash', '2025-12-10'], ['SC001', 899.99, 'Cash', '2026-01-24']]);
  assert.deepEqual(books.expenses.map((e) => [e.reference_number, e.account_id, e.amount, e.date, Boolean(e.vendor_id)]),
    [['EX001', 'a-cogs', 459, '2025-09-24', true], ['EX002', 'a-packaging', 50, '2025-10-09', true], ['EX010', 'a-other', 3500, '2026-02-19', false]]);
  assert.match(db.importSummary, /2 customers, 2 suppliers, 3 past sales .* 3 expenses and 1 owner investment/);
  assert.equal(emails.find((e) => e.subject === 'Your workbook is in Zoho') !== undefined, true);
  // Clicking Import again adds nothing twice.
  db.importRequested = true;
  await run();
  assert.equal(Object.keys(books.contacts).length, 4);
  assert.equal(books.payments.length, 3);
  assert.equal(books.expenses.length, 3);
  assert.equal(books.journals.length, 1);
});

test('a big import is done in portions, carrying on where it stopped', async () => {
  for (let n = 3; n < 40; n += 1) sheet.Sales.push([`S${String(n).padStart(3, '0')}`, '07-Nov-2025', 'Valerie Labeye', 'In Person', 'NK-01', '', '1', '$490.00', '', '', '$490.00', 'Cash']);
  db.importRequested = true;
  const first = (await run()).body.import;
  assert.equal(first.finished, false);
  let runs = 1;
  while (db.importRequested && runs < 10) { await run(); runs += 1; }
  assert.equal(db.importRequested, false, 'finished after a few portions');
  assert.equal(Object.keys(books.invoices).length, 40);
  assert.equal(books.payments.length, 40);
});

test('a workbook tab whose columns moved is not imported wrongly', async () => {
  sheet.Expenses[3][0] = 'When';
  db.importRequested = true;
  await run();
  assert.match(db.error, /Workbook to Zoho: The Expenses tab has no "Date" heading/);
  assert.equal(books.expenses.length, 0);
});

test('with several Zoho organisations, the list is kept and the owner can choose one of them only', async () => {
  const back = (q) => zohoConnect(new Request(`https://db.test/functions/v1/zoho-connect?${q}`));
  await back('code=good&state=state-1');
  assert.deepEqual(db.orgs.map((o) => o.id), ['org-1', 'org-2']);
  const choose = (id) => zohoConnect(new Request('https://siaram.test/zoho-connect',
    { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ action: 'organization', organization_id: id }) }));
  assert.equal((await choose('org-2')).status, 200);
  assert.equal(db.chosen, 'org-2');
  assert.equal((await choose('org-9')).status, 400, 'an organisation not on the account is refused');
  db.user = { email: 'rana@example.com', email_confirmed_at: '2026-01-01' };
  assert.equal((await choose('org-1')).status, 403);
});

test('after the import, new paid expenses and owner money typed in the workbook follow; unpaid ones wait', async () => {
  db.importRequested = true;
  await run();
  assert.equal(books.expenses.length, 3);
  const before = calls.length;
  await run();
  assert.equal(calls.filter((c, i) => i >= before && c.url.hostname === 'www.zohoapis.eu' && c.url.pathname.startsWith('/books/')).length, 0,
    'nothing new: no Zoho Books calls');
  sheet.Expenses.push(['26-Nov-2026', 'Packaging', 'Boxes', '$120.00', 'Print Group', 'Cash', '', '', 'EX029']);
  sheet.Expenses.push(['26-Nov-2026', 'Advertising', 'Reel', '$80.00', 'Karim', 'Cash', '26-Nov-2026', '', 'EX030']);
  sheet.Payments.push(['PAY050', '26-Nov-2026', 'Owner Withdrawal', 'OWNER002', 'Owner draw', '', '$500.00', 'Cash', '', 'Manual']);
  sheet.Sales.push(['S040', '26-Nov-2026', 'Lea', 'Website', 'NK-01', '', '1', '$490.00', '', '', '$490.00', 'Cash', '$490.00']);
  const { body } = await run();
  assert.deepEqual(body.workbook, { expenses: 1, owner: 1 });
  assert.ok(Object.values(books.contacts).some((c) => c.contact_type === 'vendor' && c.contact_name === 'Karim'), 'a new supplier is added');
  assert.deepEqual(books.expenses.at(-1).reference_number, 'EX030');
  assert.equal(books.expenses.some((e) => e.reference_number === 'EX029'), false, 'an unpaid bill waits for its Date Paid');
  assert.deepEqual(books.journals.at(-1).line_items.map((l) => [l.debit_or_credit, l.amount]), [['debit', 500], ['credit', 500]]);
  assert.equal(books.invoices.S040, undefined, 'sales are not copied from the workbook (the website sends them)');
  sheet.Expenses.find((r) => r[8] === 'EX029')[6] = '27-Nov-2026';
  await run();
  assert.equal(books.expenses.at(-1).reference_number, 'EX029');
  await run();
  assert.equal(books.expenses.length, 5, 'nothing twice');
});

test('a brief Zoho outage on reading is tried again; creating something is not repeated after a 503', async () => {
  busy.get = 2;
  await run();
  assert.equal(db.error, null, 'reads are tried again');
  db.orders = [order('S050')];
  busy.post = 1;
  await run();
  assert.match(db.error, /Service unavailable/);
  assert.equal(z.adjustments.length, 1, 'the stock adjustment that got a 503 was not sent again in the same run');
  assert.equal(Object.keys(z.invoices).length, 0);
  await run();
  assert.equal(z.invoices['inv-S050'].invoice_number, 'S050', 'the next run creates it');
  assert.equal(Object.keys(z.invoices).length, 1);
  assert.equal(stockOf('NK-08'), 2, 'stock right again after the next run');
  assert.equal(db.error, null);
});
