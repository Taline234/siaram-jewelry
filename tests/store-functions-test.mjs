// Tests for the store's Netlify functions, with Supabase and Resend replaced by fakes.
// Run: node --test tests/store-functions-test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJservice';
process.env.RESEND_API_KEY = 'resend-key';
process.env.ORDER_NOTIFY_EMAIL = 'shop@siaram.test';

const { default: placeOrder } = await import('../netlify/functions/place-order.mjs');
const { default: checkVoucher } = await import('../netlify/functions/check-voucher.mjs');
const { default: deleteAccount } = await import('../netlify/functions/delete-account.mjs');
const { default: inactiveAccounts } = await import('../netlify/functions/inactive-accounts.mjs');

let calls;
let handlers;
beforeEach(() => {
  calls = [];
  handlers = {};
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {},
                   body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    const path = new URL(call.url).pathname;
    const handler = handlers[path] || (path === '/emails' ? () => [200, { id: 'e1' }] : () => [404, {}]);
    const [status, body] = handler(call);
    return new Response(JSON.stringify(body), { status });
  };
  console.error = () => {};
  console.warn = () => {};
  console.log = () => {};
});

const request = (path, body, headers = {}) =>
  new Request(`https://siaram.test${path}`, { method: 'POST', body: JSON.stringify(body), headers });

const savedOrder = {
  reference: 'SJ-ABC123', customer_name: 'Rana <b>Haddad</b>', email: 'rana@example.com', phone: '70',
  governorate: 'Beirut', city: 'Achrafieh', street: 'St 1', building: null, floor: null, notes: null,
  subtotal: 120, delivery_fee: null, voucher_code: null, voucher_amount: 0, total: 120,
  whish_number: '+961 76 052 068', whish_name: 'Siaram Jewelry',
  items: [{ name: 'V-Bird Necklace', unit_price: 120, quantity: 1 }],
};

const emails = () => calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => c.body);

test('guest order is saved and both emails are sent', async () => {
  handlers['/rest/v1/rpc/place_order'] = () => [200, savedOrder];
  const res = await placeOrder(request('/api/place-order', {
    customer_name: 'Rana', email: 'rana@example.com', phone: '70', governorate: 'Beirut', city: 'A', street: 'S',
    age_confirmed: true, items: [{ slug: 'v-bird-necklace', quantity: '2', price: 1 }],
  }));
  assert.equal(res.status, 200);
  const rpc = calls.find((c) => c.url.endsWith('/rpc/place_order'));
  assert.equal(rpc.body.p_user_id, null);
  assert.equal(rpc.body.p.age_confirmed, true);
  assert.equal(rpc.body.p.payment_method, 'whish', 'Whish is the default payment method');
  assert.deepEqual(rpc.body.p.items, [{ slug: 'v-bird-necklace', quantity: 2 }], 'browser prices are dropped');
  assert.equal(rpc.headers.apikey, 'eyJservice');
  assert.equal(rpc.headers.authorization, 'Bearer eyJservice', 'legacy JWT key is also sent as Bearer');

  const [customer, shop] = emails();
  assert.deepEqual(customer.to, ['rana@example.com']);
  assert.match(customer.html, /send <strong>\$120\.00<\/strong> via Whish/);
  assert.match(customer.html, /Confirmed before dispatch, paid to the courier in cash/);
  assert.match(customer.html, /\+961 76 052 068/);
  assert.deepEqual(shop.to, ['shop@siaram.test']);
  assert.equal(shop.reply_to, 'rana@example.com');
  assert.match(shop.subject, /SJ-ABC123/);
  assert.doesNotMatch(shop.html, /<b>Haddad/, 'customer text is escaped in emails');
});

test('cash on delivery order tells the customer to pay the driver', async () => {
  handlers['/rest/v1/rpc/place_order'] = () => [200, { ...savedOrder, payment_method: 'cash', delivery_fee: 5 }];
  await placeOrder(request('/api/place-order', {
    customer_name: 'Rana', email: 'rana@example.com', phone: '70', governorate: 'Beirut', city: 'A', street: 'S',
    payment_method: 'cash', age_confirmed: true, items: [{ slug: 'v-bird-necklace', quantity: 1 }],
  }));
  assert.equal(calls.find((c) => c.url.endsWith('/rpc/place_order')).body.p.payment_method, 'cash');
  const [customer, shop] = emails();
  assert.match(customer.html, /pay <strong>\$120\.00<\/strong> in cash to the driver/);
  assert.match(customer.html, /To pay in cash on delivery/);
  assert.doesNotMatch(customer.html, /via Whish/);
  assert.match(shop.subject, /\$120\.00 cash/);
  assert.match(shop.html, /cash on delivery/);
});

test('an unknown payment method is treated as Whish', async () => {
  handlers['/rest/v1/rpc/place_order'] = () => [200, savedOrder];
  await placeOrder(request('/api/place-order', { payment_method: 'card', age_confirmed: true, items: [] }));
  assert.equal(calls.find((c) => c.url.endsWith('/rpc/place_order')).body.p.payment_method, 'whish');
});

test('signed-in order is linked to the account', async () => {
  handlers['/auth/v1/user'] = (c) => c.headers.authorization === 'Bearer user-token'
    ? [200, { id: 'user-1', email: 'rana@example.com' }] : [401, {}];
  handlers['/rest/v1/rpc/place_order'] = () => [200, savedOrder];
  await placeOrder(request('/api/place-order', { items: [], age_confirmed: false },
    { authorization: 'Bearer user-token' }));
  const rpc = calls.find((c) => c.url.endsWith('/rpc/place_order'));
  assert.equal(rpc.body.p_user_id, 'user-1');
  assert.equal(rpc.body.p.age_confirmed, true, 'account holders are already verified as 18+');
});

test('new-style secret keys are sent only as apikey', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_abc';
  try {
    handlers['/rest/v1/rpc/place_order'] = () => [200, savedOrder];
    await placeOrder(request('/api/place-order', { items: [] }));
    const rpc = calls.find((c) => c.url.endsWith('/rpc/place_order'));
    assert.equal(rpc.headers.apikey, 'sb_secret_abc');
    assert.equal(rpc.headers.authorization, undefined);
  } finally {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJservice';
  }
});

test('rule errors from the database are shown to the customer', async () => {
  handlers['/rest/v1/rpc/place_order'] = () =>
    [400, { code: 'P0001', message: 'Sorry, we do not currently deliver to South.' }];
  const res = await placeOrder(request('/api/place-order', { items: [] }));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Sorry, we do not currently deliver to South.' });
  assert.equal(emails().length, 0);
});

test('unexpected database errors are not leaked', async () => {
  handlers['/rest/v1/rpc/place_order'] = () => [500, { code: '42883', message: 'function does not exist' }];
  const res = await placeOrder(request('/api/place-order', { items: [] }));
  assert.equal(res.status, 500);
  assert.doesNotMatch((await res.json()).error, /function/);
});

test('spam-trap field rejects the request', async () => {
  const res = await placeOrder(request('/api/place-order', { website: 'http://spam', items: [] }));
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('voucher check returns balance but not the recipient name', async () => {
  handlers['/rest/v1/rpc/check_voucher'] = () =>
    [200, { code: 'SIARAM-AAAA-BBBB', balance: 50, expires_at: '2027-01-01', recipient_name: 'Lea' }];
  const res = await checkVoucher(request('/api/check-voucher', { code: 'siaram-aaaa-bbbb' }));
  assert.deepEqual(await res.json(), { code: 'SIARAM-AAAA-BBBB', balance: 50, expires_at: '2027-01-01' });
});

test('expired voucher message reaches the customer', async () => {
  handlers['/rest/v1/rpc/check_voucher'] = () => [400, { code: 'P0001', message: 'This gift voucher expired on 01 Mar 2026.' }];
  const res = await checkVoucher(request('/api/check-voucher', { code: 'X' }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /expired on/);
});

test('delete-account requires a signed-in user', async () => {
  const res = await deleteAccount(request('/api/delete-account', {}));
  assert.equal(res.status, 401);
  assert.ok(!calls.some((c) => c.method === 'DELETE'));
});

test('delete-account deletes the signed-in user only', async () => {
  handlers['/auth/v1/user'] = () => [200, { id: 'user-1', email: 'rana@example.com' }];
  handlers['/auth/v1/admin/users/user-1'] = () => [200, {}];
  const res = await deleteAccount(request('/api/delete-account', {}, { authorization: 'Bearer t' }));
  assert.equal(res.status, 200);
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/admin/users/user-1')));
});

test('inactivity job emails, marks, and deletes', async () => {
  handlers['/rest/v1/rpc/inactivity_due'] = () => [200, [
    { user_id: 'u1', email: 'a@x.com', first_name: 'Rana', action: 'reminder' },
    { user_id: 'u2', email: 'b@x.com', first_name: 'Maya', action: 'deletion_notice' },
    { user_id: 'u3', email: 'c@x.com', first_name: 'Lea', action: 'delete' },
  ]];
  handlers['/rest/v1/rpc/mark_inactivity_email'] = () => [200, null];
  handlers['/auth/v1/admin/users/u3'] = () => [200, {}];
  await inactiveAccounts();
  const marks = calls.filter((c) => c.url.endsWith('/mark_inactivity_email')).map((c) => c.body);
  assert.deepEqual(marks, [{ p_user_id: 'u1', p_action: 'reminder' }, { p_user_id: 'u2', p_action: 'deletion_notice' }]);
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/admin/users/u3')));
  assert.deepEqual(emails().map((e) => e.subject), [
    'We miss you at Siaram Jewelry',
    'Your Siaram account will be deleted in 30 days',
    'Your Siaram account has been deleted',
  ]);
});

test('inactivity email is retried tomorrow if sending fails', async () => {
  handlers['/rest/v1/rpc/inactivity_due'] = () => [200, [{ user_id: 'u1', email: 'a@x.com', first_name: 'R', action: 'reminder' }]];
  handlers['/emails'] = () => [500, {}];
  await inactiveAccounts();
  assert.ok(!calls.some((c) => c.url.endsWith('/mark_inactivity_email')));
});
