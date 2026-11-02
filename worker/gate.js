// Private-access gate for siaramjewelry.com.
//
// OFF by default: the website is served exactly as before. To close the site while you make big
// changes, add a secret called SITE_PASSWORD in Cloudflare (Workers & Pages -> siaram-jewelry ->
// Settings -> Variables and Secrets). Visitors then see a branded "Private access" page and need
// that password to get in. Delete the secret to open the site again. Changing the password signs
// everyone out. How-to with screenshots of the steps: STORE-SETUP.md, "Closing the site while you edit".

const COOKIE = 'sj_access';
const GATE_PATH = '/__private-access';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

// Files the gate page itself needs, so they load before anyone has signed in.
const ALWAYS_OPEN = new Set(['/images/logo-transparent.png', '/images/logo.jpeg', '/favicon.ico']);

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
<title>Private access | Siaram Jewelry</title>
<link rel="icon" href="/images/logo.jpeg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
<style>
  :root { --green: #1b3a2b; --green-mid: #2b4f3b; --cream: #faf7f1; --gold: #b99a5b; --ink: #2a2a24; --line: rgba(27,58,43,.22); }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         padding: 48px 16px; background: var(--cream); color: var(--ink); font-family: 'Jost', sans-serif;
         -webkit-font-smoothing: antialiased; }
  main { width: 100%; max-width: 380px; text-align: center; }
  .logo { width: 240px; max-width: 80%; height: auto; margin: 0 auto 40px; display: block; }
  .lock { width: 26px; height: 26px; color: var(--gold); margin-bottom: 14px; }
  h1 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 2.1rem; color: var(--green);
       margin: 0 0 10px; letter-spacing: .01em; }
  p.lede { margin: 0 0 32px; font-weight: 300; font-size: .95rem; line-height: 1.6; color: #5a5a50; }
  form { text-align: left; }
  label { display: block; font-size: .72rem; letter-spacing: .22em; text-transform: uppercase; color: var(--green);
          margin-bottom: 8px; font-weight: 500; }
  input[type=password] { width: 100%; padding: 14px 16px; font: inherit; font-size: 1rem; color: var(--ink);
          background: #fffdf9; border: 1px solid var(--line); border-radius: 0; outline: none; }
  input[type=password]:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(27,58,43,.12); }
  button { width: 100%; margin-top: 16px; padding: 15px; font: inherit; font-size: .78rem; letter-spacing: .24em;
           text-transform: uppercase; font-weight: 500; color: #fff; background: var(--green); border: 0;
           cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
  button:hover { background: var(--green-mid); }
  .error { margin: 12px 0 0; font-size: .88rem; color: #8a2f2f; }
  footer { margin-top: 48px; font-size: .78rem; font-weight: 300; color: #7a7a70; }
  footer a { color: var(--green); }
</style>
</head>
<body>
<main>
  <img class="logo" src="/images/logo-transparent.png" alt="Siaram Jewelry" width="427" height="140" />
  <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="10" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.1"/>
  </svg>
  <h1>Private access</h1>
  <p class="lede">We are refreshing the boutique and will be back very soon.</p>
  <form method="post" action="${GATE_PATH}">
    <input type="hidden" name="next" value="${escapeHtml(next)}" />
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus
      ${wrongPassword ? 'aria-invalid="true" aria-describedby="error"' : ''} />
    ${wrongPassword ? '<p class="error" id="error" role="alert">That password isn’t right. Please try again.</p>' : ''}
    <button type="submit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>
      Enter
    </button>
  </form>
  <footer>Questions about an order? Message us on <a href="https://wa.me/96176052068">WhatsApp</a>
    or Instagram <a href="https://instagram.com/siaram.jewelry">@siaram.jewelry</a>.</footer>
</main>
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
