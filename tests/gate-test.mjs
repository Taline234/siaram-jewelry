// Tests for the private-access gate (worker/gate.js). Run: node --test tests/gate-test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import gate from '../worker/gate.js';

const assets = { fetch: async (req) => new Response('SHOP PAGE ' + new URL(req.url).pathname, { status: 200 }) };
const site = 'https://siaramjewelry.com';
const get = (path, env, cookie) =>
  gate.fetch(new Request(site + path, { headers: cookie ? { Cookie: cookie } : {} }), { ASSETS: assets, ...env });
const post = (password, next = '/shop.html') =>
  gate.fetch(new Request(site + '/__private-access', {
    method: 'POST', body: new URLSearchParams({ password, next }),
  }), { ASSETS: assets, SITE_PASSWORD: 'marais' });

test('without a password set, the site is open as before', async () => {
  const res = await get('/shop.html', {});
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'SHOP PAGE /shop.html');
});

test('with a password set, visitors see the private access page', async () => {
  const res = await get('/shop.html', { SITE_PASSWORD: 'marais' });
  assert.equal(res.status, 503);
  const html = await res.text();
  assert.match(html, /Private access/);
  assert.match(html, /value="\/shop.html"/);
  assert.doesNotMatch(html, /SHOP PAGE/);
});

test('the logo stays reachable and robots are told to stay away', async () => {
  assert.equal((await get('/images/logo-transparent.png', { SITE_PASSWORD: 'marais' })).status, 200);
  assert.match(await (await get('/robots.txt', { SITE_PASSWORD: 'marais' })).text(), /Disallow: \//);
  assert.equal((await get('/images/products/x.jpg', { SITE_PASSWORD: 'marais' })).status, 503);
});

test('a wrong password is refused', async () => {
  const res = await post('wrong');
  assert.equal(res.status, 401);
  assert.match(await res.text(), /isn’t right/);
});

test('the right password signs in and returns to the page', async () => {
  const res = await post('marais');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('Location'), '/shop.html');
  const cookie = res.headers.get('Set-Cookie').split(';')[0];
  assert.doesNotMatch(cookie, /marais/);
  const page = await get('/shop.html', { SITE_PASSWORD: 'marais' }, cookie);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), 'SHOP PAGE /shop.html');
});

test('changing the password signs everyone out', async () => {
  const cookie = (await post('marais')).headers.get('Set-Cookie').split(';')[0];
  assert.equal((await get('/', { SITE_PASSWORD: 'new-one' }, cookie)).status, 503);
});

test('sign-in only redirects within the site', async () => {
  for (const next of ['https://evil.example', '//evil.example', '/\\evil.example']) {
    assert.equal((await post('marais', next)).headers.get('Location'), '/');
  }
});
