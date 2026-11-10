// Account page: sign in, create account (18+), password reset, and the signed-in area
// with orders, wishlist, saved addresses and personal details. The shop owner gets an admin page instead, with a
// Record a Sale tab (in-person, Instagram, WhatsApp and event sales) and a Workbook tab (backup download for the workbook).
import { apiUrl, escapeHtml, getClient, loadProducts, money, productPage, storeEnabled } from './store.js';

const root = document.getElementById('store-root');
let client;

const STATUS = {
  received: 'Order received', awaiting_payment: 'Awaiting payment', paid: 'Paid', preparing: 'Being prepared', ready: 'Ready for pickup by the courier',
  dispatched: 'On its way', delivered: 'Delivered', cancelled: 'Cancelled',
};

const field = (name, label, attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" ${attrs} /></label>`;
// Birthday as day, month, year (not the browser's month/day/year date box). The three choices fill a hidden
// date_of_birth field (YYYY-MM-DD), or leave it empty until all three are chosen.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];
const birthdayField = () => {
  const thisYear = new Date().getFullYear();
  const opts = (list) => list.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  return `<div class="field birthday-field"><span>Birthday (optional)</span>
      <div class="birthday-parts">
        <select name="bday_day" aria-label="Day"><option value="">Day</option>
          ${opts(Array.from({ length: 31 }, (_, i) => [String(i + 1).padStart(2, '0'), i + 1]))}</select>
        <select name="bday_month" aria-label="Month"><option value="">Month</option>
          ${opts(MONTHS.map((m, i) => [String(i + 1).padStart(2, '0'), m]))}</select>
        <select name="bday_year" aria-label="Year"><option value="">Year</option>
          ${opts(Array.from({ length: 90 }, (_, i) => [thisYear - 18 - i, thisYear - 18 - i]))}</select>
      </div>
      <input type="hidden" name="date_of_birth" />
    </div>`;
};
const syncBirthday = (form) => {
  const f = form.elements;
  const [d, m, y] = [f.bday_day.value, f.bday_month.value, f.bday_year.value];
  const date = d && m && y ? `${y}-${m}-${d}` : '';
  const valid = date && new Date(`${date}T00:00:00`).getDate() === Number(d);
  f.date_of_birth.value = valid ? date : '';
  return { partial: Boolean(d || m || y) && !date, invalid: Boolean(date) && !valid };
};
const setBirthday = (form, iso) => {
  const [y, m, d] = (iso || '').split('-');
  form.elements.bday_day.value = d || '';
  form.elements.bday_month.value = m || '';
  form.elements.bday_year.value = y || '';
  syncBirthday(form);
};
const birthdayProblem = (form) => {
  const { partial, invalid } = syncBirthday(form);
  if (partial) return 'Please choose the day, month and year of your birthday, or leave all three empty.';
  if (invalid) return 'Please check your birthday: that date does not exist.';
  return '';
};
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

    <form class="auth-card" data-form="signup" id="create" novalidate>
      <h2>Create an Account</h2>
      <p class="field-note">Save your details, delivery addresses and wishlist, and see your orders. You must be 18 or older.</p>
      <div class="form-grid">
        ${field('first_name', 'First name', 'required autocomplete="given-name"')}
        ${field('last_name', 'Last name', 'required autocomplete="family-name"')}
      </div>
      ${field('email', 'Email', 'type="email" required autocomplete="email"')}
      ${field('phone', 'Phone (with country code if outside Lebanon)', 'type="tel" required autocomplete="tel" placeholder="+961 70 123 456"')}
      ${field('password', 'Password (at least 8 characters)', 'type="password" required minlength="8" autocomplete="new-password"')}
      ${birthdayField()}
      <label class="check"><input type="checkbox" name="accept" required /> <span>I am 18 or older and agree to the
        <a href="terms.html" target="_blank">Terms &amp; Conditions</a> and <a href="privacy.html" target="_blank">Privacy Policy</a>.</span></label>
      <p class="field-note marketing-note">Would you like to hear about new collections, styling and care advice and stories from Siaram? (Optional; leave unticked if not.)</p>
      <label class="check"><input type="checkbox" name="marketing_email" /> <span>Yes, by email</span></label>
      <label class="check"><input type="checkbox" name="marketing_whatsapp" /> <span>Yes, by WhatsApp</span></label>
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
  // Checkout's "create an account" link lands here.
  if (location.hash === '#create') {
    signup.scrollIntoView({ block: 'start' });
    signup.elements.first_name.focus({ preventScroll: true });
  }
  signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = signup.elements;
    if (!signup.checkValidity()) {
      const bad = signup.querySelector('input:invalid, select:invalid, textarea:invalid');
      return formMessage(signup, bad.name === 'password' ? 'Your password needs at least 8 characters.'
        : bad.name === 'accept' ? 'Please confirm you are 18 or older and accept our terms.'
        : 'Please fill in all fields.');
    }
    if (birthdayProblem(signup)) return formMessage(signup, birthdayProblem(signup));
    if (f.date_of_birth.value && !isAdult(f.date_of_birth.value)) {
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
          phone: f.phone.value.trim(), date_of_birth: f.date_of_birth.value || null,
          age_confirmed: f.accept.checked,
          marketing_email: f.marketing_email.checked, marketing_whatsapp: f.marketing_whatsapp.checked,
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

  const [{ data: profile }, owner] = await Promise.all([
    client.from('profiles').select('*').maybeSingle(),
    isOwner(session),
  ]);
  // The shop owner gets an admin page (sales and workbook) instead of the customer tabs.
  const tabs = owner ? ['sale', 'workbook'] : ['orders', 'wishlist', 'addresses', 'details'];
  const TAB_LABELS = { sale: 'Record a Sale' };
  const tab = tabs.includes(location.hash.replace('#', '')) ? location.hash.replace('#', '') : tabs[0];
  root.innerHTML = `<div class="account-head">
      <h2>${owner ? 'Siaram Admin' : `Hello, ${escapeHtml(profile ? profile.first_name : '')}`}</h2>
      <button type="button" class="link-btn sign-out">Sign out</button>
    </div>
    <nav class="account-tabs" role="tablist">
      ${tabs.map((t) =>
        `<a href="#${t}" role="tab" class="${t === tab ? 'active' : ''}" aria-selected="${t === tab}">${TAB_LABELS[t] || t[0].toUpperCase() + t.slice(1)}</a>`).join('')}
    </nav>
    <div class="account-panel"></div>`;

  root.querySelector('.sign-out').addEventListener('click', async () => {
    await client.auth.signOut();
    location.hash = '';
    renderSignedOut();
  });
  const panel = root.querySelector('.account-panel');
  const views = owner ? { sale: renderSale, workbook: renderWorkbook }
    : { orders: renderOrders, wishlist: renderWishlist, addresses: renderAddresses, details: renderDetails };
  await views[tab](panel, session, profile);
}

async function renderOrders(panel) {
  const { data: orders } = await client.from('orders')
    .select('reference, created_at, status, total, tracking_number, courier_tracking_url, order_items(name, quantity)')
    .order('created_at', { ascending: false });
  if (!orders || !orders.length) {
    panel.innerHTML = '<div class="store-empty"><p>You haven\'t placed any orders yet.</p><a href="shop.html" class="btn btn-outline">Shop the Collection</a></div>';
    return;
  }
  panel.innerHTML = orders.map((o) => `<div class="order-card">
    <div><strong>${escapeHtml(o.reference)}</strong>
      <span class="field-note">${new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
    <div>${o.order_items.map((i) => `${escapeHtml(i.name)} &times; ${i.quantity}`).join('<br />')}</div>
    <div><span class="status-pill status-${o.status}">${STATUS[o.status] || o.status}</span>
      ${o.courier_tracking_url && /^https:\/\//.test(o.courier_tracking_url) && ['ready', 'dispatched'].includes(o.status)
        ? `<br /><a href="${escapeHtml(o.courier_tracking_url)}" target="_blank" rel="noopener">Track your parcel</a>` : ''}</div>
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
        ${field('phone', 'Phone', 'type="tel" required')}
        ${field('email', 'Email', 'readonly')}
        ${birthdayField()}
      </div>
      <fieldset class="contact-pref">
        <legend>How would you like us to contact you about your orders?</legend>
        <div class="choice-pills">
          <label class="choice-pill"><input type="radio" name="preferred_contact" value="Call" /><span>Call</span></label>
          <label class="choice-pill"><input type="radio" name="preferred_contact" value="Text message" /><span>Text message</span></label>
          <label class="choice-pill"><input type="radio" name="preferred_contact" value="WhatsApp" /><span>WhatsApp</span></label>
          <label class="choice-pill"><input type="radio" name="preferred_contact" value="Email" /><span>Email</span></label>
        </div>
      </fieldset>
      <p class="field-note marketing-note">News about new collections, styling and care advice (you can change this at any time):</p>
      <label class="check"><input type="checkbox" name="marketing_email" /> <span>Yes, by email</span></label>
      <label class="check"><input type="checkbox" name="marketing_whatsapp" /> <span>Yes, by WhatsApp</span></label>
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
  setBirthday(details, profile?.date_of_birth || '');
  details.elements.marketing_email.checked = Boolean(profile?.marketing_email);
  details.elements.marketing_whatsapp.checked = Boolean(profile?.marketing_whatsapp);
  if (profile?.preferred_contact) details.elements.preferred_contact.value = profile.preferred_contact;
  details.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = details.elements;
    if (!details.checkValidity()) return formMessage(details, 'Please fill in your name and phone.');
    if (birthdayProblem(details)) return formMessage(details, birthdayProblem(details));
    if (f.date_of_birth.value && !isAdult(f.date_of_birth.value)) {
      return formMessage(details, 'Account holders must be 18 or older. Please check your birthday.');
    }
    const { error } = await client.from('profiles').update({
      first_name: f.first_name.value.trim(),
      last_name: f.last_name.value.trim(),
      phone: f.phone.value.trim(),
      date_of_birth: f.date_of_birth.value || null,
      marketing_email: f.marketing_email.checked,
      marketing_whatsapp: f.marketing_whatsapp.checked,
      preferred_contact: f.preferred_contact.value || null,
    }).eq('id', session.user.id);
    formMessage(details, error ? (/18 or older/.test(error.message) ? error.message : 'Sorry, your details could not be saved.') : 'Saved.', !error);
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
    const res = await fetch(apiUrl('delete-account'), {
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
  // Clicking a tab changes the address (#sale, #orders...); redraw the page for it.
  window.addEventListener('hashchange', () => {
    if (['#orders', '#wishlist', '#addresses', '#details', '#sale', '#workbook'].includes(location.hash)) renderAccount();
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

// ---------------------------------------------------------------- owner: workbook backup
async function isOwner(session) {
  try {
    const res = await fetch(`${apiUrl('export-sales')}?check=1`, { headers: { authorization: `Bearer ${session.access_token}` } });
    return res.ok && (await res.json()).owner === true;
  } catch {
    return false;
  }
}

function renderWorkbook(panel, session) {
  panel.innerHTML = `<form class="auth-card workbook-form" novalidate>
      <h3>Download for Your Workbook</h3>
      <p class="field-note">One Excel file with two tabs laid out like your workbook: <strong>Sales</strong> (website orders
        and the sales you record here, one row per piece) and <strong>Customers</strong>. Cancelled orders are left out.
        Leave the dates empty to get everything.</p>
      <div class="form-grid">
        ${field('from', 'From (order date)', 'type="date"')}
        ${field('to', 'To (order date)', 'type="date"')}
      </div>
      <p class="form-msg form-error" role="alert"></p>
      <div class="hero-actions">
        <button type="button" class="btn btn-primary" data-kind="workbook">Download for Workbook</button>
      </div>
      <ol class="field-note workbook-steps">
        <li>Open the file. On its <strong>Sales</strong> tab, copy the rows under the heading row.</li>
        <li>In your workbook, on the Sales tab, click column A of the first empty row.</li>
        <li>Choose Paste Special, then Values, and tick <strong>Skip blanks</strong> so your formulas stay as they are.</li>
        <li>On the file's <strong>Customers</strong> tab, copy only the people who are not on your Customers tab yet, and paste them the same way.</li>
      </ol>
      <p class="field-note">For website orders, Cash Received Now is filled in once the order is marked delivered; before that it shows 0.</p>
    </form>`;
  const form = panel.querySelector('form');
  form.querySelectorAll('[data-kind]').forEach((btn) => btn.addEventListener('click', async () => {
    formMessage(form, '');
    const params = new URLSearchParams(btn.dataset.kind === 'workbook' ? {} : { kind: btn.dataset.kind });
    if (form.elements.from.value) params.set('from', form.elements.from.value);
    if (form.elements.to.value) params.set('to', form.elements.to.value);
    btn.disabled = true;
    try {
      const { data: { session: current } } = await client.auth.getSession();
      const res = await fetch(`${apiUrl('export-sales')}?${params}`, {
        headers: { authorization: `Bearer ${(current || session).access_token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not prepare the download.');
      const name = (res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'Siaram-workbook.xlsx';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await res.blob());
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      formMessage(form, err.message);
    } finally {
      btn.disabled = false;
    }
  }));
}

// ---------------------------------------------------------------- owner: record a sale
// In-person, Instagram, WhatsApp and event sales. Each becomes an order with the next S number; pieces taken
// from stock come off it, and the sale appears in the workbook download with its channel.
const METALS = [['yellow', 'Yellow gold'], ['rose', 'Rose gold'], ['white', 'White gold']];

async function renderSale(panel, session) {
  const [{ data: products }, { data: stock }] = await Promise.all([
    client.from('products').select('slug, name, price, sizes, sku').order('name'),
    client.rpc('available_stock'),
  ]);
  const bySlug = Object.fromEntries((products || []).map((p) => [p.slug, p]));
  const inStock = new Set((stock || []).map((r) => `${r.product_slug}|${r.metal}|${r.size}`));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Beirut' });
  const options = (list, chosen) => list.map(([v, l]) => `<option value="${escapeHtml(v)}"${v === chosen ? ' selected' : ''}>${escapeHtml(l)}</option>`).join('');

  const line = () => `<div class="sale-line">
      <label class="field"><span>Piece</span><select name="slug"><option value="">Choose a piece</option>
        ${options((products || []).map((p) => [p.slug, p.sku ? `${p.name} (${p.sku})` : p.name]))}</select></label>
      <label class="field"><span>Gold</span><select name="metal">${options(METALS, 'yellow')}</select></label>
      <label class="field sale-size"><span>Size</span><select name="size" disabled><option value="">—</option></select></label>
      <label class="field"><span>Qty</span><input name="quantity" type="number" min="1" max="10" value="1" /></label>
      <label class="field"><span>Price each ($)</span><input name="unit_price" type="number" min="0" step="0.01" /></label>
      <label class="check sale-stock"><input type="checkbox" name="from_stock" checked /> <span>Taken from stock</span></label>
      <button type="button" class="link-btn sale-remove" aria-label="Remove this piece">Remove</button>
    </div>`;

  panel.innerHTML = `<form class="auth-card sale-form" novalidate>
      <h3>Record a Sale</h3>
      <p class="field-note">For sales made in person, on Instagram, on WhatsApp or at an event. The sale gets the next order
        number, pieces taken from stock come off your stock, and it appears in your Workbook download. No email is sent.</p>
      <div class="form-grid">
        ${field('sale_date', 'Date of the sale', `type="date" value="${today}" max="${today}"`)}
        <label class="field"><span>Where was it sold?</span><select name="channel">
          ${options([['In person', 'In person'], ['Instagram', 'Instagram'], ['WhatsApp', 'WhatsApp'], ['Event', 'Event or pop-up'], ['Other', 'Other']], 'In person')}</select></label>
        ${field('customer_name', "Customer's name", 'required maxlength="200"')}
        ${field('phone', 'Phone or WhatsApp (optional)', 'type="tel" maxlength="40"')}
        ${field('email', 'Email (optional)', 'type="email" maxlength="200"')}
      </div>
      <h4 class="sale-sub">Pieces</h4>
      <div class="sale-lines">${line()}</div>
      <button type="button" class="link-btn sale-add">+ Add another piece</button>
      <div class="form-grid">
        <label class="field"><span>How was it paid?</span><select name="payment_method">
          ${options([['cash', 'Cash'], ['whish', 'Whish'], ['card', 'Card'], ['bank', 'Bank transfer'], ['voucher', 'Gift voucher']], 'cash')}</select></label>
        ${field('voucher_code', 'Gift voucher code (if one was used)', 'maxlength="40" autocomplete="off"')}
      </div>
      <label class="field"><span>Notes (optional)</span><textarea name="notes" rows="2" maxlength="1000"></textarea></label>
      <p class="sale-total">Total: <strong>$0.00</strong></p>
      <p class="form-msg form-error" role="alert"></p>
      <button type="submit" class="btn btn-primary">Record Sale</button>
    </form>`;

  const form = panel.querySelector('form');
  const lines = form.querySelector('.sale-lines');
  const total = () => {
    let sum = 0;
    lines.querySelectorAll('.sale-line').forEach((l) => {
      sum += (Number(l.querySelector('[name=unit_price]').value) || 0) * (Number(l.querySelector('[name=quantity]').value) || 0);
    });
    form.querySelector('.sale-total strong').textContent = money(sum);
  };
  // Choosing a piece fills in its price and sizes, and ticks "Taken from stock" when that version is in stock.
  const refresh = (l, priceToo) => {
    const p = bySlug[l.querySelector('[name=slug]').value];
    const sizeSelect = l.querySelector('[name=size]');
    if (priceToo) {
      l.querySelector('[name=unit_price]').value = p && p.price != null ? Number(p.price) : '';
      sizeSelect.innerHTML = p && p.sizes ? options(p.sizes.map((z) => [z, z])) : '<option value="">—</option>';
    }
    sizeSelect.disabled = !(p && p.sizes);
    if (p) {
      const key = `${p.slug}|${l.querySelector('[name=metal]').value}|${p.sizes ? sizeSelect.value : ''}`;
      l.querySelector('[name=from_stock]').checked = inStock.has(key);
    }
    total();
  };
  lines.addEventListener('change', (e) => {
    const l = e.target.closest('.sale-line');
    if (['slug', 'metal', 'size'].includes(e.target.name)) refresh(l, e.target.name === 'slug');
    else total();
  });
  lines.addEventListener('input', total);
  lines.addEventListener('click', (e) => {
    if (!e.target.classList.contains('sale-remove')) return;
    if (lines.children.length > 1) e.target.closest('.sale-line').remove();
    total();
  });
  form.querySelector('.sale-add').addEventListener('click', () => {
    lines.insertAdjacentHTML('beforeend', line());
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMessage(form, '');
    const f = form.elements;
    if (!f.customer_name.value.trim()) return formMessage(form, "Please enter the customer's name.");
    const items = [...lines.querySelectorAll('.sale-line')].map((l) => ({
      slug: l.querySelector('[name=slug]').value, metal: l.querySelector('[name=metal]').value,
      size: l.querySelector('[name=size]').value, quantity: Number(l.querySelector('[name=quantity]').value),
      unit_price: l.querySelector('[name=unit_price]').value, from_stock: l.querySelector('[name=from_stock]').checked,
    }));
    if (items.some((i) => !i.slug)) return formMessage(form, 'Please choose the piece for every line.');
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const { data: { session: current } } = await client.auth.getSession();
      const res = await fetch(apiUrl('record-sale'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${(current || session).access_token}` },
        body: JSON.stringify({
          sale_date: f.sale_date.value, channel: f.channel.value, customer_name: f.customer_name.value, phone: f.phone.value,
          email: f.email.value, payment_method: f.payment_method.value, voucher_code: f.voucher_code.value, notes: f.notes.value, items,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not record the sale.');
      panel.innerHTML = `<div class="order-done">
          <span class="eyebrow">Sale recorded</span>
          <h2>${escapeHtml(body.reference)}</h2>
          <p>Total ${money(body.total)}. ${body.status === 'preparing' ? 'Pieces not taken from stock are marked as being made.' : 'Stock has been updated.'}
            It will be in your next Workbook download.</p>
          <button type="button" class="btn btn-outline sale-again">Record Another Sale</button>
        </div>`;
      panel.querySelector('.sale-again').addEventListener('click', () => renderSale(panel, session));
    } catch (err) {
      formMessage(form, err.message);
      button.disabled = false;
    }
  });
}
