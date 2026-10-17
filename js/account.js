// Account page: sign in, create account (18+), password reset, and the signed-in area
// with orders, wishlist, saved addresses and personal details.
import { escapeHtml, getClient, loadProducts, money, productPage, storeEnabled } from './store.js';

const root = document.getElementById('store-root');
let client;

const STATUS = {
  awaiting_payment: 'Awaiting payment', paid: 'Paid', preparing: 'Being prepared',
  dispatched: 'On its way', delivered: 'Delivered', cancelled: 'Cancelled',
};

const field = (name, label, attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" ${attrs} /></label>`;
const isAdult = (dob) => {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 18);
  return d <= limit;
};
const formMessage = (form, text, ok = false) => {
  const el = form.querySelector('.form-msg');
  el.textContent = text;
  el.classList.toggle('form-ok', ok);
};
const nextPage = () => {
  const next = new URLSearchParams(location.search).get('next') || '';
  return /^[a-z0-9-]+\.html$/i.test(next) ? next : null;
};

// ---------------------------------------------------------------- signed out
function renderSignedOut(notice = '') {
  root.innerHTML = `${notice ? `<p class="store-notice">${notice}</p>` : ''}
  <div class="auth-grid">
    <form class="auth-card" data-form="signin" novalidate>
      <h2>Sign In</h2>
      ${field('email', 'Email', 'type="email" required autocomplete="email"')}
      ${field('password', 'Password', 'type="password" required autocomplete="current-password"')}
      <p class="form-msg form-error" role="alert"></p>
      <button class="btn btn-primary btn-block">Sign In</button>
      <button type="button" class="link-btn forgot">Forgot your password?</button>
    </form>

    <form class="auth-card" data-form="signup" novalidate>
      <h2>Create an Account</h2>
      <p class="field-note">Save your details, delivery addresses and wishlist, and see your orders. You must be 18 or older.</p>
      <div class="form-grid">
        ${field('first_name', 'First name', 'required autocomplete="given-name"')}
        ${field('last_name', 'Last name', 'required autocomplete="family-name"')}
      </div>
      ${field('email', 'Email', 'type="email" required autocomplete="email"')}
      ${field('phone', 'Phone (WhatsApp)', 'type="tel" required autocomplete="tel" placeholder="+961"')}
      ${field('date_of_birth', 'Date of birth', 'type="date" required autocomplete="bday"')}
      ${field('password', 'Password (at least 8 characters)', 'type="password" required minlength="8" autocomplete="new-password"')}
      <label class="check"><input type="checkbox" name="accept" required /> <span>I am 18 or older and agree to the
        <a href="terms.html" target="_blank">Terms &amp; Conditions</a> and <a href="privacy.html" target="_blank">Privacy Policy</a>.</span></label>
      <p class="form-msg form-error" role="alert"></p>
      <button class="btn btn-primary btn-block">Create Account</button>
    </form>
  </div>`;

  const signin = root.querySelector('[data-form=signin]');
  signin.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!signin.checkValidity()) return formMessage(signin, 'Please enter your email and password.');
    const { error } = await client.auth.signInWithPassword({
      email: signin.elements.email.value.trim(), password: signin.elements.password.value,
    });
    if (error) {
      return formMessage(signin, /confirm/i.test(error.message)
        ? 'Please confirm your email first — check your inbox for our link.'
        : 'Incorrect email or password.');
    }
    const next = nextPage();
    if (next) location.href = next;
  });

  signin.querySelector('.forgot').addEventListener('click', async () => {
    const email = signin.elements.email.value.trim();
    if (!email) return formMessage(signin, 'Enter your email above, then click "Forgot your password?" again.');
    await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/account.html` });
    formMessage(signin, 'If an account exists for this email, we have sent a link to reset your password.', true);
  });

  const signup = root.querySelector('[data-form=signup]');
  signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = signup.elements;
    if (!signup.checkValidity()) {
      const bad = signup.querySelector('input:invalid, select:invalid, textarea:invalid');
      return formMessage(signup, bad.name === 'password' ? 'Your password needs at least 8 characters.'
        : bad.name === 'accept' ? 'Please confirm you are 18 or older and accept our terms.'
        : 'Please fill in all fields.');
    }
    if (!isAdult(f.date_of_birth.value)) {
      return formMessage(signup, 'Sorry, you must be 18 or older to create an account.');
    }
    const button = signup.querySelector('button');
    button.disabled = true;
    const { data, error } = await client.auth.signUp({
      email: f.email.value.trim(),
      password: f.password.value,
      options: {
        emailRedirectTo: `${location.origin}/account.html`,
        data: {
          first_name: f.first_name.value.trim(), last_name: f.last_name.value.trim(),
          phone: f.phone.value.trim(), date_of_birth: f.date_of_birth.value,
        },
      },
    });
    button.disabled = false;
    if (error) {
      return formMessage(signup, /database error/i.test(error.message)
        ? 'Sorry, you must be 18 or older to create an account.'
        : error.message);
    }
    if (!data.session) {
      renderSignedOut(`Almost done! We've sent a confirmation link to <strong>${escapeHtml(f.email.value.trim())}</strong>. Click it to activate your account.`);
    }
  });
}

function renderPasswordReset() {
  root.innerHTML = `<form class="auth-card auth-single" novalidate>
    <h2>Choose a New Password</h2>
    ${field('password', 'New password (at least 8 characters)', 'type="password" required minlength="8" autocomplete="new-password"')}
    <p class="form-msg form-error" role="alert"></p>
    <button class="btn btn-primary btn-block">Save Password</button></form>`;
  const form = root.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return formMessage(form, 'Your password needs at least 8 characters.');
    const { error } = await client.auth.updateUser({ password: form.elements.password.value });
    if (error) return formMessage(form, error.message);
    history.replaceState(null, '', 'account.html');
    renderAccount();
  });
}

// ---------------------------------------------------------------- signed in
async function renderAccount() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) return renderSignedOut();
  const next = nextPage();
  if (next) {
    location.href = next;
    return;
  }

  const { data: profile } = await client.from('profiles').select('*').maybeSingle();
  const tab = location.hash.replace('#', '') || 'orders';
  root.innerHTML = `<div class="account-head">
      <h2>Hello, ${escapeHtml(profile ? profile.first_name : '')}</h2>
      <button type="button" class="link-btn sign-out">Sign out</button>
    </div>
    <nav class="account-tabs" role="tablist">
      ${['orders', 'wishlist', 'addresses', 'details'].map((t) =>
        `<a href="#${t}" role="tab" class="${t === tab ? 'active' : ''}" aria-selected="${t === tab}">${t[0].toUpperCase() + t.slice(1)}</a>`).join('')}
    </nav>
    <div class="account-panel"></div>`;

  root.querySelector('.sign-out').addEventListener('click', async () => {
    await client.auth.signOut();
    location.hash = '';
    renderSignedOut();
  });
  const panel = root.querySelector('.account-panel');
  const views = { orders: renderOrders, wishlist: renderWishlist, addresses: renderAddresses, details: renderDetails };
  await (views[tab] || renderOrders)(panel, session, profile);
}

async function renderOrders(panel) {
  const { data: orders } = await client.from('orders')
    .select('reference, created_at, status, total, order_items(name, quantity)')
    .order('created_at', { ascending: false });
  if (!orders || !orders.length) {
    panel.innerHTML = '<div class="store-empty"><p>You haven\'t placed any orders yet.</p><a href="shop.html" class="btn btn-outline">Shop the Collection</a></div>';
    return;
  }
  panel.innerHTML = orders.map((o) => `<div class="order-card">
    <div><strong>${escapeHtml(o.reference)}</strong>
      <span class="field-note">${new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
    <div>${o.order_items.map((i) => `${escapeHtml(i.name)} &times; ${i.quantity}`).join('<br />')}</div>
    <div><span class="status-pill status-${o.status}">${STATUS[o.status] || o.status}</span></div>
    <div class="order-total">${money(o.total)}</div></div>`).join('');
}

async function renderWishlist(panel) {
  const [{ data: items }, products] = await Promise.all([
    client.from('wishlist').select('product_slug').order('created_at', { ascending: false }),
    loadProducts(),
  ]);
  if (!items || !items.length) {
    panel.innerHTML = '<div class="store-empty"><p>Your wishlist is empty. Tap "Add to Wishlist" on any piece to save it here.</p><a href="shop.html" class="btn btn-outline">Browse the Collection</a></div>';
    return;
  }
  panel.innerHTML = `<div class="wish-grid">${items.map(({ product_slug: slug }) => {
    const p = products[slug] || { name: slug };
    return `<div class="wish-card" data-slug="${escapeHtml(slug)}">
      <a href="${productPage(slug)}">${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />` : ''}</a>
      <a href="${productPage(slug)}" class="cart-name">${escapeHtml(p.name)}</a>
      <span class="field-note">${p.price !== null && p.price !== undefined ? money(p.price) : 'Price on request'}</span>
      <button type="button" class="link-btn wish-remove">Remove</button></div>`;
  }).join('')}</div>`;
  panel.querySelectorAll('.wish-remove').forEach((b) => b.addEventListener('click', async () => {
    const slug = b.closest('.wish-card').dataset.slug;
    await client.from('wishlist').delete().eq('product_slug', slug);
    renderWishlist(panel);
  }));
}

async function renderAddresses(panel) {
  const [{ data: addresses }, { data: areas }] = await Promise.all([
    client.from('addresses').select('*').order('created_at'),
    client.from('delivery_areas').select('*').order('sort'),
  ]);
  const open = areas.filter((a) => a.accepts_orders);
  const list = (addresses || []).map((a) => `<div class="address-card" data-id="${a.id}">
      ${a.is_default ? '<span class="status-pill">Preferred</span>' : ''}
      <strong>${escapeHtml(a.label || a.recipient_name)}</strong>
      <p>${[a.recipient_name, a.street, a.building && `Building ${a.building}`, a.floor && `Floor ${a.floor}`, a.city, a.governorate]
        .filter(Boolean).map(escapeHtml).join(', ')}<br />${escapeHtml(a.phone)}</p>
      <div class="address-actions">
        ${a.is_default ? '' : '<button type="button" class="link-btn make-default">Make preferred</button>'}
        <button type="button" class="link-btn remove">Delete</button></div></div>`).join('');

  panel.innerHTML = `<div class="address-grid">${list || '<p class="field-note">No saved addresses yet.</p>'}</div>
    <form class="auth-card address-form" novalidate>
      <h3>Add an Address</h3>
      <p class="field-note">We deliver within Lebanon only${areas.some((a) => !a.accepts_orders)
        ? `, and do not currently deliver to ${areas.filter((a) => !a.accepts_orders).map((a) => escapeHtml(a.governorate)).join(', ')}` : ''}.</p>
      <div class="form-grid">
        ${field('label', 'Label (e.g. Home, Work)')}
        ${field('recipient_name', 'Recipient name', 'required')}
        ${field('phone', 'Phone', 'type="tel" required placeholder="+961"')}
        <label class="field"><span>Governorate</span><select name="governorate" required><option value="">Choose&hellip;</option>
          ${open.map((a) => `<option>${escapeHtml(a.governorate)}</option>`).join('')}</select></label>
        ${field('city', 'Town / area', 'required')}
        ${field('street', 'Street', 'required')}
        ${field('building', 'Building')}
        ${field('floor', 'Floor / apartment')}
      </div>
      <label class="field"><span>Directions or notes</span><textarea name="notes" rows="2"></textarea></label>
      <label class="check"><input type="checkbox" name="is_default" ${addresses && addresses.length ? '' : 'checked'} /> <span>Make this my preferred address</span></label>
      <p class="form-msg form-error" role="alert"></p>
      <button class="btn btn-primary">Save Address</button>
    </form>`;

  panel.querySelectorAll('.address-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.make-default')?.addEventListener('click', async () => {
      await client.from('addresses').update({ is_default: true }).eq('id', id);
      renderAddresses(panel);
    });
    card.querySelector('.remove').addEventListener('click', async () => {
      if (!confirm('Delete this address?')) return;
      await client.from('addresses').delete().eq('id', id);
      renderAddresses(panel);
    });
  });

  const form = panel.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return formMessage(form, 'Please fill in the required fields.');
    const data = Object.fromEntries(new FormData(form));
    const { error } = await client.from('addresses').insert({
      label: data.label || null, recipient_name: data.recipient_name, phone: data.phone,
      governorate: data.governorate, city: data.city, street: data.street, building: data.building || null,
      floor: data.floor || null, notes: data.notes || null, is_default: Boolean(data.is_default),
    });
    if (error) return formMessage(form, 'Sorry, the address could not be saved.');
    renderAddresses(panel);
  });
}

async function renderDetails(panel, session, profile) {
  panel.innerHTML = `<form class="auth-card details-form" novalidate>
      <h3>Your Details</h3>
      <div class="form-grid">
        ${field('first_name', 'First name', 'required')}
        ${field('last_name', 'Last name', 'required')}
        ${field('phone', 'Phone (WhatsApp)', 'type="tel" required')}
        ${field('email', 'Email', 'readonly')}
        ${field('date_of_birth', 'Date of birth', 'readonly')}
      </div>
      <p class="form-msg form-error" role="alert"></p>
      <button class="btn btn-primary">Save Changes</button>
    </form>
    <form class="auth-card password-form" novalidate>
      <h3>Change Password</h3>
      ${field('password', 'New password (at least 8 characters)', 'type="password" required minlength="8" autocomplete="new-password"')}
      <p class="form-msg form-error" role="alert"></p>
      <button class="btn btn-outline">Update Password</button>
    </form>
    <div class="auth-card danger-zone">
      <h3>Delete Account</h3>
      <p class="field-note">This permanently deletes your account, saved addresses and wishlist. Records of past orders are kept as explained in our <a href="privacy.html">Privacy Policy</a>.</p>
      <p class="form-msg form-error" role="alert"></p>
      <button type="button" class="btn btn-outline delete-account">Delete My Account</button>
    </div>`;

  const details = panel.querySelector('.details-form');
  details.elements.first_name.value = profile?.first_name || '';
  details.elements.last_name.value = profile?.last_name || '';
  details.elements.phone.value = profile?.phone || '';
  details.elements.email.value = session.user.email;
  details.elements.date_of_birth.value = profile?.date_of_birth || '';
  details.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!details.checkValidity()) return formMessage(details, 'Please fill in your name and phone.');
    const { error } = await client.from('profiles').update({
      first_name: details.elements.first_name.value.trim(),
      last_name: details.elements.last_name.value.trim(),
      phone: details.elements.phone.value.trim(),
    }).eq('id', session.user.id);
    formMessage(details, error ? 'Sorry, your details could not be saved.' : 'Saved.', !error);
  });

  const pwd = panel.querySelector('.password-form');
  pwd.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pwd.checkValidity()) return formMessage(pwd, 'Your password needs at least 8 characters.');
    const { error } = await client.auth.updateUser({ password: pwd.elements.password.value });
    formMessage(pwd, error ? error.message : 'Password updated.', !error);
    if (!error) pwd.reset();
  });

  const danger = panel.querySelector('.danger-zone');
  danger.querySelector('.delete-account').addEventListener('click', async () => {
    if (!confirm('Delete your Siaram account permanently? This cannot be undone.')) return;
    const res = await fetch('/api/delete-account', {
      method: 'POST', headers: { authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return formMessage(danger, (await res.json().catch(() => ({}))).error || 'Could not delete your account.');
    await client.auth.signOut();
    renderSignedOut('Your account has been deleted.');
  });
}

async function init() {
  client = await getClient();
  let recovering = /type=recovery/.test(location.hash);
  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recovering = true;
      renderPasswordReset();
    } else if (event === 'SIGNED_IN' && !recovering) {
      renderAccount();
    }
  });
  window.addEventListener('hashchange', () => {
    if (['#orders', '#wishlist', '#addresses', '#details'].includes(location.hash)) renderAccount();
  });
  if (recovering) renderPasswordReset();
  else await renderAccount();
}

if (storeEnabled) {
  init().catch((err) => {
    console.error(err);
    root.innerHTML = '<p class="form-error">Sorry, your account could not be loaded. Please refresh the page.</p>';
  });
}
