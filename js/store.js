// Online store: shared code for every page (cart, header icons, prices, wishlist).
// Does nothing until js/store-config.js is filled in.

const config = window.SIARAM_STORE || {};
export const storeEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey);

// The store's server functions (placing orders, vouchers, ...) run on Supabase.
export const apiUrl = (name) => `${config.supabaseUrl}/functions/v1/${name}`;

let clientPromise = null;
export function getClient() {
  if (!storeEnabled) return Promise.resolve(null);
  clientPromise ||= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm')
    .then(({ createClient }) => createClient(config.supabaseUrl, config.supabaseAnonKey));
  return clientPromise;
}

export async function getSession() {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

// ---------------------------------------------------------------- helpers
export const money = (value) => `$${Number(value || 0).toFixed(2)}`;
export const productPage = (slug) => `product-${slug}.html`;

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function storageGet(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode); the cart lasts for this page only */
  }
}

let productsPromise = null;
export async function loadProducts() {
  const client = await getClient();
  if (!client) return {};
  productsPromise ||= client.from('products').select('slug, name, category, price, available, image')
    .then(({ data, error }) => {
      if (error) throw error;
      return Object.fromEntries((data || []).map((p) => [p.slug, p]));
    });
  return productsPromise;
}

export const purchasable = (product) => Boolean(product && product.available && product.price !== null);

// How many of each piece, metal and size are ready to ship (a Map of line key to quantity). A line is in
// stock only if there are enough for its quantity; otherwise the whole line is made to order, as the
// database decides when the order is placed.
let stockPromise = null;
export async function loadStock() {
  const client = await getClient();
  if (!client) return new Map();
  stockPromise ||= client.rpc('available_stock').then(({ data, error }) => {
    if (error) throw error;
    // Before the database update that adds quantity, treat a listed piece as having enough.
    return new Map((data || []).map((s) => [`${s.product_slug}|${s.metal}|${s.size}`, s.quantity ?? Infinity]));
  });
  return stockPromise;
}

export const inStock = (stock, item) => (stock.get(lineKey(item)) || 0) >= (item.quantity || 1);

export function availabilityHtml(stock, item) {
  if (inStock(stock, item)) return '<span class="availability in-stock">In stock &middot; ships in 1&ndash;2 business days</span>';
  const have = stock.get(lineKey(item)) || 0;
  const few = have > 0
    ? ` <span class="availability-note">Only ${have} in stock: choose ${have} to receive ${have === 1 ? 'it' : 'them'} in 1&ndash;2 business days.</span>`
    : '';
  return `<span class="availability made-to-order">Made to order &middot; 3&ndash;4 weeks, paid by Whish, final sale</span>${few}`;
}

// ---------------------------------------------------------------- cart
const CART_KEY = 'siaram-cart';
let memoryCart = null;

export function getCart() {
  memoryCart ||= storageGet(CART_KEY, []);
  return memoryCart
    .filter((i) => i && typeof i.slug === 'string' && i.quantity > 0)
    .map((i) => ({ metal: 'yellow', size: '', ...i, quantity: Math.min(i.quantity, 3) }));
}

// One cart line per piece, metal and size.
export const lineKey = (i) => `${i.slug}|${i.metal || 'yellow'}|${i.size || ''}`;

export const METALS = { yellow: '18k yellow gold', rose: '18k rose gold', white: '18k white gold' };

// "18k rose gold · EU 54", for the cart and checkout.
export function optionsLabel(i) {
  const parts = [METALS[i.metal] || METALS.yellow];
  if (i.size) parts.push(i.size);
  return parts.map(escapeHtml).join(' &middot; ');
}

export function setCart(items) {
  memoryCart = items.filter((i) => i.quantity > 0);
  if (memoryCart.length) {
    storageSet(CART_KEY, memoryCart);
  } else {
    try {
      localStorage.removeItem(CART_KEY);
    } catch {
      /* storage unavailable */
    }
  }
  document.dispatchEvent(new CustomEvent('cart:change'));
}

export function addToCart(slug, quantity = 1, options = {}) {
  const cart = getCart();
  const item = { slug, metal: options.metal || 'yellow', size: options.size || '' };
  const line = cart.find((i) => lineKey(i) === lineKey(item));
  if (line) line.quantity = Math.min(line.quantity + quantity, 3);
  else cart.push({ ...item, quantity: Math.min(quantity, 3) });
  setCart(cart);
}

export const cartCount = () => getCart().reduce((n, i) => n + i.quantity, 0);

// ---------------------------------------------------------------- UI bits
export function toast(html) {
  let el = document.querySelector('.store-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'store-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3500);
}

const ICONS = {
  account: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  bag: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  heart: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
};

function addHeaderLinks() {
  const cta = document.querySelector('.nav-cta');
  if (cta && !cta.querySelector('.nav-store')) {
    cta.insertAdjacentHTML('afterbegin', `<div class="nav-store">
      <a href="account.html" class="nav-icon" aria-label="My account">${ICONS.account}</a>
      <a href="cart.html" class="nav-icon" aria-label="Cart">${ICONS.bag}<span class="cart-count" hidden></span></a>
    </div>`);
  }
  const mobile = document.querySelector('.mobile-menu');
  if (mobile && !mobile.querySelector('[href="cart.html"]')) {
    mobile.insertAdjacentHTML('beforeend', '<a href="account.html">My Account</a><a href="cart.html">Cart</a>');
  }
  const update = () => {
    const n = cartCount();
    document.querySelectorAll('.cart-count').forEach((el) => {
      el.textContent = n;
      el.hidden = n === 0;
    });
  };
  update();
  document.addEventListener('cart:change', update);
}

async function fillPrices(products) {
  document.querySelectorAll('[data-price-for]').forEach((el) => {
    const product = products[el.dataset.priceFor];
    if (!product) return;
    // The database price wins over the catalogue price printed in the page.
    if (product.price !== null) el.textContent = money(product.price);
    else el.textContent = el.classList.contains('product-price') ? 'Price on request' : '';
  });
}

async function wishlistButton(slug) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-outline wishlist-btn';
  const render = (saved) => {
    button.innerHTML = `${ICONS.heart}<span>${saved ? 'Saved to Wishlist' : 'Add to Wishlist'}</span>`;
    button.classList.toggle('saved', saved);
    button.setAttribute('aria-pressed', String(saved));
  };
  render(false);

  const client = await getClient();
  const session = await getSession();
  let saved = false;
  if (session) {
    const { data } = await client.from('wishlist').select('product_slug').eq('product_slug', slug);
    saved = Boolean(data && data.length);
    render(saved);
  }
  button.addEventListener('click', async () => {
    if (!session) {
      location.href = `account.html?next=${encodeURIComponent(location.pathname.split('/').pop())}`;
      return;
    }
    button.disabled = true;
    const { error } = saved
      ? await client.from('wishlist').delete().eq('product_slug', slug)
      : await client.from('wishlist').insert({ product_slug: slug });
    button.disabled = false;
    if (error) return toast('Sorry, the wishlist could not be updated.');
    saved = !saved;
    render(saved);
  });
  return button;
}

async function setupBuyBox(products) {
  const box = document.querySelector('.product-buy[data-slug]');
  if (!box) return;
  const slug = box.dataset.slug;
  const product = products[slug];

  if (purchasable(product)) {
    const options = Array.from({ length: 3 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    box.innerHTML = `<label class="qty-label">Quantity <select class="qty-select" aria-label="Quantity">${options}</select></label>
      <button type="button" class="btn btn-primary add-to-cart">Add to Cart</button>`;
    box.querySelector('.add-to-cart').addEventListener('click', () => {
      const options = document.querySelector('.product-options');
      const metal = options?.querySelector('[name=metal]:checked')?.value || 'yellow';
      const size = options?.querySelector('.size-select');
      if (size && !size.value) {
        size.classList.add('invalid');
        size.focus();
        toast('Please choose a size first.');
        return;
      }
      addToCart(slug, Number(box.querySelector('.qty-select').value), { metal, size: size ? size.value : '' });
      toast(`Added to your cart &middot; <a href="cart.html">View cart</a>`);
    });
    // Once the piece can be bought online, Add to Cart replaces the email enquiry;
    // WhatsApp stays as a secondary option for sizing questions.
    document.querySelectorAll('.product-actions a[href^="mailto:"]').forEach((a) => a.remove());
    document.querySelectorAll('.product-actions .btn-primary').forEach((b) => {
      b.classList.replace('btn-primary', 'btn-outline');
    });
  }
  box.appendChild(await wishlistButton(slug));
  box.hidden = false;
  if (purchasable(product)) await showAvailability(slug);
}

// "In stock" or "Made to order" for the metal and size chosen on a piece's page.
async function showAvailability(slug) {
  const options = document.querySelector('.product-options');
  if (!options) return;
  let stock;
  try {
    stock = await loadStock();
  } catch {
    return;
  }
  const status = document.createElement('p');
  status.className = 'stock-status';
  status.setAttribute('aria-live', 'polite');
  options.querySelector('.made-to-order-note')?.before(status);
  const update = () => {
    const metal = options.querySelector('[name=metal]:checked')?.value || 'yellow';
    const size = options.querySelector('.size-select');
    const quantity = Number(document.querySelector('.product-buy .qty-select')?.value) || 1;
    status.hidden = Boolean(size && !size.value);
    if (!status.hidden) status.innerHTML = availabilityHtml(stock, { slug, metal, size: size ? size.value : '', quantity });
  };
  options.addEventListener('change', update);
  document.querySelector('.product-buy .qty-select')?.addEventListener('change', update);
  update();
}

// Product cards (shop, home, "you may also like"): Add to Cart instead of Enquire by Email.
function setupCardButtons(products) {
  document.querySelectorAll('.product-card').forEach((card) => {
    const slug = card.querySelector('[data-price-for]')?.dataset.priceFor;
    const enquire = card.querySelector('.btn-contact');
    if (!enquire || !purchasable(products[slug])) return;
    // Rings and bracelets need a size, which is chosen on the piece's own page.
    if (['rings', 'bracelets'].includes(card.dataset.category)) {
      const link = document.createElement('a');
      link.className = 'btn btn-contact card-add';
      link.href = productPage(slug);
      link.textContent = 'Choose Size';
      enquire.replaceWith(link);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-contact card-add';
    button.textContent = 'Add to Cart';
    button.addEventListener('click', () => {
      addToCart(slug, 1);
      toast(`Added to your cart &middot; <a href="cart.html">View cart</a>`);
    });
    enquire.replaceWith(button);
  });
}

// Footer mailing-list form, on every page. Signing up is separate from buying or having an account.
function setupNewsletter() {
  document.querySelectorAll('.newsletter-form').forEach((form) => {
    const msg = form.querySelector('.newsletter-msg');
    const button = form.querySelector('button');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.elements.website.value) return; // spam trap
      const email = form.elements.email;
      if (!email.value.trim() || !email.checkValidity()) {
        msg.textContent = 'Please enter a valid email address.';
        email.focus();
        return;
      }
      button.disabled = true;
      msg.textContent = '';
      try {
        const client = await getClient();
        const page = location.pathname.split('/').pop() || 'index.html';
        const { data, error } = await client.rpc('subscribe_newsletter', { p_email: email.value.trim(), p_source: page });
        if (error) throw error;
        msg.textContent = data === 'already' ? "You're already on our list. Thank you!" : "Thank you! You're on the list.";
        form.reset();
      } catch (err) {
        msg.textContent = /valid email/.test(err?.message || '') ? 'Please enter a valid email address.'
          : 'Sorry, something went wrong. Please try again.';
      } finally {
        button.disabled = false;
      }
    });
  });
}

// Keeps the 12/24-month inactivity clock fresh while a customer uses the site.
async function recordActivity() {
  const session = await getSession();
  if (!session) return;
  const last = storageGet('siaram-last-active', 0);
  if (Date.now() - last < 12 * 60 * 60 * 1000) return;
  const client = await getClient();
  const { error } = await client.rpc('touch_activity');
  if (!error) storageSet('siaram-last-active', Date.now());
}

async function init() {
  if (!storeEnabled) return;
  document.documentElement.classList.add('store-on');
  addHeaderLinks();
  setupNewsletter();
  try {
    const products = await loadProducts();
    await fillPrices(products);
    setupCardButtons(products);
    await setupBuyBox(products);
    await recordActivity();
  } catch (err) {
    console.error('Store failed to load', err);
  }
}

init();
