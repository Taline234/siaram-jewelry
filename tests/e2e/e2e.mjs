// End-to-end store test in a real browser against server.mjs.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import pg from 'pg';
import fs from 'node:fs';

const ORIGIN = 'http://127.0.0.1:8788';
const SHOTS = process.argv[2] || new URL('./screenshots', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
const db = new pg.Client({ host: process.env.PGHOST, port: process.env.PGPORT, user: 'postgres', database: process.env.E2E_DB || 'siaram_e2e' });
await db.connect();
const q = async (sql, args) => (await db.query(sql, args)).rows;
const setState = (s) => fetch(`${ORIGIN}/__state`, { method: 'POST', body: JSON.stringify(s) }).then((r) => r.json());

const step = (name) => console.log(`ok - ${name}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm', (route) =>
  route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(new URL('./supabase.esm.js', import.meta.url)) }));
const errors = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
const failed = [];
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}${new URL(r.url()).search}`); });
const shot = async (name) => { await page.evaluate(() => document.querySelectorAll('.reveal,.product-card').forEach((e) => e.classList.add('in-view'))); await page.addStyleTag({ content: '.site-header{position:static}' }); await page.waitForTimeout(800); return page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

// ------------------------------------------------ store off: site behaves as before
await setState({ storeOn: false });
await page.goto(`${ORIGIN}/product-v-bird-necklace.html`);
await page.waitForTimeout(500);
assert.equal(await page.locator('.product-price').textContent(), '$520.00');
assert.equal(await page.locator('.product-buy').isHidden(), true);
assert.equal(await page.locator('.nav-store').count(), 0);
await page.goto(`${ORIGIN}/cart.html`);
assert.match(await page.locator('#store-root').textContent(), /Online ordering is coming soon/);
step('before setup: catalogue prices, no cart icons, "coming soon" on store pages');

// ------------------------------------------------ store on, guest shopping
await setState({ storeOn: true, emails: [] });
await page.goto(`${ORIGIN}/shop.html`);
await page.waitForSelector('.nav-store');
await page.waitForFunction(() => document.querySelector('[data-price-for="v-bird-necklace"]').textContent === '$120.00');
assert.equal(await page.locator('[data-price-for="horseshoe-ring"]').first().textContent(), '');
step('shop cards show prices; unpriced pieces show none');

await page.goto(`${ORIGIN}/product-horseshoe-ring.html`);
await page.waitForSelector('.product-buy:not([hidden])');
assert.equal(await page.locator('.add-to-cart').count(), 0);
assert.equal(await page.locator('.product-price').textContent(), 'Price on request');
assert.equal(await page.locator('.wishlist-btn').count(), 1);
step('unpriced piece: no Add to Cart, enquiry + wishlist only');

await page.goto(`${ORIGIN}/product-v-bird-necklace.html`);
await page.waitForSelector('.add-to-cart');
assert.equal(await page.locator('.product-price').textContent(), '$120.00');
await page.selectOption('.product-buy .qty-select', '2');
await page.click('.add-to-cart');
await page.waitForSelector('.store-toast.show');
assert.equal(await page.locator('.nav-store .cart-count').textContent(), '2');
await shot('product-page');
step('add 2 x V-Bird Necklace to cart; badge shows 2');

await page.goto(`${ORIGIN}/cart.html`);
await page.waitForSelector('.cart-line');
assert.match(await page.locator('.cart-total').textContent(), /\$240\.00/);
await page.selectOption('.cart-line .qty-select', '1');
await page.waitForFunction(() => document.querySelector('.cart-total').textContent.includes('$120.00'));
await shot('cart');
step('cart totals update when quantity changes');

await page.click('a.btn[href="checkout.html"]');
await page.waitForSelector('form.checkout-layout');
const govs = await page.locator('[name=governorate] option').allTextContents();
assert.ok(!govs.includes('South'), 'South is not offered');
assert.ok(govs.includes('Nabatieh') && govs.includes('Beirut'));
assert.match(await page.locator('.checkout-main').textContent(), /Within Lebanon, except South/);
step('checkout lists Lebanese governorates without South');

await page.fill('[name=customer_name]', 'Lea Saab');
await page.fill('[name=phone]', '+961 3 123 456');
await page.fill('[name=email]', 'lea@example.com');
await page.selectOption('[name=governorate]', 'Beirut');
await page.fill('[name=city]', 'Achrafieh');
await page.fill('[name=street]', 'Rue Monnot');
await page.fill('[name=voucher_code]', 'SIARAM-OLD0-0000');
await page.click('.voucher-apply');
await page.waitForFunction(() => /expired on/.test(document.querySelector('.voucher-msg').textContent));
step('expired gift voucher is refused at checkout');

await page.fill('[name=voucher_code]', 'siaram-good-0001');
await page.click('.voucher-apply');
await page.waitForFunction(() => /Voucher applied/.test(document.querySelector('.voucher-msg').textContent));
assert.match(await page.locator('.summary-total').textContent(), /To pay via Whish\s*\$70\.00/);
assert.match(await page.locator('.summary-note').textContent(), /Delivery: \$5\.00, paid to the courier in cash/);
step('valid voucher applied to the jewellery: 120 - 50 = 70 by Whish, $5 delivery paid to the courier');

await page.check('[name=accept_terms]');
await page.click('button[type=submit]');
await page.waitForFunction(() => /tick the confirmation/.test(document.querySelector('.checkout-error').textContent));
step('guest must confirm 18+');

await page.check('[name=age_confirmed]');
await shot('checkout');
await page.click('button[type=submit]');
await page.waitForSelector('.order-done');
const doneText = await page.locator('.order-done').textContent();
const ref = doneText.match(/SJ-[0-9A-F]{6}/)[0];
assert.match(doneText, /\$70\.00/);
assert.match(doneText, /delivery fee of \$5\.00 is paid to the courier in cash/);
assert.match(doneText, /\+961 76 052 068/);
await shot('order-confirmation');
const [guestOrder] = await q('select * from orders where reference = $1', [ref]);
assert.equal(guestOrder.user_id, null);
assert.equal(Number(guestOrder.total), 70);
assert.equal(Number(guestOrder.delivery_fee), 5);
assert.equal(guestOrder.fulfilment, 'delivery');
assert.equal(Number((await q("select balance from gift_vouchers where code = 'SIARAM-GOOD-0001'"))[0].balance), 0);
let { emails } = await setState({});
assert.deepEqual(emails.map((e) => e.to[0]).sort(), ['customerservice@siaramjewelry.com', 'lea@example.com']);
assert.equal(await page.locator('.nav-store .cart-count').isHidden(), true);
assert.equal(await page.evaluate(() => localStorage.getItem('siaram-cart')), null);
step(`guest order ${ref} saved, voucher used, emails to shop + customer, cart emptied`);

// ------------------------------------------------ accounts
await page.goto(`${ORIGIN}/account.html`);
await page.waitForSelector('[data-form=signup]');
const signup = async (dob, { accept = true, whatsapp = false } = {}) => {
  await page.fill('[data-form=signup] [name=first_name]', 'Rana');
  await page.fill('[data-form=signup] [name=last_name]', 'Haddad');
  await page.fill('[data-form=signup] [name=email]', 'rana@example.com');
  await page.fill('[data-form=signup] [name=phone]', '+961 70 000 000');
  await page.fill('[data-form=signup] [name=date_of_birth]', dob);
  await page.fill('[data-form=signup] [name=password]', 'correct-horse');
  await page.setChecked('[data-form=signup] [name=accept]', accept);
  await page.setChecked('[data-form=signup] [name=marketing_whatsapp]', whatsapp);
  await page.click('[data-form=signup] button');
};
await signup('', { accept: false });
await page.waitForFunction(() => /confirm you are 18 or older/.test(document.querySelector('[data-form=signup] .form-msg').textContent));
step('sign-up needs the "I am 18 or older" box');

const teen = new Date(); teen.setFullYear(teen.getFullYear() - 16);
await signup(teen.toISOString().slice(0, 10));
await page.waitForFunction(() => /18 or older/.test(document.querySelector('[data-form=signup] .form-msg').textContent));
assert.equal((await q("select count(*)::int as n from auth.users where email = 'rana@example.com'"))[0].n, 0);
await shot('account-signed-out');
step('under-18 birthday refused at sign-up');

await signup('', { whatsapp: true });
await page.waitForSelector('.account-tabs');
assert.match(await page.locator('.account-head h2').textContent(), /Hello, Rana/);
const [newProfile] = await q("select * from profiles where first_name = 'Rana'");
assert.equal(newProfile.date_of_birth, null);
assert.equal(newProfile.age_confirmed, true);
assert.equal(newProfile.marketing_email, false);
assert.equal(newProfile.marketing_whatsapp, true);
step('sign-up without a birthday works; WhatsApp opt-in saved, email left off');

await page.click('.account-tabs >> text=Addresses');
await page.waitForSelector('.address-form');
assert.ok(!(await page.locator('.address-form [name=governorate] option').allTextContents()).includes('South'));
await page.fill('.address-form [name=label]', 'Home');
await page.fill('.address-form [name=recipient_name]', 'Rana Haddad');
await page.fill('.address-form [name=phone]', '+961 70 000 000');
await page.selectOption('.address-form [name=governorate]', 'Mount Lebanon');
await page.fill('.address-form [name=city]', 'Jounieh');
await page.fill('.address-form [name=street]', 'Main Road');
await page.click('.address-form button');
await page.waitForSelector('.address-card');
assert.match(await page.locator('.address-card').textContent(), /Preferred/);
step('saved a preferred address');

await page.goto(`${ORIGIN}/product-crescent-moon-ring.html`);
await page.waitForSelector('.wishlist-btn');
await page.click('.wishlist-btn');
await page.waitForSelector('.wishlist-btn.saved');
await page.click('.add-to-cart');
await page.goto(`${ORIGIN}/account.html#wishlist`);
await page.waitForSelector('.wish-card');
assert.match(await page.locator('.wish-card').textContent(), /Crescent Moon Ring/);
await shot('account-wishlist');
step('wishlist saves a piece and lists it in the account');

await page.goto(`${ORIGIN}/checkout.html`);
await page.waitForSelector('form.checkout-layout');
assert.equal(await page.inputValue('[name=customer_name]'), 'Rana Haddad');
assert.equal(await page.inputValue('[name=email]'), 'rana@example.com');
assert.equal(await page.inputValue('[name=governorate]'), 'Mount Lebanon');
assert.equal(await page.locator('[name=age_confirmed]').count(), 0);
await page.check('[name=fulfilment][value=collection]');
assert.equal(await page.locator('.address-fields').isHidden(), true);
assert.match(await page.locator('.summary-note').textContent(), /Collection by appointment is free/);
await page.check('[name=accept_terms]');
await page.click('button[type=submit]');
await page.waitForSelector('.order-done');
assert.match(await page.locator('.order-done').textContent(), /free collection by appointment/);
const ref2 = (await page.locator('.order-done').textContent()).match(/SJ-[0-9A-F]{6}/)[0];
const [memberOrder] = await q('select o.*, p.first_name from orders o join profiles p on p.id = o.user_id where reference = $1', [ref2]);
assert.equal(memberOrder.first_name, 'Rana');
assert.equal(Number(memberOrder.total), 85);
assert.equal(memberOrder.fulfilment, 'collection');
step(`signed-in checkout prefilled from profile + preferred address; collection order ${ref2} linked to account`);

await page.goto(`${ORIGIN}/account.html#orders`);
await page.waitForSelector('.order-card');
assert.match(await page.locator('.order-card').textContent(), new RegExp(`${ref2}.*Awaiting payment`, 's'));
assert.equal(await page.locator('.order-card').count(), 1, 'guest order by someone else is not shown');
await shot('account-orders');
step('order history shows the order and its status');

await page.goto(`${ORIGIN}/account.html#details`);
await page.waitForSelector('.details-form');
assert.equal(await page.isChecked('.details-form [name=marketing_whatsapp]'), true);
await page.fill('.details-form [name=date_of_birth]', teen.toISOString().slice(0, 10));
await page.click('.details-form button');
await page.waitForFunction(() => /18 or older/.test(document.querySelector('.details-form .form-msg').textContent));
await page.fill('.details-form [name=phone]', '+961 70 999 999');
await page.fill('.details-form [name=date_of_birth]', '1995-04-02');
await page.uncheck('.details-form [name=marketing_whatsapp]');
await page.check('.details-form [name=marketing_email]');
await page.click('.details-form button');
await page.waitForFunction(() => document.querySelector('.details-form .form-msg').textContent === 'Saved.');
const [edited] = await q("select phone, to_char(date_of_birth, 'YYYY-MM-DD') as dob, marketing_email, marketing_whatsapp, marketing_updated_at from profiles where first_name = 'Rana'");
assert.deepEqual([edited.phone, edited.dob, edited.marketing_email, edited.marketing_whatsapp], ['+961 70 999 999', '1995-04-02', true, false]);
assert.ok(edited.marketing_updated_at);
step('customer can update details, add a birthday and change marketing choices');

await page.click('.sign-out');
await page.waitForSelector('[data-form=signin]');
await page.fill('[data-form=signin] [name=email]', 'rana@example.com');
await page.fill('[data-form=signin] [name=password]', 'wrong');
await page.click('[data-form=signin] button');
await page.waitForFunction(() => /Incorrect/.test(document.querySelector('[data-form=signin] .form-msg').textContent));
await page.fill('[data-form=signin] [name=password]', 'correct-horse');
await page.click('[data-form=signin] button');
await page.waitForSelector('.account-tabs');
step('sign out and sign back in');
const storage = await page.evaluate(() => ({ keys: Object.keys(localStorage).sort(), session: Object.keys(sessionStorage), cookie: document.cookie }));
const cookies = await ctx.cookies();
console.log('   browser storage:', JSON.stringify(storage), 'cookies:', cookies.length);
assert.equal(cookies.length, 0);
assert.equal(storage.cookie, '');
assert.deepEqual(storage.session, []);
assert.ok(storage.keys.every((k) => ['siaram-cart', 'siaram-last-active'].includes(k) || /^sb-[\w.-]+-auth-token$/.test(k)), storage.keys.join());
step('browser storage matches the Privacy Policy register (no cookies)');

await page.goto(`${ORIGIN}/account.html#details`);
await page.waitForSelector('.delete-account');
await page.click('.delete-account');
await page.waitForFunction(() => /has been deleted/.test(document.querySelector('#store-root').textContent));
assert.equal((await q("select count(*)::int as n from auth.users where email = 'rana@example.com'"))[0].n, 0);
assert.equal((await q('select user_id from orders where reference = $1', [ref2]))[0].user_id, null);
step('account deletion removes the account and keeps the order record');

// ------------------------------------------------ mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${ORIGIN}/product-v-bird-necklace.html`);
await page.waitForSelector('.add-to-cart');
await page.click('.add-to-cart');
await shot('mobile-product');
await page.goto(`${ORIGIN}/checkout.html`);
await page.waitForSelector('form.checkout-layout');
await shot('mobile-checkout');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
assert.equal(sw, 390, 'no horizontal scroll on phone');
step('mobile layout has no horizontal scroll');

console.log('   failed requests:', failed);
const expected = ['400 /api/check-voucher', '400 /sb/auth/v1/token?grant_type=password'];
assert.deepEqual(failed, expected, 'only the deliberate failures (expired voucher, wrong password)');
assert.deepEqual(errors.filter((e) => !/Failed to load resource/.test(e)), []);
step('no JavaScript errors');
await browser.close();
await db.end();
console.log('ALL END-TO-END STORE TESTS PASSED');
