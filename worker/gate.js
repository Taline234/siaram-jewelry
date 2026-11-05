// Private-access gate for siaramjewelry.com.
//
// OFF by default: the website is served exactly as before. To close the site while you make big
// changes, add a secret called SITE_PASSWORD in Cloudflare (Workers & Pages -> siaram-jewelry ->
// Settings -> Variables and Secrets). Visitors then see a branded "Coming soon" page with a mailing-list sign-up, and need
// that password to get in. Delete the secret to open the site again. Changing the password signs
// everyone out. How-to with screenshots of the steps: STORE-SETUP.md, "Closing the site while you edit".

const COOKIE = 'sj_access';
const GATE_PATH = '/__private-access';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

// Files the gate page itself needs, so they load before anyone has signed in.
const ALWAYS_OPEN = new Set(['/images/logo-transparent.png', '/images/logo-hero.png', '/images/logo.jpeg', '/favicon.ico',
  '/unsubscribe', '/unsubscribe.html', '/css/style.css', '/js/script.js', '/js/store.js', '/js/store-config.js', '/js/unsubscribe.js']);
// The "Coming soon" sign-up saves the email here (the same function as the website's mailing-list form).
const SUBSCRIBE_URL = 'https://vdfxyjusmakqnpptniiy.supabase.co/functions/v1/newsletter-subscribe';

export default {
  async fetch(request, env) {
    const password = (env.SITE_PASSWORD || '').trim();
    if (!password) return env.ASSETS.fetch(request);

    const url = new URL(request.url);
    const token = await accessToken(password);

    if (url.pathname === GATE_PATH && request.method === 'POST') {
      return signIn(request, url, password, token);
    }
    if (url.pathname === GATE_PATH + '/sign-out') {
      return redirect('/', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    }
    if (ALWAYS_OPEN.has(url.pathname)) return env.ASSETS.fetch(request);
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    }

    if (readCookie(request, COOKIE) === token) {
      const response = await env.ASSETS.fetch(request);
      const open = new Response(response.body, response);
      open.headers.set('Cache-Control', 'private, no-store');
      open.headers.set('X-Robots-Tag', 'noindex');
      return open;
    }

    return gatePage(url.pathname + url.search, false);
  },
};

async function signIn(request, url, password, token) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return gatePage('/', true);
  }
  const next = safeNext(form.get('next'));
  const attempt = String(form.get('password') || '');
  // Compare fingerprints rather than the raw text, so the check takes the same time either way.
  if ((await accessToken(attempt.trim())) !== token) return gatePage(next, true);
  return redirect(next, `${COOKIE}=${token}; Path=/; Max-Age=${THIRTY_DAYS}; HttpOnly; Secure; SameSite=Lax`);
}

// A fingerprint of the password, stored in the visitor's browser instead of the password itself.
async function accessToken(password) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('siaram-private-access-v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

// Only send people back to a page on this site after signing in.
function safeNext(value) {
  const next = String(value || '/');
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}

function redirect(location, cookie) {
  return new Response(null, {
    status: 303,
    headers: { Location: location, 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
  });
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function gatePage(next, wrongPassword) {
  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Coming soon | Siaram Jewelry</title>
<meta name="description" content="Siaram Jewelry: meaningful 18k gold jewelry. Our website is coming soon; leave your email to be the first to know." />
<link rel="icon" href="/images/logo.jpeg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
<style>
  :root { --green: #1b3a2b; --green-mid: #2b4f3b; --cream: #f3ede2; --paper: #faf7f1; --gold: #b99a5b; --gold-text: #7c6026;
          --ink: #2a2a24; --line: rgba(27,58,43,.22); }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
         padding: 48px 20px; background: var(--cream); color: var(--ink); font-family: 'Jost', sans-serif; -webkit-font-smoothing: antialiased; }
  main { width: 100%; max-width: 520px; text-align: center; }
  .logo { width: 220px; max-width: 70%; height: auto; margin: 0 auto 36px; display: block; }
  .eyebrow { display: inline-flex; align-items: center; gap: 12px; font-size: .72rem; letter-spacing: .3em; text-transform: uppercase; color: var(--gold-text); }
  .eyebrow::before, .eyebrow::after { content: ""; width: 28px; height: 1px; background: currentColor; opacity: .6; }
  h1 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: clamp(2.2rem, 7vw, 3.2rem); line-height: 1.1;
       text-transform: uppercase; letter-spacing: .06em; color: var(--green); margin: 16px 0 14px; }
  .tagline { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 1.2rem; color: var(--green-mid); margin: 0 0 18px; }
  p.lede { margin: 0 auto 30px; max-width: 440px; font-weight: 300; font-size: 1rem; line-height: 1.7; color: #4f4f46; }
  .notify { display: flex; gap: 0; max-width: 440px; margin: 0 auto; }
  .notify input { flex: 1; min-width: 0; padding: 15px 16px; font: inherit; font-size: 1rem; color: var(--ink); background: #fffdf9;
                  border: 1px solid var(--line); border-right: 0; border-radius: 0; outline: none; }
  .notify input:focus { border-color: var(--green); }
  .notify button, .enter button { padding: 15px 22px; font: inherit; font-size: .76rem; letter-spacing: .22em; text-transform: uppercase;
           font-weight: 500; color: #fff; background: var(--green); border: 0; cursor: pointer; white-space: nowrap; }
  .notify button:hover, .enter button:hover { background: var(--green-mid); }
  .notify button:disabled { opacity: .6; cursor: wait; }
  .consent { max-width: 440px; margin: 10px auto 0; font-size: .74rem; line-height: 1.6; color: #6b6b5f; }
  .msg { min-height: 1.4em; margin: 12px 0 0; font-size: .92rem; color: var(--green); }
  .msg.err { color: #8a2f2f; }
  .hp { position: absolute; left: -9999px; }
  details { margin-top: 44px; font-size: .82rem; color: #6b6b5f; }
  summary { cursor: pointer; list-style: none; letter-spacing: .12em; text-transform: uppercase; font-size: .7rem; color: var(--gold-text); }
  summary::-webkit-details-marker { display: none; }
  .enter { display: flex; max-width: 320px; margin: 14px auto 0; }
  .enter input { flex: 1; min-width: 0; padding: 12px 14px; font: inherit; border: 1px solid var(--line); border-right: 0; background: #fffdf9; border-radius: 0; }
  .enter button { padding: 12px 16px; }
  .error { margin: 10px 0 0; color: #8a2f2f; }
  footer { margin-top: 40px; font-size: .8rem; font-weight: 300; color: #6b6b5f; text-align: center; }
  footer a { color: var(--green); }
  @media (max-width: 480px) { .notify { flex-direction: column; } .notify input { border-right: 1px solid var(--line); border-bottom: 0; } }
</style>
</head>
<body>
<main>
  <img class="logo" src="/images/logo-hero.png" alt="Siaram Jewelry" width="427" height="96" />
  <span class="eyebrow">Coming Soon</span>
  <h1>Something new<br />is coming</h1>
  <p class="tagline">Simply Elegant. Endlessly Yours.</p>
  <p class="lede">Our website is almost ready. Leave your email to be the first to know when it launches, and to receive our new
    collections, the stories behind our pieces and jewelry care advice.</p>
  <form class="notify" novalidate>
    <label class="hp" aria-hidden="true">Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
    <input type="email" name="email" required autocomplete="email" placeholder="Your email address" aria-label="Email address" />
    <button type="submit">Notify me</button>
  </form>
  <p class="consent">By subscribing, you agree to receive marketing emails from Siaram Jewelry. Unsubscribe at any time.</p>
  <p class="msg" role="status" aria-live="polite"></p>

  <details${wrongPassword ? ' open' : ''}>
    <summary>Have an access password?</summary>
    <form class="enter" method="post" action="${GATE_PATH}">
      <input type="hidden" name="next" value="${escapeHtml(next)}" />
      <input name="password" type="password" autocomplete="current-password" required aria-label="Password" placeholder="Password"
        ${wrongPassword ? 'aria-invalid="true" aria-describedby="error"' : ''} />
      <button type="submit">Enter</button>
    </form>
    ${wrongPassword ? '<p class="error" id="error" role="alert">That password isn’t right. Please try again.</p>' : ''}
  </details>
</main>
<footer>Questions or orders? Message us on <a href="https://wa.me/96176052068">WhatsApp</a>
  or Instagram <a href="https://instagram.com/siaram.jewelry">@siaram.jewelry</a>.</footer>
<script>
  const form = document.querySelector('.notify');
  const msg = document.querySelector('.msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.elements.email;
    msg.className = 'msg';
    if (!email.value.trim() || !email.checkValidity()) {
      msg.textContent = 'Please enter a valid email address.'; msg.className = 'msg err'; email.focus(); return;
    }
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const res = await fetch('${SUBSCRIBE_URL}', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.value.trim(), source: 'coming-soon', website: form.elements.website.value }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Sorry, something went wrong. Please try again.');
      msg.textContent = data.status === 'already' ? "You're already on our list. Thank you!"
        : "Thank you! You're on the list. We've sent you a welcome email.";
      form.reset();
    } catch (err) {
      msg.textContent = err.message; msg.className = 'msg err';
    } finally {
      button.disabled = false;
    }
  });
</script>
</body>
</html>`;
  return new Response(html, {
    // 503 + Retry-After tells Google the site is briefly closed, so it keeps your search ranking.
    status: wrongPassword ? 401 : 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '3600',
      'X-Robots-Tag': 'noindex',
    },
  });
}
