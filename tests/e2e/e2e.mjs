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
assert.equal(await page.locator('.product-price').textContent(), '$559.00');
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
assert.equal(await page.locator('[data-price-for="v-bird-necklace"]').locator('xpath=..').locator('.card-add').count(), 1);
assert.equal(await page.locator('[data-price-for="horseshoe-ring"]').first().locator('xpath=..').locator('.card-add').count(), 0);
assert.equal(await page.locator('[data-price-for="crescent-moon-ring"]').first().locator('xpath=..').locator('a.card-add').getAttribute('href'),
  'product-crescent-moon-ring.html', 'rings send shoppers to the page to choose a size');
await page.locator('[data-price-for="v-bird-necklace"]').first().locator('xpath=..').locator('.card-add').click();
await page.waitForSelector('.store-toast.show');
assert.equal(await page.locator('.nav-store .cart-count').textContent(), '1');
await page.evaluate(() => localStorage.clear());
step('shop cards show prices and Add to Cart; unpriced pieces keep the email enquiry');

await page.goto(`${ORIGIN}/index.html`);
await page.waitForSelector('.nav-store');
assert.equal(await page.locator('[data-grid="bestsellers"] .product-card').count(), 5, 'the five horseshoe bestsellers on the home page');
assert.equal(await page.locator('[data-grid="bestsellers"] .card-badge').count(), 5);
assert.equal(await page.locator('[data-grid="bestsellers"] [data-price-for="horse-eye-necklace"]').count(), 0);
await page.fill('.newsletter-form [name=email]', 'not an email');
await page.click('.newsletter-form button');
assert.match(await page.locator('.newsletter-msg').textContent(), /valid email/);
await page.fill('.newsletter-form [name=email]', 'Maya@Example.com');
await page.click('.newsletter-form button');
await page.waitForFunction(() => /on the list/.test(document.querySelector('.newsletter-msg').textContent));
const [sub] = await q("select status, source, consent_wording from newsletter_subscribers where email = 'maya@example.com'");
assert.equal(sub.status, 'subscribed');
assert.equal(sub.source, 'index.html');
await page.fill('.newsletter-form [name=email]', 'maya@example.com');
await page.click('.newsletter-form button');
await page.waitForFunction(() => /already on our list/.test(document.querySelector('.newsletter-msg').textContent));
step('home shows the horseshoe bestsellers; the footer sign-up saves the email once, with its consent wording');

await page.goto(`${ORIGIN}/custom.html`);
await page.waitForSelector('.custom-form');
await page.click('.custom-form button[type=submit]');
assert.match(await page.locator('.custom-form .form-msg').textContent(), /type of piece/);
await page.check('.custom-form [name=piece][value=Ring]', { force: true });
await page.check('.custom-form [name=gold][value="Rose gold"]', { force: true });
await page.check('.custom-form [name=stones][value=Diamond]', { force: true });
await page.check('.custom-form [name=stones][value=Other]', { force: true });
assert.ok(await page.locator('.custom-form [name=stones_other]').isVisible(), '"Other" gemstones asks which ones');
await page.click('.custom-form button[type=submit]');
assert.match(await page.locator('.custom-form .form-msg').textContent(), /which other gemstones/);
await page.fill('.custom-form [name=stones_other]', 'Amethyst');
await page.selectOption('.custom-form [name=cut]', 'Oval');
await page.selectOption('.custom-form [name=setting]', 'Halo');
assert.ok(await page.locator('.size-panel[data-for=Ring]').isVisible(), 'a ring shows ring sizes');
assert.ok(await page.locator('.neck-picker').isHidden(), 'a ring hides the necklace lengths');
await page.click('.ring-choices [data-size^="EU 54"]');
assert.equal(await page.inputValue('.custom-form [name=size]'), 'EU 54 · US 7', 'choosing a size fills the size box');
await page.fill('.custom-form [name=description]', 'An oval diamond ring with my initials inside');
await page.setInputFiles('.custom-form [name=files]', { name: 'sketch.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
await page.fill('.custom-form [name=name]', 'Nour Aoun');
await page.fill('.custom-form [name=phone]', '+44 7700 900123');
await page.fill('.custom-form [name=email]', 'nour@example.com');
assert.equal(await page.locator('.custom-form a[href="size-guide.html"]').count(), 1, 'the form links to the size guide');
await page.click('.custom-form [data-guide=settings]');
assert.ok(await page.locator('#size-guide-settings').isVisible(), 'the settings guide opens as a pop-up on the same page');
assert.equal(await page.locator('#size-guide-settings img.cut-photo').count(), 8, 'the settings guide shows 8 setting photos');
await page.click('#size-guide-settings .size-guide-close');
await page.click('.custom-form button[type=submit]');
await page.waitForSelector('.custom-done');
assert.match(await page.locator('.custom-done').textContent(), /CR\d{3}/);
const [customRow] = await q("select piece, gold, stones, cut, setting, files from custom_requests where email = 'nour@example.com'");
assert.deepEqual([customRow.piece, customRow.gold, customRow.stones, customRow.cut, customRow.setting, customRow.files],
  ['Ring', 'Rose gold', ['Diamond', 'Other: Amethyst'], 'Oval', 'Halo', ['sketch.png']]);
const customMails = (await setState({})).emails.filter((e) => /Custom request|custom piece request/.test(e.subject));
assert.equal(customMails.length, 2);
assert.deepEqual(customMails.find((e) => e.to[0] === 'customerservice@siaramjewelry.com').attachments.map((a) => a.filename), ['sketch.png']);
await setState({ emails: [] });
await page.goto(`${ORIGIN}/size-guide.html`);
assert.equal(await page.locator('#rings .size-table tbody tr').count(), 21);
await page.goto(`${ORIGIN}/materials.html`);
assert.match(await page.locator('#gemstones').textContent(), /Diamond/);
assert.equal(await page.locator('#birthstones tbody tr').count(), 12);
step('custom request form: choices, sketch upload, saved with a CR number, emailed to the shop with the sketch; guide pages');

await page.goto(`${ORIGIN}/return-repair.html`);
await page.waitForSelector('.service-form');
await page.click('.service-form button[type=submit]');
assert.match(await page.locator('.service-form .form-msg').textContent(), /return, exchange or repair/);
await page.check('.service-form [name=kind][value=Repair]', { force: true });
await page.fill('.service-form [name=order_ref]', 's017');
await page.fill('.service-form [name=piece]', 'Horse Shoe Ring');
await page.fill('.service-form [name=problem]', 'One of the small stones is loose');
await page.fill('.service-form [name=cause]', 'Noticed it after it caught on my sweater');
await page.setInputFiles('.service-form [name=files]', { name: 'ring.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([255, 216, 255]) });
await page.fill('.service-form [name=name]', 'Nour Aoun');
await page.fill('.service-form [name=phone]', '+961 70 123 456');
await page.fill('.service-form [name=email]', 'nour@example.com');
await page.click('.service-form button[type=submit]');
await page.waitForSelector('.service-done');
assert.match(await page.locator('.service-done').textContent(), /RR\d{3}/);
const [serviceRow] = await q("select kind, order_ref, piece, cause, files from service_requests where email = 'nour@example.com'");
assert.deepEqual([serviceRow.kind, serviceRow.order_ref, serviceRow.piece, serviceRow.cause, serviceRow.files],
  ['Repair', 'S017', 'Horse Shoe Ring', 'Noticed it after it caught on my sweater', ['ring.jpg']]);
const serviceMails = (await setState({})).emails.filter((e) => /Repair request|repair request/.test(e.subject));
assert.equal(serviceMails.length, 2);
assert.deepEqual(serviceMails.find((e) => e.to[0] === 'customerservice@siaramjewelry.com').attachments.map((a) => a.filename), ['ring.jpg']);
await setState({ emails: [] });
step('return and repair form: saved with an RR number, emailed to the shop with the photos and a copy to the customer');

await page.goto(`${ORIGIN}/gift-voucher.html`);
await page.waitForSelector('.voucher-form');
await page.check('.voucher-form [name=amount_choice][value=other]', { force: true });
assert.ok(await page.locator('.voucher-other').isVisible(), 'choosing Other shows the amount box');
await page.fill('.voucher-form [name=amount_other]', '80');
await page.click('.voucher-form button[type=submit]');
assert.match(await page.locator('.voucher-form .form-msg').textContent(), /start at \$100/);
await page.fill('.voucher-form [name=amount_other]', '400');
await page.fill('.voucher-form [name=recipient_name]', 'Maya Aoun');
await page.fill('.voucher-form [name=recipient_phone]', '+961 71 222 333');
await page.check('.voucher-form [name=send_to][value=purchaser]', { force: true });
await page.fill('.voucher-form [name=name]', 'Nour Aoun');
await page.fill('.voucher-form [name=phone]', '+961 70 123 456');
await page.fill('.voucher-form [name=email]', 'nour@example.com');
await page.click('.voucher-form button[type=submit]');
assert.match(await page.locator('.voucher-form .form-msg').textContent(), /final sale/);
await page.check('.voucher-form [name=final_sale]');
await page.click('.voucher-form button[type=submit]');
await page.waitForSelector('.voucher-done');
assert.match(await page.locator('.voucher-done').textContent(), /VR\d{3}/);
const [voucherRow] = await q("select amount, recipient_phone, send_to from voucher_requests where email = 'nour@example.com'");
assert.deepEqual([Number(voucherRow.amount), voucherRow.recipient_phone, voucherRow.send_to], [400, '+961 71 222 333', 'purchaser']);
const voucherMails = (await setState({})).emails.filter((e) => /gift voucher order/i.test(e.subject));
assert.equal(voucherMails.length, 2);
await setState({ emails: [] });
step('gift voucher order form: amount check, final-sale tick, saved with a VR number, emailed to the shop and the buyer');

await page.goto(`${ORIGIN}/product-horseshoe-ring.html`);
await page.waitForSelector('.product-buy:not([hidden])');
assert.equal(await page.locator('.add-to-cart').count(), 0);
assert.equal(await page.locator('.product-price').textContent(), 'Price on request');
assert.equal(await page.locator('.wishlist-btn').count(), 1);
step('unpriced piece: no Add to Cart, enquiry + wishlist only');

await page.goto(`${ORIGIN}/product-v-bird-necklace.html`);
await page.waitForSelector('.add-to-cart');
assert.equal(await page.locator('.product-price').textContent(), '$120.00');
assert.equal(await page.locator('.product-actions a[href^="mailto:"]').count(), 0);
assert.match(await page.locator('.made-to-order-note').textContent(), /made to order: allow 3 to 4 weeks\. Made-to-order pieces are final sale\./);
await page.waitForSelector('.stock-status .availability');
assert.match(await page.locator('.stock-status').textContent(), /In stock · ships in 1–2 business days/, 'yellow gold is in stock');
await page.selectOption('.product-buy .qty-select', '2');
assert.match(await page.locator('.stock-status').textContent(), /Made to order · 3–4 weeks, paid by Whish, final sale Only 1 in stock: choose 1 to receive it in 1–2 business days\./,
  'asking for more than is in stock says made to order before the order, as the database will decide');
await page.selectOption('.product-buy .qty-select', '1');
assert.match(await page.locator('.stock-status').textContent(), /In stock/, 'back to one: in stock again');
await page.click('.metal-choice:has([value=rose])');
assert.match(await page.locator('.stock-status').textContent(), /Made to order · 3–4 weeks, paid by Whish, final sale/, 'rose gold is made to order');
await page.selectOption('.product-buy .qty-select', '2');
await page.click('.add-to-cart');
await page.waitForSelector('.store-toast.show');
assert.equal(await page.locator('.nav-store .cart-count').textContent(), '2');
await shot('product-page');
step('add 2 x V-Bird Necklace to cart; badge shows 2');

await page.goto(`${ORIGIN}/cart.html`);
await page.waitForSelector('.cart-line');
assert.equal(await page.locator('.cart-options').textContent(), '18k rose gold');
assert.match(await page.locator('.cart-line .availability').textContent(), /Made to order/);
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
assert.match(await page.locator('.checkout-main').textContent(), /within Lebanon, except South, by Wakilni/);
assert.equal(await page.locator('[name=fulfilment][value=collection]').count(), 0, 'collection is not offered');
assert.equal(await page.locator('.checkout-mode a[href="account.html?next=checkout.html#create"]').count(), 1, 'guests can create an account');
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
assert.match(await page.locator('.summary-total').textContent(), /To pay by Whish before production\s*\$70\.00/,
  'the rose gold piece is made to order, so it is paid by Whish');
assert.match(await page.locator('.summary-note').textContent(), /Delivery: \$5\.00, paid to the courier in cash/);
step('valid voucher applied to the jewellery: 120 - 50 = 70 by Whish (made to order), $5 delivery paid to the courier');

assert.match(await page.locator('.checkout-mode').textContent(), /Continue as a guest/, 'guest checkout is shown clearly');
assert.equal(await page.locator('form.checkout-layout [name=marketing_email]').count(), 0, 'checkout does not subscribe anyone');
assert.match(await page.locator('.terms-summary').textContent(), /customs clearance/, 'checkout shows the delivery and returns terms');
await page.check('[name=accept_terms]');
await page.click('button[type=submit]');
await page.waitForFunction(() => /tick the confirmation/.test(document.querySelector('.checkout-error').textContent));
step('guest must confirm 18+');

await page.check('[name=age_confirmed]');
await shot('checkout');
await page.click('button[type=submit]');
await page.waitForSelector('.order-done');
const doneText = await page.locator('.order-done').textContent();
const ref = doneText.match(/S\d{3,}/)[0];
assert.match(doneText, /\$70\.00/);
assert.match(doneText, /delivery fee of \$5\.00 is paid to the courier in cash/);
assert.match(doneText, /We will email you when it ships/, 'the customer is told what happens next');
await shot('order-confirmation');
const [guestOrder] = await q('select * from orders where reference = $1', [ref]);
assert.ok(guestOrder.terms_accepted_at, 'the order records that the delivery and returns terms were accepted');
assert.match(ref, /^S\d{3}$/, 'order numbers look like the workbook invoice numbers');
assert.equal(guestOrder.user_id, null);
assert.equal(Number(guestOrder.total), 70);
assert.equal(Number(guestOrder.delivery_fee), 5);
assert.equal(guestOrder.fulfilment, 'delivery');
assert.equal(guestOrder.payment_method, 'cash');
assert.equal(guestOrder.status, 'received');
assert.equal((await q('select made_to_order from order_items where order_id = $1', [guestOrder.id]))[0].made_to_order, true,
  'the rose gold piece is recorded as made to order');
assert.equal(Number((await q("select balance from gift_vouchers where code = 'SIARAM-GOOD-0001'"))[0].balance), 0);
let { emails } = await setState({});
assert.deepEqual(emails.map((e) => e.to[0]).sort(), ['customerservice@siaramjewelry.com', 'lea@example.com']);
assert.equal(await page.locator('.nav-store .cart-count').isHidden(), true);
assert.equal(await page.evaluate(() => localStorage.getItem('siaram-cart')), null);
step(`guest order ${ref} saved, voucher used, emails to shop + customer, cart emptied`);

// ------------------------------------------------ accounts
await page.goto(`${ORIGIN}/account.html`);
await page.waitForSelector('[data-form=signup]');
// Birthdays are chosen as day, month and year; '' leaves all three empty.
const pickBirthday = async (form, iso) => {
  const [y, m, d] = iso ? iso.split('-') : ['', '', ''];
  await page.selectOption(`${form} [name=bday_day]`, d);
  await page.selectOption(`${form} [name=bday_month]`, m);
  await page.selectOption(`${form} [name=bday_year]`, y);
};
const signup = async (dob, { accept = true, whatsapp = false } = {}) => {
  await page.fill('[data-form=signup] [name=first_name]', 'Rana');
  await page.fill('[data-form=signup] [name=last_name]', 'Haddad');
  await page.fill('[data-form=signup] [name=email]', 'rana@example.com');
  await page.fill('[data-form=signup] [name=phone]', '+961 70 000 000');
  await pickBirthday('[data-form=signup]', dob);
  await page.fill('[data-form=signup] [name=password]', 'correct-horse');
  await page.setChecked('[data-form=signup] [name=accept]', accept);
  await page.setChecked('[data-form=signup] [name=marketing_whatsapp]', whatsapp);
  await page.click('[data-form=signup] button');
};
await signup('', { accept: false });
await page.waitForFunction(() => /confirm you are 18 or older/.test(document.querySelector('[data-form=signup] .form-msg').textContent));
step('sign-up needs the "I am 18 or older" box');

const teen = new Date(Date.UTC(new Date().getFullYear() - 18, 11, 31)); // turns 18 on 31 December
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
assert.match(await page.locator('.store-toast').textContent(), /choose a size/, 'a ring needs a size');
await page.click('.size-guide-open');
assert.equal(await page.locator('#size-guide-ring').isVisible(), true, 'the ring size guide opens as a pop-up');
await page.click('#size-guide-ring .size-guide-close');
await page.selectOption('.size-select', 'EU 54');
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
assert.equal(await page.locator('.address-fields').isVisible(), true, 'the address is always asked for');
assert.match(await page.locator('.summary-total').textContent(), /To pay in cash on delivery\s*\$85\.00/);
await page.check('[name=accept_terms]');
await page.click('button[type=submit]');
await page.waitForSelector('.order-done');
assert.match(await page.locator('.order-done').textContent(), /pay \$85\.00 in cash to the driver/);
assert.equal((await q("select quantity from stock where product_slug = 'crescent-moon-ring' and size = 'EU 54'"))[0].quantity, 0,
  'the order takes the ring off stock');
const ref2 = (await page.locator('.order-done').textContent()).match(/S\d{3,}/)[0];
const [memberOrder] = await q('select o.*, p.first_name from orders o join profiles p on p.id = o.user_id where reference = $1', [ref2]);
assert.equal(memberOrder.first_name, 'Rana');
assert.equal(Number(memberOrder.total), 85);
assert.equal(memberOrder.fulfilment, 'delivery');
assert.equal(memberOrder.governorate, 'Mount Lebanon');
assert.equal(memberOrder.payment_method, 'cash');
step(`signed-in checkout prefilled from profile + preferred address; order ${ref2} delivered, paid in cash, linked to account`);

await page.goto(`${ORIGIN}/account.html#orders`);
await page.waitForSelector('.order-card');
assert.match(await page.locator('.order-card').textContent(), new RegExp(`${ref2}.*Order received`, 's'));
assert.equal(await page.locator('.order-card').count(), 1, 'guest order by someone else is not shown');
await shot('account-orders');
step('order history shows the order and its status');

assert.equal(await page.locator('.account-tabs a[href="#workbook"]').count(), 0, 'customers do not see the Workbook tab');
await setState({ ownerEmails: 'rana@example.com' });
await page.goto(`${ORIGIN}/account.html#workbook`);
await page.reload();
await page.waitForSelector('.workbook-form');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('.workbook-form [data-kind=workbook]')]);
assert.match(download.suggestedFilename(), /^Siaram-workbook\.xlsx$/);
const workbookFile = fs.readFileSync(await download.path());
assert.equal(workbookFile.subarray(0, 2).toString(), 'PK', 'an Excel file');
const workbookText = workbookFile.toString('utf8');
assert.match(workbookText, /<sheet name="Sales"[^>]*\/><sheet name="Customers"/, 'with a Sales tab and a Customers tab');
assert.ok(workbookText.includes(`<t xml:space="preserve">${ref2}</t>`), 'listing the website order');
await shot('account-workbook');
step('the owner gets a Workbook tab and downloads one Excel file with Sales and Customers tabs');

assert.deepEqual(await page.locator('.account-tabs a').allTextContents(), ['Record a Sale', 'Workbook'],
  'the owner gets an admin page, not the customer tabs');
await page.click('.account-tabs a[href="#sale"]');
await page.waitForSelector('.sale-form');
await page.selectOption('.sale-form [name=channel]', 'Instagram');
await page.fill('.sale-form [name=customer_name]', 'Maya Khoury');
await page.selectOption('.sale-line [name=slug]', 'horseshoe-necklace');
assert.ok(Number(await page.inputValue('.sale-line [name=unit_price]')) > 0, 'choosing a piece fills in its price');
await page.fill('.sale-line [name=unit_price]', '400');
await page.uncheck('.sale-line [name=from_stock]');
await page.click('.sale-add');
await page.selectOption('.sale-line:nth-child(2) [name=slug]', 'horseshoe-ring');
assert.ok(await page.locator('.sale-line:nth-child(2) [name=size]').isEnabled(), 'rings show a size choice');
assert.ok(await page.locator('.sale-line:nth-child(1) [name=size]').isDisabled(), 'necklaces have no size');
await page.uncheck('.sale-line:nth-child(2) [name=from_stock]');
await page.fill('.sale-line:nth-child(2) [name=unit_price]', '300');
await page.selectOption('.sale-form [name=payment_method]', 'card');
await shot('account-record-sale');
await page.click('.sale-form button[type=submit]');
await page.waitForFunction(() => document.querySelector('.order-done') || document.querySelector('.sale-form .form-msg')?.textContent);
assert.equal(await page.locator('.sale-form .form-msg').count() ? await page.locator('.sale-form .form-msg').textContent() : '', '', 'no error');
assert.match(await page.locator('.order-done').textContent(), /Total \$700\.00/);
const saleRef = (await page.locator('.order-done h2').textContent()).trim();
assert.match(saleRef, /^S\d{3}$/);
const [saleRow] = await q(`select channel, payment_method, status, (select count(*)::int from order_items i where i.order_id = o.id) as lines
                            from orders o where reference = '${saleRef}'`);
assert.deepEqual([saleRow.channel, saleRow.payment_method, saleRow.status, saleRow.lines], ['Instagram', 'card', 'preparing', 2]);
await setState({ ownerEmails: 'owner@siaram.test' });
step('the owner records an Instagram sale with two pieces; it gets the next order number');

await page.goto(`${ORIGIN}/account.html#details`);
await page.waitForSelector('.details-form');
assert.equal(await page.isChecked('.details-form [name=marketing_whatsapp]'), true);
await pickBirthday('.details-form', teen.toISOString().slice(0, 10));
await page.click('.details-form button');
await page.waitForFunction(() => /18 or older/.test(document.querySelector('.details-form .form-msg').textContent));
await page.fill('.details-form [name=phone]', '+961 70 999 999');
await pickBirthday('.details-form', '1995-04-02');
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
const expected = ['400 /sb/functions/v1/check-voucher', '400 /sb/auth/v1/token?grant_type=password'];
assert.deepEqual(failed, expected, 'only the deliberate failures (expired voucher, wrong password)');
assert.deepEqual(errors.filter((e) => !/Failed to load resource/.test(e)), []);
step('no JavaScript errors');
await browser.close();
await db.end();
console.log('ALL END-TO-END STORE TESTS PASSED');
