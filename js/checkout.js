// Checkout page: guest or signed-in checkout, Lebanon-only delivery, gift vouchers, Whish payment.
import {
  escapeHtml, getCart, getClient, getSession, loadProducts, money, purchasable, setCart, storeEnabled,
} from './store.js';

const root = document.getElementById('store-root');
const state = { voucher: null, areas: [], products: {}, session: null, addresses: [] };

const field = (name, label, attrs = '') => `<label class="field"><span>${label}</span>
  <input name="${name}" ${attrs} /></label>`;

function totals() {
  const cart = getCart();
  const subtotal = cart.reduce((sum, i) => sum + (state.products[i.slug]?.price || 0) * i.quantity, 0);
  const gov = root.querySelector('[name=governorate]')?.value;
  const area = state.areas.find((a) => a.governorate === gov);
  const fee = area ? area.delivery_fee : null;
  const beforeVoucher = subtotal + (fee || 0);
  const discount = state.voucher ? Math.min(state.voucher.balance, beforeVoucher) : 0;
  return { cart, subtotal, fee, discount, total: beforeVoucher - discount, areaChosen: Boolean(area) };
}

function renderSummary() {
  const t = totals();
  const lines = t.cart.map((i) => {
    const p = state.products[i.slug];
    return `<div class="summary-row"><span>${escapeHtml(p.name)} &times; ${i.quantity}</span><span>${money(p.price * i.quantity)}</span></div>`;
  }).join('');
  const delivery = !t.areaChosen ? 'Choose your area' : t.fee === null ? 'Confirmed after ordering' : money(t.fee);
  root.querySelector('.summary-lines').innerHTML = `${lines}
    <div class="summary-row summary-sub"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
    <div class="summary-row"><span>Delivery</span><span>${delivery}</span></div>
    ${t.discount ? `<div class="summary-row"><span>Gift voucher</span><span>&minus;${money(t.discount)}</span></div>` : ''}
    <div class="summary-row summary-total"><span>Total</span><span>${money(t.total)}</span></div>`;
}

function fillAddress(a) {
  const form = root.querySelector('form');
  for (const name of ['governorate', 'city', 'street', 'building', 'floor', 'notes']) {
    form.elements[name].value = a ? a[name] || '' : '';
  }
  if (a && !form.elements.phone.value) form.elements.phone.value = a.phone || '';
  renderSummary();
}

function renderForm(profile) {
  const signedIn = Boolean(state.session);
  const open = state.areas.filter((a) => a.accepts_orders);
  const closed = state.areas.filter((a) => !a.accepts_orders).map((a) => a.governorate);
  const preferred = state.addresses.find((a) => a.is_default) || state.addresses[0];

  root.innerHTML = `<form class="checkout-layout" novalidate>
    <div class="checkout-main">
      ${signedIn ? '' : `<p class="checkout-signin">Have an account? <a href="account.html?next=checkout.html">Sign in</a>
        for faster checkout &mdash; or continue as a guest.</p>`}

      <fieldset><legend>Contact</legend>
        <div class="form-grid">
          ${field('customer_name', 'Full name', 'required autocomplete="name"')}
          ${field('phone', 'Phone (WhatsApp)', 'required type="tel" autocomplete="tel" placeholder="+961"')}
          ${field('email', 'Email', `required type="email" autocomplete="email"${signedIn ? ' readonly' : ''}`)}
        </div>
      </fieldset>

      <fieldset><legend>Delivery address</legend>
        <p class="field-note">We deliver within Lebanon only${closed.length ? `, and do not currently deliver to ${closed.map(escapeHtml).join(', ')}` : ''}.</p>
        ${state.addresses.length ? `<label class="field"><span>Saved addresses</span>
          <select name="saved_address">${state.addresses.map((a) =>
            `<option value="${a.id}"${a === preferred ? ' selected' : ''}>${escapeHtml(a.label || a.street)}, ${escapeHtml(a.city)}${a.is_default ? ' (preferred)' : ''}</option>`).join('')}
            <option value="">Use a new address</option></select></label>` : ''}
        <div class="form-grid">
          <label class="field"><span>Governorate</span><select name="governorate" required>
            <option value="">Choose&hellip;</option>
            ${open.map((a) => `<option>${escapeHtml(a.governorate)}</option>`).join('')}</select></label>
          ${field('city', 'Town / area', 'required autocomplete="address-level2"')}
          ${field('street', 'Street', 'required autocomplete="address-line1"')}
          ${field('building', 'Building', 'autocomplete="address-line2"')}
          ${field('floor', 'Floor / apartment')}
        </div>
        <label class="field"><span>Directions or notes (optional)</span><textarea name="notes" rows="2"></textarea></label>
        ${signedIn ? '<label class="check"><input type="checkbox" name="save_address" /> <span>Save this address to my account</span></label>' : ''}
      </fieldset>

      <fieldset><legend>Gift voucher</legend>
        <div class="voucher-row">
          <input name="voucher_code" placeholder="SIARAM-XXXX-XXXX" aria-label="Gift voucher code" autocomplete="off" />
          <button type="button" class="btn btn-outline voucher-apply">Apply</button>
        </div>
        <p class="voucher-msg field-note" aria-live="polite"></p>
      </fieldset>

      <fieldset><legend>Payment</legend>
        <label class="pay-option"><input type="radio" name="payment" value="whish" checked />
          <span><strong>Whish</strong><br />After you place your order, send the total via Whish with your order
          reference. We'll prepare your piece as soon as the payment arrives.</span></label>
      </fieldset>

      <fieldset class="checkout-confirm">
        ${signedIn ? '' : '<label class="check"><input type="checkbox" name="age_confirmed" required /> <span>I confirm I am 18 or older.</span></label>'}
        <label class="check"><input type="checkbox" name="accept_terms" required /> <span>I agree to the
          <a href="terms.html" target="_blank">Terms &amp; Conditions</a> and
          <a href="privacy.html" target="_blank">Privacy Policy</a>.</span></label>
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      </fieldset>
    </div>

    <aside class="summary-box">
      <h2>Your Order</h2>
      <div class="summary-lines"></div>
      <p class="form-error checkout-error" role="alert"></p>
      <button type="submit" class="btn btn-primary btn-block">Place Order</button>
      <a href="cart.html" class="link-btn summary-continue">Back to cart</a>
    </aside>
  </form>`;

  const form = root.querySelector('form');
  if (profile) {
    form.elements.customer_name.value = `${profile.first_name} ${profile.last_name}`.trim();
    form.elements.phone.value = profile.phone || '';
  }
  if (state.session) form.elements.email.value = state.session.user.email;
  if (preferred) fillAddress(preferred);

  form.elements.saved_address?.addEventListener('change', (e) =>
    fillAddress(state.addresses.find((a) => a.id === e.target.value)));
  form.elements.governorate.addEventListener('change', renderSummary);
  form.querySelector('.voucher-apply').addEventListener('click', applyVoucher);
  form.addEventListener('submit', submit);
  renderSummary();
}

async function applyVoucher() {
  const form = root.querySelector('form');
  const msg = root.querySelector('.voucher-msg');
  const code = form.elements.voucher_code.value.trim();
  state.voucher = null;
  if (!code) {
    msg.textContent = '';
    return renderSummary();
  }
  msg.textContent = 'Checking…';
  try {
    const res = await fetch('/api/check-voucher', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    state.voucher = body;
    msg.textContent = `Voucher applied: ${money(body.balance)} available, valid until ${new Date(body.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
  } catch (err) {
    msg.textContent = err.message || 'Could not check this voucher.';
  }
  renderSummary();
}

function showConfirmation(order) {
  const toPay = Number(order.total) > 0
    ? `<p>Please send <strong>${money(order.total)}</strong> via Whish to
        ${order.whish_number ? `${escapeHtml(order.whish_name || 'Siaram Jewelry')} on <strong>${escapeHtml(order.whish_number)}</strong>` : 'us &mdash; we will message you our Whish details shortly'},
        and write <strong>${escapeHtml(order.reference)}</strong> in the note.</p>
       <p>We'll prepare your order as soon as the payment arrives.</p>`
    : '<p>Your gift voucher covers this order, so there is nothing to pay.</p>';
  root.innerHTML = `<div class="order-done">
    <span class="eyebrow">Order received</span>
    <h2>Thank you, ${escapeHtml(order.customer_name.split(' ')[0])}!</h2>
    <p class="order-ref">Your order reference is <strong>${escapeHtml(order.reference)}</strong></p>
    ${toPay}
    <p>A confirmation has been sent to ${escapeHtml(order.email)}.</p>
    <a href="shop.html" class="btn btn-outline">Continue Shopping</a>
  </div>`;
  window.scrollTo({ top: 0 });
}

async function submit(e) {
  e.preventDefault();
  const form = e.target;
  const error = root.querySelector('.checkout-error');
  error.textContent = '';
  if (!form.checkValidity()) {
    const bad = form.querySelector('input:invalid, select:invalid, textarea:invalid');
    error.textContent = bad.type === 'checkbox' ? 'Please tick the confirmation boxes to continue.'
      : 'Please fill in all required fields.';
    bad.focus();
    return;
  }
  if (form.elements.voucher_code.value.trim() && !state.voucher) {
    error.textContent = 'Please apply your gift voucher, or clear the code.';
    return;
  }

  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  button.textContent = 'Placing order…';
  const data = Object.fromEntries(new FormData(form));
  const payload = {
    ...data,
    age_confirmed: Boolean(state.session) || form.elements.age_confirmed.checked,
    items: getCart().map(({ slug, quantity }) => ({ slug, quantity })),
  };
  try {
    const headers = { 'content-type': 'application/json' };
    if (state.session) headers.authorization = `Bearer ${state.session.access_token}`;
    const res = await fetch('/api/place-order', { method: 'POST', headers, body: JSON.stringify(payload) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);

    if (state.session && data.save_address) {
      const client = await getClient();
      await client.from('addresses').insert({
        recipient_name: data.customer_name, phone: data.phone, governorate: data.governorate, city: data.city,
        street: data.street, building: data.building || null, floor: data.floor || null, notes: data.notes || null,
        is_default: state.addresses.length === 0,
      });
    }
    setCart([]);
    showConfirmation(body.order);
  } catch (err) {
    error.textContent = err.message || 'Sorry, something went wrong. Please try again.';
    button.disabled = false;
    button.textContent = 'Place Order';
  }
}

async function init() {
  const cart = getCart();
  if (!cart.length) {
    root.innerHTML = `<div class="store-empty"><p>Your cart is empty.</p>
      <a href="shop.html" class="btn btn-primary">Shop the Collection</a></div>`;
    return;
  }
  const client = await getClient();
  const [products, areas, session] = await Promise.all([
    loadProducts(),
    client.from('delivery_areas').select('*').order('sort'),
    getSession(),
  ]);
  if (areas.error) throw areas.error;
  state.products = products;
  state.areas = areas.data;
  state.session = session;

  if (cart.some((i) => !purchasable(products[i.slug]))) {
    location.href = 'cart.html';
    return;
  }

  let profile = null;
  if (session) {
    const [p, a] = await Promise.all([
      client.from('profiles').select('first_name, last_name, phone').maybeSingle(),
      client.from('addresses').select('*').order('created_at'),
    ]);
    profile = p.data;
    state.addresses = (a.data || []).filter((addr) => state.areas.some((ar) => ar.governorate === addr.governorate && ar.accepts_orders));
  }
  renderForm(profile);
}

if (storeEnabled) {
  init().catch((err) => {
    console.error(err);
    root.innerHTML = '<p class="form-error">Sorry, checkout could not be loaded. Please refresh the page.</p>';
  });
}
