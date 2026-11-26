// Tests for the Google Sheets workbook copy (workbook-sync), against an in-memory fake of Google Sheets.
// Run: node --test tests/workbook-sync-test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----\n`;

process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJservice';
process.env.RESEND_API_KEY = 'resend-key';
process.env.ORDER_NOTIFY_EMAIL = 'shop@siaram.test';
process.env.GOOGLE_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'robot@siaram.iam.gserviceaccount.com', private_key: pem });
process.env.WORKBOOK_SHEET_ID = 'sheet123';
globalThis.RETRY_DELAY_MS = 0;
let unavailable = 0; // how many Google Sheets answers are '503 unavailable' before it works again

const { default: workbookSync } = await import('../supabase/functions/_shared/handlers/workbook-sync.mjs');

const SALES_HEAD = ['Invoice #', 'Sale Date', 'Customer', 'Sales Channel', 'SKU', 'Batch (auto)', 'Qty'];
const col = (letter) => letter.charCodeAt(0) - 65;

// The fake workbook: tabs of rows (arrays of strings), like Google returns them.
let sheet;
let db;
let calls;
let emails;
let lastError;
let running;

function cellsOf(range) {
  const m = /^'(.+)'!([A-Z])(\d+)(?::([A-Z])(\d*))?$/.exec(decodeURIComponent(range));
  return { tab: m[1].replace(/''/g, "'"), from: col(m[2]), row: Number(m[3]), to: m[4] ? col(m[4]) : col(m[2]) };
}

beforeEach(() => {
  sheet = {
    Sales: [['Siaram finance'], SALES_HEAD,
      ['S016', '2026-10-29', 'Maya', 'In person', 'RG-02', '=batch()', '1', '', '', '', '', 'Cash', '$90.00']],
    Customers: [['Name', 'Phone'], ['Maya', '+961 3']],
  };
  db = [];
  calls = [];
  emails = [];
  lastError = null;
  running = false;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body && u.hostname !== 'oauth2.googleapis.com' ? JSON.parse(init.body) : init.body;
    calls.push({ url: u, method: init.method || 'GET', body });
    const reply = (status, data) => new Response(JSON.stringify(data), { status });
    if (u.hostname === 'oauth2.googleapis.com') {
      const jwt = new URLSearchParams(body).get('assertion').split('.');
      const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey,
        Buffer.from(jwt[2], 'base64url'), new TextEncoder().encode(`${jwt[0]}.${jwt[1]}`));
      return ok ? reply(200, { access_token: 'tok' }) : reply(400, { error: 'invalid_grant' });
    }
    if (u.hostname === 'api.resend.com') { emails.push(body); return reply(200, { id: 'e' }); }
    if (u.hostname === 'db.test') {
      const name = u.pathname.split('/').pop();
      if (name === 'cron_secret_ok') return reply(200, body.p_secret === 'right');
      if (name === 'workbook_orders') return reply(200, db);
      if (name === 'claim_workbook_sync') { const ok = !running; running = true; return reply(200, ok); }
      if (name === 'finish_workbook_sync') { const prev = lastError; lastError = body.p_error || null; running = false; return reply(200, prev); }
    }
    if (u.hostname === 'sheets.googleapis.com' && unavailable > 0) {
      unavailable -= 1;
      return reply(503, { error: { message: 'The service is currently unavailable.' } });
    }
    if (u.hostname === 'sheets.googleapis.com') {
      assert.equal(init.headers.authorization, 'Bearer tok');
      const path = decodeURIComponent(u.pathname.replace('/v4/spreadsheets/sheet123', ''));
      if (path === '' ) return reply(200, { sheets: Object.keys(sheet).map((title, i) => ({ properties: { title, sheetId: i + 10 } })) });
      if (path.startsWith('/values/')) {
        const { tab, from, to } = cellsOf(path.slice(8).replace(/:([A-Z])$/, ':$1'));
        const rows = (sheet[tab] || []).map((r) => r.slice(from, to + 1));
        return reply(200, { values: rows });
      }
      if (path === '/values:batchUpdate') {
        for (const d of body.data) {
          const { tab, from, row } = cellsOf(d.range);
          while (sheet[tab].length < row) sheet[tab].push([]);
          const r = sheet[tab][row - 1];
          d.values[0].forEach((v, i) => { while (r.length < from + i) r.push(''); r[from + i] = String(v); });
        }
        return reply(200, {});
      }
      if (path === ':batchUpdate') {
        for (const { deleteDimension: { range } } of body.requests) {
          const title = Object.keys(sheet)[range.sheetId - 10];
          sheet[title].splice(range.startIndex, 1);
        }
        return reply(200, {});
      }
    }
    return reply(404, {});
  };
  console.error = () => {};
});

const run = (secret = 'right') => workbookSync(new Request('https://siaram.test/workbook-sync',
  { method: 'POST', body: '{}', headers: { 'x-cron-secret': secret } }));

const order = (reference, extra = {}) => ({
  reference, sale_date: '2026-11-20', customer_name: 'Rana Haddad', email: 'rana@example.com', phone: '+961 70 123',
  address: 'St 1, Achrafieh, Beirut', status: 'received', payment_method: 'cash', channel: 'Website',
  voucher_code: null, voucher_amount: 0,
  items: [{ sku: 'NK-07', unit_price: 120, quantity: 1, made_to_order: false },
          { sku: 'RG-01', unit_price: 85, quantity: 1, made_to_order: false }],
  ...extra,
});

test('only the database scheduler may start a copy', async () => {
  assert.equal((await run('wrong')).status, 403);
});

test('new pieces and customers are added below the last row, leaving formula columns alone', async () => {
  db = [order('S017')];
  const out = await (await run()).json();
  assert.deepEqual(out, { added: 2, updated: 0, removed: 0, customers: 1 });
  const [a, b] = sheet.Sales.slice(3);
  assert.deepEqual(a.slice(0, 5), ['S017', '2026-11-20', 'Rana Haddad', 'Website', 'NK-07']);
  assert.equal(a[col('F')], '', 'Batch (a formula column) is not written');
  assert.equal(a[col('G')], '1');
  assert.equal(a[col('H')], '120');
  assert.equal(a[col('M')], '0', 'not delivered yet, so no cash received');
  assert.equal(b[col('E')], 'RG-01');
  assert.equal(sheet.Sales[2][col('F')], '=batch()', 'existing rows are untouched');
  assert.deepEqual(sheet.Customers[2], ['Rana Haddad', "'+961 70 123", '', 'rana@example.com', 'St 1, Achrafieh, Beirut', '', 'Website']);
  assert.equal(lastError, null);
});

test('running again adds nothing twice, and rows pasted by hand count as already there', async () => {
  db = [order('S017'), order('S016', { customer_name: 'maya', items: [{ sku: 'RG-02', unit_price: 90, quantity: 1 }], channel: 'In person' })];
  await run();
  const rows = sheet.Sales.length;
  const out = await (await run()).json();
  assert.deepEqual(out, { added: 0, updated: 0, removed: 0, customers: 0 });
  assert.equal(sheet.Sales.length, rows);
  assert.equal(sheet.Sales.filter((r) => r[0] === 'S016').length, 1);
  assert.equal(sheet.Customers.length, 3, 'Maya is matched by name whatever the capitals');
});

test('cash received is filled in once the order is delivered', async () => {
  db = [order('S017')];
  await run();
  db = [order('S017', { status: 'delivered' })];
  const out = await (await run()).json();
  assert.equal(out.updated, 2);
  assert.deepEqual(sheet.Sales.slice(3).map((r) => r[col('M')]), ['120', '85']);
});

test('the rows of a cancelled order are removed', async () => {
  db = [order('S017'), order('S018', { customer_name: 'Lea' })];
  await run();
  db = [order('S017', { status: 'cancelled' }), order('S018', { customer_name: 'Lea' })];
  const out = await (await run()).json();
  assert.equal(out.removed, 2);
  assert.deepEqual(sheet.Sales.slice(2).map((r) => r[0]), ['S016', 'S018', 'S018']);
});

test('each problem is emailed once, and a new problem is emailed too', async () => {
  sheet.Sales[1][0] = 'Invoice';
  db = [order('S017')];
  const res = await run();
  assert.equal(res.status, 500);
  assert.match(lastError, /no "Invoice #" heading/);
  assert.equal(emails.length, 1);
  assert.match(emails[0].html, /Invoice #/);
  await run();
  assert.equal(emails.length, 1, 'no second email for the same problem');
  sheet.Customers[0][0] = 'Client';
  sheet.Sales[1][0] = 'Invoice #';
  await run();
  assert.equal(emails.length, 2, 'a different problem is emailed');
  assert.match(emails[1].html, /no &quot;Name&quot; heading|no "Name" heading/);
  sheet.Customers[0][0] = 'Name';
  await run();
  assert.equal(lastError, null);
});

test('text that looks like a formula is written as text', async () => {
  db = [order('S017', { customer_name: '=HYPERLINK("x")' })];
  await run();
  assert.equal(sheet.Sales[3][col('C')], `'=HYPERLINK("x")`);
});

test('a brief Google outage (503) is tried again, with no error and no email', async () => {
  db = [order('S017')];
  unavailable = 2;
  const out = await (await run()).json();
  assert.equal(out.added, 2);
  assert.equal(lastError, null);
  assert.equal(emails.length, 0);
});

test('a longer Google outage is reported once', async () => {
  db = [order('S017')];
  unavailable = 100;
  assert.equal((await run()).status, 500);
  assert.match(lastError, /503|unavailable/);
  assert.equal(emails.length, 1);
  unavailable = 0;
});
