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

const { default: zohoSync } = await import('../supabase/functions/_shared/handlers/zoho-sync.mjs');
const { default: zohoConnect } = await import('../supabase/functions/_shared/handlers/zoho-connect.mjs');

let z;        // the fake Zoho organisation
let db;       // the fake database state
let emails;
let calls;

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
};

function fakeZoho(method, path, query, body) {
  const ok = (data) => [200, { code: 0, message: 'success', ...data }];
  const [kind, id, , action] = path.split('/');
  if (kind === 'organizations') return ok({ organizations: [{ organization_id: 'org-1', name: 'Siaram Jewelry', is_default_org: true }] });
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
  db = {
    connected: true, access: null, error: null, items: {}, contacts: {}, zohoOrders: {},
    products: [product('v-pendant-necklace', 'NK-08', 'Vertex Necklace', 489, 2), product('sun-ring', 'RG-07', 'Soleil Ring', 380, 0),
      product('no-sku', null, 'Draft piece', 100, 0)],
    orders: [],
  };
  emails = [];
  calls = [];
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
  assert.equal(start.searchParams.get('scope'), 'ZohoInventory.FullAccess.all');
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
