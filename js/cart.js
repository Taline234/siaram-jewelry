// Cart page.
import {
  escapeHtml, getCart, lineKey, loadProducts, money, optionsLabel, productPage, purchasable, setCart, storeEnabled,
} from './store.js';

const root = document.getElementById('store-root');

function render(products) {
  const cart = getCart();
  if (!cart.length) {
    root.innerHTML = `<div class="store-empty">
      <p>Your cart is empty.</p>
      <a href="shop.html" class="btn btn-primary">Shop the Collection</a></div>`;
    return;
  }

  let subtotal = 0;
  let blocked = false;
  const rows = cart.map((line) => {
    const p = products[line.slug];
    const ok = purchasable(p);
    if (ok) subtotal += p.price * line.quantity;
    else blocked = true;
    const options = Array.from({ length: 10 }, (_, i) =>
      `<option value="${i + 1}"${i + 1 === line.quantity ? ' selected' : ''}>${i + 1}</option>`).join('');
    return `<div class="cart-line" data-key="${escapeHtml(lineKey(line))}">
      <a href="${productPage(line.slug)}" class="cart-thumb">${p && p.image ? `<img src="${escapeHtml(p.image)}" alt="" />` : ''}</a>
      <div class="cart-info">
        <a href="${productPage(line.slug)}" class="cart-name">${escapeHtml(p ? p.name : line.slug)}</a>
        <span class="cart-options">${optionsLabel(line)}</span>
        ${ok ? `<span class="cart-unit">${money(p.price)} each</span>`
             : '<span class="form-error">No longer available online &mdash; please remove it.</span>'}
      </div>
      <label class="qty-label"><span class="sr-only">Quantity</span><select class="qty-select" aria-label="Quantity">${options}</select></label>
      <span class="cart-total">${ok ? money(p.price * line.quantity) : '&mdash;'}</span>
      <button type="button" class="link-btn cart-remove">Remove</button>
    </div>`;
  }).join('');

  root.innerHTML = `<div class="cart-layout">
    <div class="cart-lines">${rows}</div>
    <aside class="summary-box">
      <h2>Order Summary</h2>
      <div class="summary-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <p class="summary-note">Delivery within Lebanon and any gift voucher are added at checkout.</p>
      ${blocked ? '<p class="form-error">Remove unavailable items to continue.</p>' : ''}
      <a href="checkout.html" class="btn btn-primary btn-block${blocked ? ' disabled' : ''}"
         ${blocked ? 'aria-disabled="true" tabindex="-1"' : ''}>Checkout</a>
      <a href="shop.html" class="link-btn summary-continue">Continue shopping</a>
    </aside></div>`;

  root.querySelectorAll('.cart-line').forEach((el) => {
    const key = el.dataset.key;
    el.querySelector('.qty-select').addEventListener('change', (e) => {
      setCart(getCart().map((i) => (lineKey(i) === key ? { ...i, quantity: Number(e.target.value) } : i)));
      render(products);
    });
    el.querySelector('.cart-remove').addEventListener('click', () => {
      setCart(getCart().filter((i) => lineKey(i) !== key));
      render(products);
    });
  });
}

if (storeEnabled) {
  loadProducts().then(render).catch(() => {
    root.innerHTML = '<p class="form-error">Sorry, the cart could not be loaded. Please refresh the page.</p>';
  });
}
