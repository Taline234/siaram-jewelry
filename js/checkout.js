// Checkout page: guest, sign-in or new-account checkout, Lebanon-only delivery, gift vouchers, cash payment.
import {
  apiUrl, availabilityHtml, escapeHtml, getCart, getClient, getSession, inStock, lineKey, loadProducts, loadStock, money,
  optionsLabel, purchasable, setCart, storeEnabled,
} from './store.js';

const root = document.getElementById('store-root');
const state = { voucher: null, areas: [], products: {}, session: null, addresses: [], stock: new Set() };

const field = (name, label, attrs = '') => `<label class="field"><span>${label}</span>
  <input name="${name}" ${attrs} /></label>`;

function totals() {
  const cart = getCart();
  const subtotal = cart.reduce((sum, i) => sum + (state.products[i.slug]?.price || 0) * i.quantity, 0);
  const gov = root.querySelector('[name=governorate]')?.value;
  const area = state.areas.find((a) => a.governorate === gov);
  const fee = area ? area.delivery_fee : null;
  // Delivery is paid to the courier in cash, so neither the jewellery total nor a voucher covers it.
  const discount = state.voucher ? Math.min(state.voucher.balance, subtotal) : 0;
  const made = cart.filter((i) => !inStock(state.stock, i))
    .reduce((sum, i) => sum + (state.products[i.slug]?.price || 0) * i.quantity, 0);
  return { cart, subtotal, fee, discount, total: subtotal - discount, areaChosen: Boolean(area), ...split(subtotal - discount, made) };
}

// Made-to-order pieces are paid by Whish before production; the rest in cash on delivery.
// Voucher credit goes to the in-stock pieces first.
function split(total, madeToOrder) {
  const cash = Math.max(total - madeToOrder, 0);
  return { cash, whish: total - cash };
}

// How this basket is paid: in-stock pieces in cash on delivery, made-to-order pieces in full by Whish payment link
// before production, delivery always in cash to the driver, and voucher credit off the jewellery (in-stock first).
function renderPayment(t, feeKnown, toDriver) {
  const box = root.querySelector('.pay-details');
  if (!box) return;
  const fee = !t.areaChosen ? 'the delivery fee' : feeKnown ? `${money(t.fee)} delivery` : 'the delivery fee (confirmed before dispatch)';
  const parts = [];
  if (t.whish) {
    parts.push(`<p class="pay-option"><span><strong>Whish payment link, before production: ${money(t.whish)}</strong><br /><span>For the
      pieces made to order (rose or white gold, or out of stock). We send you the link after you order and start making them
      once it is paid. Made-to-order pieces cannot be cancelled once ordered and are final sale.</span></span></p>`);
  }
  const jewelleryCash = t.cash ? `${money(t.cash)} for your in-stock jewellery and ` : '';
  parts.push(`<p class="pay-option"><span><strong>Cash on delivery: ${feeKnown ? money(toDriver) : `${money(toDriver)} plus delivery`}</strong><br /><span>Paid
    to the driver when your order arrives: ${jewelleryCash}${fee}.${t.whish
      ? ' Pieces already paid by Whish are not paid again.' : ''}</span></span></p>`);
  if (t.whish && t.cash) parts.push('<p class="field-note">Your order is delivered together, once the made-to-order pieces are ready.</p>');
  if (t.discount) parts.push(`<p class="field-note">Your gift voucher takes ${money(t.discount)} off your jewellery (in-stock pieces first). It does not cover delivery.</p>`);
  box.innerHTML = parts.join('');
}

function renderSummary() {
  const t = totals();
  const lines = t.cart.map((i) => {
    const p = state.products[i.slug];
    return `<div class="summary-row"><span>${escapeHtml(p.name)} &times; ${i.quantity}
      <small class="summary-options">${optionsLabel(i)}</small>${availabilityHtml(state.stock, i)}</span><span>${money(p.price * i.quantity)}</span></div>`;
  }).join('');
  const feeKnown = t.areaChosen && t.fee !== null;
  const delivery = !t.areaChosen ? 'Choose your area' : t.fee === null ? 'Confirmed before dispatch' : money(t.fee);
  const toDriver = t.cash + (feeKnown ? Number(t.fee) : 0);
  root.querySelector('.summary-lines').innerHTML = `${lines}
    <div class="summary-row summary-sub"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
    ${t.discount ? `<div class="summary-row"><span>Gift voucher</span><span>&minus;${money(t.discount)}</span></div>` : ''}
    <div class="summary-row"><span>Delivery</span><span>${delivery}</span></div>
    ${toDriver || !t.whish ? `<div class="summary-row summary-total"><span>Total to pay in cash on delivery${feeKnown ? '' : ' (plus delivery)'}</span><span>${money(toDriver)}</span></div>` : ''}
    ${t.whish ? `<div class="summary-row summary-total"><span>To pay by Whish before production</span><span>${money(t.whish)}</span></div>` : ''}
    <p class="summary-note">You pay the driver in cash when your order arrives${feeKnown ? ', delivery included' : ''}.</p>`;
  renderPayment(t, feeKnown, toDriver);
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
      ${signedIn ? '' : `<div class="checkout-mode" role="group" aria-label="How to check out">
        <div class="checkout-mode-option is-current">
          <strong>Continue as a guest</strong>
          <span>No account needed. Fill in your details below; you get an order reference and a confirmation email.</span>
        </div>
        <div class="checkout-mode-option">
          <strong>Have an account?</strong>
          <span><a href="account.html?next=checkout.html">Sign in</a> or <a href="account.html?next=checkout.html#create">create an account</a>
            to save your addresses and see your orders. This is optional.</span>
        </div>
      </div>`}

      <fieldset><legend>Contact</legend>
        <div class="form-grid">
          ${field('customer_name', 'Full name', 'required autocomplete="name"')}
          ${field('phone', 'Phone (with country code if outside Lebanon)', 'required type="tel" autocomplete="tel" placeholder="+961 70 123 456"')}
          ${field('email', 'Email', `required type="email" autocomplete="email"${signedIn ? ' readonly' : ''}`)}
        </div>
        <fieldset class="contact-pref">
          <legend>How would you like us to contact you?</legend>
          <div class="choice-pills">
            <label class="choice-pill"><input type="radio" name="preferred_contact" value="Call" required /><span>Call</span></label>
            <label class="choice-pill"><input type="radio" name="preferred_contact" value="Text message" required /><span>Text message</span></label>
            <label class="choice-pill"><input type="radio" name="preferred_contact" value="WhatsApp" required /><span>WhatsApp</span></label>
            <label class="choice-pill"><input type="radio" name="preferred_contact" value="Email" required /><span>Email</span></label>
          </div>
        </fieldset>
      </fieldset>

      <fieldset><legend>Delivery address</legend>
        <p class="field-note">We deliver within Lebanon${closed.length ? `, except ${closed.map(escapeHtml).join(', ')}` : ''}, by Wakilni.
          In-stock pieces arrive in 2&ndash;3 business days in Beirut and nearby (Jnah to Dbayeh, up to Baabda) and
          3&ndash;4 business days elsewhere; pieces made to order in 3&ndash;4 weeks.
          The delivery fee is paid to the courier in cash. Your address also appears on your receipt.</p>
        <input type="hidden" name="fulfilment" value="delivery" />
        <div class="address-fields">
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
        </div>
      </fieldset>

      <fieldset class="gift-fieldset"><legend>Sending a gift?</legend>
        <label class="check"><input type="checkbox" name="is_gift" value="1" /> <span>This is a gift: deliver it to someone else and leave the prices out of the parcel</span></label>
        <div class="gift-fields" hidden>
          <p class="field-note">Enter their address above. Your receipt is emailed to you, not put in the parcel.</p>
          <div class="form-grid">
            ${field('gift_recipient_name', "Recipient's name", 'maxlength="200" autocomplete="off"')}
            ${field('gift_recipient_phone', "Recipient's phone, for the courier (optional)", 'type="tel" maxlength="40" autocomplete="off"')}
          </div>
          <label class="field"><span>Gift message (optional, written on a Siaram card)</span><textarea name="gift_message" rows="3" maxlength="300"></textarea></label>
        </div>
      </fieldset>

      <fieldset><legend>Gift voucher</legend>
        <div class="voucher-row">
          <input name="voucher_code" placeholder="GV0000-XXXXXX" aria-label="Gift voucher code" autocomplete="off" />
          <button type="button" class="btn btn-outline voucher-apply">Apply</button>
        </div>
        <p class="voucher-msg field-note" aria-live="polite"></p>
      </fieldset>

      <fieldset><legend>Payment</legend>
        <input type="hidden" name="payment_method" value="cash" />
        <div class="pay-details" aria-live="polite"></div>
        <p class="field-note">We do not take card payments. You get an order received email now. Tracking is available when your order is dispatched.</p>
      </fieldset>

      <fieldset class="checkout-confirm">
        ${signedIn ? '' : '<label class="check"><input type="checkbox" name="age_confirmed" required /> <span>I confirm I am 18 or older.</span></label>'}
        <div class="terms-summary">
          <p class="terms-summary-title">Delivery and returns</p>
          <ul>
            <li>You pay the delivery fee. For international orders, you also pay customs clearance, import duties, taxes and any related fees.</li>
            <li>If you return an eligible in-stock piece within 14 days because you no longer want it, you get a refund for the piece, but you pay all return costs, and the original delivery fee is not refunded. Made-to-order pieces are final sale.</li>
            <li>If a piece arrives damaged, defective or incorrect, tell us, preferably within 48 hours, and we cover the return costs.</li>
            <li>A refund may be refused or reduced if the piece is not returned in its original good condition and packaging.</li>
          </ul>
          <p>Full details and how to return a piece: <a href="shipping.html" target="_blank">Shipping</a> and
            <a href="returns.html" target="_blank">Returns</a>.</p>
        </div>
        <label class="check"><input type="checkbox" name="accept_terms" required /> <span>I agree to the delivery and
          returns terms above, the <a href="terms.html" target="_blank">Terms &amp; Conditions</a> and the
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
    if (profile.preferred_contact) form.elements.preferred_contact.value = profile.preferred_contact;
  }
  if (state.session) form.elements.email.value = state.session.user.email;
  if (preferred) fillAddress(preferred);

  form.elements.saved_address?.addEventListener('change', (e) =>
    fillAddress(state.addresses.find((a) => a.id === e.target.value)));
  form.elements.governorate.addEventListener('change', renderSummary);
  form.elements.is_gift.addEventListener('change', (e) => {
    const box = form.querySelector('.gift-fields');
    box.hidden = !e.target.checked;
    form.elements.gift_recipient_name.required = e.target.checked;
    if (e.target.checked) form.elements.gift_recipient_name.focus();
  });
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
    const res = await fetch(apiUrl('check-voucher'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, email: form.elements.email.value.trim(), phone: form.elements.phone.value.trim() }),
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
  const made = (order.items || []).filter((i) => i.made_to_order)
    .reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);
  const pay = split(Number(order.total), made);
  const toPay = Number(order.total) <= 0
    ? '<p>Your gift voucher covers this order, so there is nothing more to pay for your jewellery.</p>'
    : `${pay.cash ? `<p>You'll pay <strong>${money(pay.cash + (order.delivery_fee == null ? 0 : Number(order.delivery_fee)))}</strong>
         in cash to the driver when your order arrives${order.delivery_fee == null ? '' : `, including ${money(order.delivery_fee)} delivery`}.</p>` : ''}
       ${pay.whish ? `<p>Your made-to-order pieces (<strong>${money(pay.whish)}</strong>) are paid by Whish: we'll send you a
         payment link, and production starts once it is paid. They take 3&ndash;4 weeks and are final sale.</p>` : ''}`;
  const handover = `<p>${order.delivery_fee === null || order.delivery_fee === undefined
        ? 'We\'ll confirm the delivery fee before dispatch; it is paid to the driver in cash.'
        : pay.cash ? '' : `You pay only the ${money(order.delivery_fee)} delivery fee in cash to the driver.`}</p>`;
  root.innerHTML = `<div class="order-done">
    <span class="eyebrow">Order received</span>
    <h2>Thank you, ${escapeHtml(order.customer_name.split(' ')[0])}!</h2>
    <p class="order-ref">Your order reference is <strong>${escapeHtml(order.reference)}</strong></p>
    ${toPay}
    ${handover}
    <p>We have received your order. Tracking is available when your order is dispatched.</p>
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
    error.textContent = bad.name === 'preferred_contact' ? 'Please choose how you would like us to contact you.'
      : bad.type === 'checkbox' ? 'Please tick the confirmation boxes to continue.'
      : bad.type === 'email' && bad.value.trim() ? 'Please check your email address: it should look like name@example.com.'
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
  // The same id is sent if this checkout is submitted again, so it can never create a second order.
  state.submissionId ||= crypto.randomUUID();
  const payload = {
    ...data,
    submission_id: state.submissionId,
    is_gift: form.elements.is_gift.checked,
    age_confirmed: Boolean(state.session) || form.elements.age_confirmed.checked,
    terms_accepted: form.elements.accept_terms.checked,
    items: getCart().map(({ slug, quantity, metal, size, stone }) => ({ slug, quantity, metal, size, stone })),
  };
  try {
    const headers = { 'content-type': 'application/json' };
    if (state.session) headers.authorization = `Bearer ${state.session.access_token}`;
    const res = await fetch(apiUrl('place-order'), { method: 'POST', headers, body: JSON.stringify(payload) });
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
  const [products, areas, session, stock] = await Promise.all([
    loadProducts(),
    client.from('delivery_areas').select('*').order('sort'),
    getSession(),
    loadStock().catch(() => new Map()),
  ]);
  if (areas.error) throw areas.error;
  state.stock = stock;
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
      client.from('profiles').select('first_name, last_name, phone, preferred_contact').maybeSingle(),
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
    root.innerHTML = `<div class="store-empty" role="alert"><p>Sorry, checkout could not be loaded. Please check your connection and try again.</p>
      <div class="product-actions" style="justify-content:center">
        <button type="button" class="btn btn-primary" onclick="location.reload()">Try Again</button>
        <a class="btn btn-outline" href="https://wa.me/96176052068" target="_blank" rel="noopener">WhatsApp Us</a>
      </div></div>`;
  });
}

if (!storeEnabled && root) {
  root.innerHTML = `<div class="store-empty"><p>Online ordering is not available right now. We'd love to help you by email or WhatsApp.</p>
    <div class="product-actions" style="justify-content:center">
      <a class="btn btn-primary" href="mailto:customerservice@siaramjewelry.com?subject=Order%20enquiry">Email Us</a>
      <a class="btn btn-outline" href="https://wa.me/96176052068" target="_blank" rel="noopener">WhatsApp Us</a></div></div>`;
}
