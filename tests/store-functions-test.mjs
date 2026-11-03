// Tests for the store's Netlify functions, with Supabase and Resend replaced by fakes.
// Run: node --test tests/store-functions-test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJservice';
process.env.RESEND_API_KEY = 'resend-key';
process.env.ORDER_NOTIFY_EMAIL = 'shop@siaram.test';

const { default: placeOrder } = await import('../supabase/functions/_shared/handlers/place-order.mjs');
const { default: checkVoucher } = await import('../supabase/functions/_shared/handlers/check-voucher.mjs');
const { default: deleteAccount } = await import('../supabase/functions/_shared/handlers/delete-account.mjs');
const { default: inactiveAccounts } = await import('../supabase/functions/_shared/handlers/inactive-accounts.mjs');
const { default: exportSales } = await import('../supabase/functions/_shared/handlers/export-sales.mjs');
const { default: orderStatus } = await import('../supabase/functions/_shared/handlers/order-status.mjs');
const { default: customRequest } = await import('../supabase/functions/_shared/handlers/custom-request.mjs');
const { default: serviceRequest } = await import('../supabase/functions/_shared/handlers/service-request.mjs');
const { default: voucherRequest } = await import('../supabase/functions/_shared/handlers/voucher-request.mjs');
const { default: voucherSend } = await import('../supabase/functions/_shared/handlers/voucher-send.mjs');
const { salesCsv, customersCsv } = await import('../supabase/functions/_shared/workbook.mjs');

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
  reference: 'S016', customer_name: 'Rana <b>Haddad</b>', email: 'rana@example.com', phone: '70',
  governorate: 'Beirut', city: 'Achrafieh', street: 'St 1', building: null, floor: null, notes: null,
  subtotal: 205, delivery_fee: null, voucher_code: null, voucher_amount: 0, total: 205,
  items: [{ sku: 'NK-07', name: 'V-Bird Necklace', unit_price: 120, quantity: 1, metal: 'yellow', size: '', made_to_order: false },
          { sku: 'RG-01', name: 'Crescent Moon Ring', unit_price: 85, quantity: 1, metal: 'rose', size: 'EU 52', made_to_order: true }],
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
  assert.equal(rpc.body.p.payment_method, 'cash', 'website orders are cash');
  assert.deepEqual(rpc.body.p.items, [{ slug: 'v-bird-necklace', quantity: 2, metal: 'yellow', size: '' }], 'browser prices are dropped');
  assert.equal(rpc.headers.apikey, 'eyJservice');
  assert.equal(rpc.headers.authorization, 'Bearer eyJservice', 'legacy JWT key is also sent as Bearer');

  const [customer, shop] = emails();
  assert.deepEqual(customer.to, ['rana@example.com']);
  assert.match(customer.html, /pay <strong>\$120\.00<\/strong> in cash to the driver/);
  assert.match(customer.html, /email you when your order ships/);
  assert.match(customer.html, /Confirmed before dispatch, paid to the courier in cash/);
  assert.deepEqual(shop.to, ['shop@siaram.test']);
  assert.equal(shop.reply_to, 'rana@example.com');
  assert.match(shop.subject, /S016/);
  assert.match(shop.html, /NK-07 &middot; V-Bird Necklace/, 'the shop email shows the SKU');
  assert.match(customer.html, /Crescent Moon Ring &times; 1<br><span[^>]*>18k rose gold &middot; EU 52 &middot; Made to order \(3–4 weeks, paid by Whish\)<\/span>/,
    'emails show metal, size and whether the piece is made to order');
  assert.match(customer.html, /V-Bird Necklace &times; 1<br><span[^>]*>18k yellow gold &middot; In stock<\/span>/);
  assert.match(customer.html, /You will pay <strong>\$120\.00<\/strong> in cash/);
  assert.match(customer.html, /made-to-order pieces \(<strong>\$85\.00<\/strong>\) are paid by Whish/);
  assert.match(shop.subject, /\$120\.00 cash \+ \$85\.00 Whish/);
  assert.match(shop.html, /Made to order:<\/strong> send the customer a Whish\s+payment request for \$85\.00/);
  assert.doesNotMatch(customer.html, /NK-07/, 'the customer email does not');
  assert.match(shop.html, /For your finance workbook/, 'the shop email lists rows for the finance workbook');
  assert.match(shop.html, /<td[^>]*>S016<\/td><td[^>]*>\d\d\/\d\d\/\d{4}<\/td><td[^>]*>Rana &lt;b&gt;Haddad&lt;\/b&gt;<\/td><td[^>]*>Website<\/td><td[^>]*>NK-07<\/td><td[^>]*>1<\/td><td[^>]*>120\.00<\/td><td[^>]*>Cash<\/td>/,
    'rows follow the Sales tab columns');
  assert.match(shop.html, /<td[^>]*>RG-01<\/td><td[^>]*>1<\/td><td[^>]*>85\.00<\/td><td[^>]*>Whish<\/td>/, 'made-to-order pieces are paid by Whish');
  assert.doesNotMatch(customer.html, /finance workbook/, 'customers do not see it');
  assert.deepEqual(customer.attachments.map((a) => a.filename), ['Siaram-receipt-S016.pdf', 'Siaram-care-and-warranty-S016.pdf'],
    'the customer gets the receipt and the care and warranty card');
  assert.deepEqual(shop.attachments.map((a) => a.filename), ['Siaram-receipt-S016.pdf'], 'the shop gets the receipt');
  const pdf = Buffer.from(customer.attachments[0].content, 'base64');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-', 'the receipt is a PDF');
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

test('any other payment method is sent as cash', async () => {
  handlers['/rest/v1/rpc/place_order'] = () => [200, savedOrder];
  await placeOrder(request('/api/place-order', { payment_method: 'card', age_confirmed: true, items: [] }));
  assert.equal(calls.find((c) => c.url.endsWith('/rpc/place_order')).body.p.payment_method, 'cash');
});

test('a repeated submission sends no second set of emails', async () => {
  handlers['/rest/v1/rpc/place_order'] = () => [200, { ...savedOrder, duplicate: true }];
  const res = await placeOrder(request('/api/place-order', { submission_id: 'abc', age_confirmed: true, items: [] }));
  assert.equal(res.status, 200);
  assert.equal(calls.find((c) => c.url.endsWith('/rpc/place_order')).body.p.submission_id, 'abc');
  assert.equal(emails().length, 0);
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
  const res = await checkVoucher(request('/api/check-voucher', { code: 'siaram-aaaa-bbbb', email: 'lea@example.com', phone: '70' }));
  assert.deepEqual(await res.json(), { code: 'SIARAM-AAAA-BBBB', balance: 50, expires_at: '2027-01-01' });
  assert.deepEqual(calls.find((c) => c.url.endsWith('/rpc/check_voucher')).body,
    { p_code: 'siaram-aaaa-bbbb', p_email: 'lea@example.com', p_phone: '70' }, 'recipient details are passed on');
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

const cronRequest = (secret) => new Request('https://siaram.test/functions/v1/inactive-accounts',
  { method: 'POST', body: '{}', headers: secret ? { 'x-cron-secret': secret } : {} });

test('only the database scheduler can start the inactivity job', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = (c) => [200, c.body.p_secret === 'right'];
  assert.equal((await inactiveAccounts(cronRequest())).status, 403);
  assert.equal((await inactiveAccounts(cronRequest('wrong'))).status, 403);
  assert.ok(!calls.some((c) => c.url.endsWith('/inactivity_due')), 'nothing is looked up without the secret');
});

test('inactivity job emails, marks, and deletes', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = () => [200, true];
  handlers['/rest/v1/rpc/inactivity_due'] = () => [200, [
    { user_id: 'u1', email: 'a@x.com', first_name: 'Rana', action: 'reminder' },
    { user_id: 'u2', email: 'b@x.com', first_name: 'Maya', action: 'deletion_notice' },
    { user_id: 'u3', email: 'c@x.com', first_name: 'Lea', action: 'delete' },
  ]];
  handlers['/rest/v1/rpc/mark_inactivity_email'] = () => [200, null];
  handlers['/auth/v1/admin/users/u3'] = () => [200, {}];
  assert.deepEqual(await (await inactiveAccounts(cronRequest('right'))).json(), { processed: 3 });
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
  handlers['/rest/v1/rpc/cron_secret_ok'] = () => [200, true];
  await inactiveAccounts(cronRequest('right'));
  assert.ok(!calls.some((c) => c.url.endsWith('/mark_inactivity_email')));
});

// ---------------------------------------------------------------- workbook backup download
const exportOrders = [
  { reference: 'S017', sale_date: '2026-11-02', customer_name: 'Rana Haddad', email: 'rana@example.com', phone: '70',
    address: 'St 1, Achrafieh, Beirut', status: 'delivered', payment_method: 'cash', voucher_code: 'GV0001-AAAAAA', voucher_amount: 100,
    items: [{ sku: 'BR-02', unit_price: 450, quantity: 1 }, { sku: 'EA-04', unit_price: 120, quantity: 2 }] },
  { reference: 'S018', sale_date: '2026-11-03', customer_name: 'Lea "Lou" Khoury', email: 'lea@example.com', phone: '71',
    address: '', status: 'received', payment_method: 'cash', voucher_code: null, voucher_amount: 0,
    items: [{ sku: 'NK-01', unit_price: 490, quantity: 1 }] },
];

test('the sales download matches the Sales tab columns and leaves formula columns empty', () => {
  const lines = salesCsv(exportOrders).replace(/^\uFEFF/, '').trim().split('\r\n').map((l) => l.split(','));
  assert.equal(lines[0].length, 26, 'columns A to Z');
  assert.equal(lines[0][24], 'Gift Voucher Code');
  assert.deepEqual(lines[1], ['S017', '2026-11-02', 'Rana Haddad', 'Website', 'BR-02', '', '1', '450.00', 'Percentage', '0', '',
    'Cash', '350.00', '', '', '', '', '', '', '', '', '', '', '', 'GV0001-AAAAAA', '100.00']);
  assert.deepEqual(lines[2].slice(0, 13), ['S017', '2026-11-02', 'Rana Haddad', 'Website', 'EA-04', '', '2', '120.00', 'Percentage', '0', '', 'Cash', '240.00']);
  assert.equal(lines[2][24], '', 'the voucher is used up on the first piece');
  assert.equal(lines[3][12], '0.00', 'nothing counts as received before delivery');
});

test('the customers download lists each customer once, quoting names with commas or quotes', () => {
  const csv = customersCsv([...exportOrders, exportOrders[0]]);
  assert.equal(csv.trim().split('\r\n').length, 3);
  assert.match(csv, /"Lea ""Lou"" Khoury",71,,lea@example.com,,,Website/);
});

test('only the owner can download the workbook files', async () => {
  let who = { email: 'rana@example.com', email_confirmed_at: '2026-01-01' };
  handlers['/auth/v1/user'] = () => [200, who];
  handlers['/rest/v1/rpc/sales_export'] = () => [200, exportOrders];
  const get = (q) => exportSales(new Request(`https://siaram.test/api/export-sales?${q}`, { headers: { authorization: 'Bearer t' } }));

  assert.equal((await exportSales(new Request('https://siaram.test/api/export-sales?check=1'))).status, 401);
  assert.deepEqual(await (await get('check=1')).json(), { owner: false }, 'a customer is not the owner');
  assert.equal((await get('kind=sales')).status, 403, 'and cannot download');
  who = { email: 'SiaramJewelry@hotmail.com', email_confirmed_at: null };
  assert.deepEqual(await (await get('check=1')).json(), { owner: false }, 'the owner email must be confirmed');
  who = { email: 'SiaramJewelry@hotmail.com', email_confirmed_at: '2026-01-01' };
  assert.deepEqual(await (await get('check=1')).json(), { owner: true });

  const res = await get('kind=sales&from=2026-11-01&to=bad');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /Siaram-website-sales-from-2026-11-01\.csv/);
  assert.match(await res.text(), /S018,2026-11-03/);
  assert.deepEqual(calls.find((c) => c.url.endsWith('/rpc/sales_export')).body, { p_from: '2026-11-01', p_to: null });
  const bytes = Buffer.from(await (await get('kind=customers')).arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'starts with the marker Excel needs for accents');
  assert.match(bytes.toString('utf8', 3), /^Name,Phone/);
});

test('the website on another domain may call the functions', async () => {
  const { withCors } = await import('../supabase/functions/_shared/http.mjs');
  const wrapped = withCors(checkVoucher);
  const pre = await wrapped(new Request('https://x.supabase.co/functions/v1/check-voucher', { method: 'OPTIONS' }));
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-headers'), /authorization/);
  const res = await wrapped(request('/functions/v1/check-voucher', {}));
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------- "on its way" email
const dispatchRequest = (secret, body = { order_id: 'o1' }) => new Request('https://siaram.test/functions/v1/order-status',
  { method: 'POST', body: JSON.stringify(body), headers: secret ? { 'x-cron-secret': secret } : {} });
const dispatched = { ...savedOrder, reference: 'S017', status: 'dispatched', tracking_number: 'WAK-123', delivery_fee: 5 };

test('only the database can ask for the "on its way" email', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = (c) => [200, c.body.p_secret === 'right'];
  assert.equal((await orderStatus(dispatchRequest())).status, 403);
  assert.equal((await orderStatus(dispatchRequest('wrong'))).status, 403);
  assert.ok(!calls.some((c) => c.url.endsWith('/claim_dispatch_email')));
});

test('a dispatched order emails the customer once, with the tracking number and the cash to pay', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = () => [200, true];
  handlers['/rest/v1/rpc/claim_dispatch_email'] = () => [200, true];
  handlers['/rest/v1/rpc/order_summary'] = () => [200, dispatched];
  assert.deepEqual(await (await orderStatus(dispatchRequest('right'))).json(), { sent: true });
  const [mail] = emails();
  assert.equal(mail.to[0], 'rana@example.com');
  assert.equal(mail.subject, 'Your Siaram order S017 is on its way');
  assert.match(mail.html, /Wakilni tracking number: <strong>WAK-123<\/strong>/);
  assert.match(mail.html, /\$\d+\.\d\d<\/strong> in cash ready for the driver,\s+plus the \$5\.00 delivery fee/);

  calls.length = 0;
  handlers['/rest/v1/rpc/claim_dispatch_email'] = () => [200, false];
  assert.deepEqual((await (await orderStatus(dispatchRequest('right'))).json()).sent, false);
  assert.equal(emails().length, 0, 'a second request sends nothing');
});

test('if the email fails, the order can be emailed again later', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = () => [200, true];
  handlers['/rest/v1/rpc/claim_dispatch_email'] = (c) => [200, !c.body.p_release];
  handlers['/rest/v1/rpc/order_summary'] = () => [200, dispatched];
  handlers['/emails'] = () => [500, {}];
  assert.equal((await orderStatus(dispatchRequest('right'))).status, 502);
  assert.ok(calls.some((c) => c.url.endsWith('/claim_dispatch_email') && c.body.p_release === true));
});

// ---------------------------------------------------------------- custom-piece requests
function customForm(extra = {}) {
  const f = new FormData();
  const fields = { piece: 'Ring', gold: 'Rose gold', cut: 'Oval', setting: 'Bezel', size: 'EU 54', description: 'An oval emerald ring',
    name: 'Rana Haddad', email: 'rana@example.com', phone: '+961 70 000 000', budget: '$500–$1,000', ...extra };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  f.append('stones', 'Emerald');
  f.append('stones', 'Not a real stone');
  return f;
}
const post = (form) => customRequest(new Request('https://siaram.test/functions/v1/custom-request', { method: 'POST', body: form }));

test('a custom request is saved and emailed to the shop with the sketch, and the customer gets a copy', async () => {
  handlers['/rest/v1/rpc/save_custom_request'] = () => [200, { reference: 'CR001' }];
  const form = customForm();
  form.append('files', new File([new Uint8Array([137, 80, 78, 71])], 'my sketch.png', { type: 'image/png' }));
  const res = await post(form);
  assert.deepEqual(await res.json(), { reference: 'CR001' });
  const saved = calls.find((c) => c.url.endsWith('/save_custom_request')).body.p;
  assert.deepEqual(saved.stones, ['Emerald'], 'only listed stones are kept');
  assert.deepEqual(saved.files, ['my sketch.png']);
  assert.equal(saved.setting, 'Bezel');
  const [shop, customer] = emails();
  assert.equal(shop.subject, 'Custom request CR001 — Ring (Rana Haddad)');
  assert.equal(shop.reply_to, 'rana@example.com');
  assert.deepEqual(shop.attachments.map((a) => a.filename), ['my sketch.png']);
  assert.match(shop.html, /Rose gold/);
  assert.equal(customer.to[0], 'rana@example.com');
  assert.match(customer.html, /reply within 3 to 5 business days/);
  assert.equal(customer.attachments, undefined);
});

test('custom requests refuse a missing choice, wrong files and spam', async () => {
  assert.match((await (await post(customForm({ piece: 'Spaceship' }))).json()).error, /type of piece/);
  const big = customForm();
  big.append('files', new File([new Uint8Array(9 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' }));
  assert.match((await (await post(big)).json()).error, /larger than 8 MB/);
  const exe = customForm();
  exe.append('files', new File(['x'], 'virus.exe', { type: 'application/octet-stream' }));
  assert.match((await (await post(exe)).json()).error, /not a photo or PDF/);
  assert.equal((await post(customForm({ website: 'spam' }))).status, 400);
  assert.equal(emails().length, 0);
});

// ---------------------------------------------------------------- return and repair requests
function serviceForm(extra = {}) {
  const f = new FormData();
  const fields = { kind: 'Repair', order_ref: 's017', piece: 'Horse Shoe Ring', problem: 'A stone is loose',
    cause: 'I noticed it after it caught on a sweater', name: 'Rana Haddad', email: 'rana@example.com',
    phone: '+961 70 000 000', ...extra };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}
const withPhoto = (form) => { form.append('files', new File([new Uint8Array([255, 216, 255])], 'ring.jpg', { type: 'image/jpeg' })); return form; };
const postService = (form) => serviceRequest(new Request('https://siaram.test/functions/v1/service-request', { method: 'POST', body: form }));

test('a repair request is saved and emailed to the shop with the photos, and the customer is told to wait for instructions', async () => {
  handlers['/rest/v1/rpc/save_service_request'] = () => [200, { reference: 'RR001' }];
  const form = serviceForm();
  form.append('files', new File([new Uint8Array([255, 216, 255])], 'loose stone.jpg', { type: 'image/jpeg' }));
  const res = await postService(form);
  assert.deepEqual(await res.json(), { reference: 'RR001' });
  const saved = calls.find((c) => c.url.endsWith('/save_service_request')).body.p;
  assert.equal(saved.kind, 'Repair');
  assert.equal(saved.cause, 'I noticed it after it caught on a sweater');
  assert.deepEqual(saved.files, ['loose stone.jpg']);
  const [shop, customer] = emails();
  assert.equal(shop.subject, 'Repair request RR001 — S017 (Rana Haddad)');
  assert.equal(shop.reply_to, 'rana@example.com');
  assert.deepEqual(shop.attachments.map((a) => a.filename), ['loose stone.jpg']);
  assert.match(shop.html, /caught on a sweater/);
  assert.equal(customer.subject, 'Your repair request RR001');
  assert.match(customer.html, /do not send the piece until you receive our instructions/);
  assert.equal(customer.attachments, undefined);
});

test('return and repair requests refuse missing details, wrong files and spam', async () => {
  assert.match((await (await postService(serviceForm({ kind: 'Melt it' }))).json()).error, /return, exchange or repair/);
  assert.match((await (await postService(serviceForm())).json()).error, /at least one photo/);
  assert.match((await (await postService(withPhoto(serviceForm({ cause: '' })))).json()).error, /how the issue happened/);
  assert.match((await (await postService(withPhoto(serviceForm({ order_ref: ' ' })))).json()).error, /order or invoice number/);
  const many = serviceForm();
  for (let i = 0; i < 5; i++) many.append('files', new File(['x'], `p${i}.jpg`, { type: 'image/jpeg' }));
  assert.match((await (await postService(many)).json()).error, /up to 4 photos/);
  const exe = serviceForm();
  exe.append('files', new File(['x'], 'virus.exe', { type: 'application/octet-stream' }));
  assert.match((await (await postService(exe)).json()).error, /not a photo or PDF/);
  assert.equal((await postService(withPhoto(serviceForm({ website: 'spam' })))).status, 400);
  assert.equal(emails().length, 0);
});

// ---------------------------------------------------------------- gift voucher orders
const voucherOrder = (extra = {}) => ({ amount: 150, recipient_name: "Maya O'Neil", recipient_email: 'maya@example.com',
  recipient_phone: '', send_to: 'recipient', send_on: '2026-12-24', name: 'Rana Haddad', email: 'rana@example.com',
  phone: '+961 70 000 000', final_sale: true, ...extra });
const postVoucher = (body) => voucherRequest(new Request('https://siaram.test/functions/v1/voucher-request', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));

test('a gift voucher order is saved, the shop gets the line to issue it and the buyer is told it is final sale', async () => {
  handlers['/rest/v1/rpc/save_voucher_request'] = () => [200, { reference: 'VR001' }];
  const res = await postVoucher(voucherOrder());
  assert.deepEqual(await res.json(), { reference: 'VR001' });
  const saved = calls.find((c) => c.url.endsWith('/save_voucher_request')).body.p;
  assert.equal(saved.amount, 150);
  assert.equal(saved.send_on, '2026-12-24');
  const [shop, buyer] = emails();
  assert.equal(shop.subject, 'Gift voucher order VR001 — $150 (Rana Haddad)');
  assert.match(shop.html, /change VR001's\s+status from <strong>new<\/strong> to <strong>paid<\/strong>/);
  assert.match(shop.html, /emailed automatically on 2026-12-24/);
  assert.equal(buyer.subject, 'Your gift voucher order VR001');
  assert.match(buyer.html, /final sale/);
});

test('gift voucher orders refuse small amounts, no recipient contact, no final-sale tick and spam', async () => {
  assert.match((await (await postVoucher(voucherOrder({ amount: 50 }))).json()).error, /\$100 or more/);
  assert.match((await (await postVoucher(voucherOrder({ amount: 120.5 }))).json()).error, /whole dollars/);
  assert.match((await (await postVoucher(voucherOrder({ recipient_email: '' }))).json()).error, /email or WhatsApp/);
  assert.match((await (await postVoucher(voucherOrder({ send_to: 'neighbour' }))).json()).error, /who we should send/);
  assert.match((await (await postVoucher(voucherOrder({ final_sale: false }))).json()).error, /final sale/);
  assert.equal((await postVoucher(voucherOrder({ website: 'spam' }))).status, 400);
  assert.equal(emails().length, 0);
});

// ---------------------------------------------------------------- sending paid gift vouchers
const sendRequest = (secret, body = { request_id: 'v1' }) => new Request('https://siaram.test/functions/v1/voucher-send',
  { method: 'POST', body: JSON.stringify(body), headers: secret ? { 'x-cron-secret': secret } : {} });
const paidVoucher = { id: 'v1', reference: 'VR001', amount: 150, recipient_name: 'Maya Aoun', recipient_email: 'maya@example.com',
  recipient_phone: null, send_to: 'recipient', name: 'Rana Haddad', email: 'rana@example.com', voucher_code: 'GV0001-K7QM4X',
  expires_at: '2027-05-03T10:00:00Z' };

test('only the database can ask for a voucher to be sent', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = (c) => [200, c.body.p_secret === 'right'];
  assert.equal((await voucherSend(sendRequest())).status, 403);
  assert.equal((await voucherSend(sendRequest('wrong'))).status, 403);
  assert.ok(!calls.some((c) => c.url.endsWith('/claim_voucher_email')));
});

test('a paid voucher is emailed to the recipient with its code, and the buyer and the shop are told', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = () => [200, true];
  handlers['/rest/v1/rpc/claim_voucher_email'] = () => [200, paidVoucher];
  const res = await (await voucherSend(sendRequest('right'))).json();
  assert.deepEqual(res.results, [{ id: 'v1', sent: true, code: 'GV0001-K7QM4X' }]);
  const [gift, shop, buyer] = emails();
  assert.equal(gift.to[0], 'maya@example.com');
  assert.equal(gift.subject, 'Rana Haddad sent you a Siaram gift voucher');
  assert.match(gift.html, /GV0001-K7QM4X/);
  assert.match(gift.html, /Valid until 3 May 2027/);
  assert.equal(shop.to[0], 'shop@siaram.test');
  assert.equal(buyer.to[0], 'rana@example.com');
  assert.match(buyer.html, /emailed your \$150\.00 Siaram gift voucher to\s+Maya Aoun/);

  calls.length = 0;
  handlers['/rest/v1/rpc/claim_voucher_email'] = () => [200, null];
  assert.equal((await (await voucherSend(sendRequest('right'))).json()).results[0].sent, false);
  assert.equal(emails().length, 0, 'a second request, or one before the send date, sends nothing');
});

test('a voucher for the buyer to give, or for a recipient with only WhatsApp, goes to the buyer', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = () => [200, true];
  for (const v of [{ ...paidVoucher, send_to: 'purchaser' }, { ...paidVoucher, recipient_email: null, recipient_phone: '+961 71 000 000' }]) {
    calls.length = 0;
    handlers['/rest/v1/rpc/claim_voucher_email'] = () => [200, v];
    await voucherSend(sendRequest('right'));
    const [gift, shop, ...rest] = emails();
    assert.equal(gift.to[0], 'rana@example.com');
    assert.match(gift.html, /GV0001-K7QM4X/);
    assert.equal(shop.to[0], 'shop@siaram.test');
    assert.equal(rest.length, 0);
  }
});

test('the daily run sends every voucher that is due, and a failed email can be sent again later', async () => {
  handlers['/rest/v1/rpc/cron_secret_ok'] = () => [200, true];
  handlers['/rest/v1/rpc/vouchers_due'] = () => [200, ['v1', 'v2']];
  handlers['/rest/v1/rpc/claim_voucher_email'] = (c) => [200, c.body.p_release ? null : { ...paidVoucher, id: c.body.p_id }];
  const res = await (await voucherSend(sendRequest('right', { due: true }))).json();
  assert.deepEqual(res.results.map((r) => r.id), ['v1', 'v2']);
  calls.length = 0;
  handlers['/emails'] = () => [500, {}];
  assert.equal((await voucherSend(sendRequest('right'))).status, 502);
  assert.ok(calls.some((c) => c.url.endsWith('/claim_voucher_email') && c.body.p_release === true));
});
