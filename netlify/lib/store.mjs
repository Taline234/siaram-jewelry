// Shared helpers for the store's Netlify functions.
// Talks to Supabase and Resend over plain HTTPS, so no npm packages are needed.
//
// Environment variables (Netlify -> Site configuration -> Environment variables):
//   SUPABASE_URL               https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  Supabase -> Project Settings -> API keys -> service_role (keep secret)
//   RESEND_API_KEY             Resend -> API Keys
//   STORE_EMAIL_FROM           e.g. Siaram Jewelry <orders@siaramjewelry.com>
//   ORDER_NOTIFY_EMAIL         where new orders are sent, e.g. customerservice@siaramjewelry.com
//   SITE_URL                   https://siaramjewelry.com

const env = (name) => process.env[name] || '';

export class CustomerError extends Error {}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function configured() {
  return Boolean(env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'));
}

// Works with both the legacy service_role key (a JWT, also sent as a Bearer token)
// and the newer sb_secret_ keys (sent only as apikey).
function serviceHeaders() {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, 'content-type': 'application/json' };
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;
  return headers;
}

// Calls a database function. Errors raised on purpose in the database (code P0001)
// carry a message meant for the customer; anything else is reported generically.
export async function rpc(name, args) {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (body && body.code === 'P0001') throw new CustomerError(body.message);
    console.error(`rpc ${name} failed`, res.status, body);
    throw new Error(`Database call ${name} failed`);
  }
  return body;
}

// Returns the signed-in customer for a request, or null for guests.
export async function userFromRequest(req) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), authorization: auth },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteUser(userId) {
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
  });
  if (!res.ok) throw new Error(`Deleting user ${userId} failed: ${res.status} ${await res.text()}`);
}

export async function readJson(req, maxBytes = 20000) {
  const text = await req.text();
  if (text.length > maxBytes) throw new CustomerError('Request too large.');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new CustomerError('Invalid request.');
  }
}

// ---------------------------------------------------------------- email
export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const money = (value) => `$${Number(value || 0).toFixed(2)}`;

export function emailLayout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f3ede2;font-family:Georgia,serif;color:#2a2a24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:1px solid #e3dccd">
<tr><td style="background:#1b3a2b;color:#f3ede2;padding:22px 28px;font-size:20px;letter-spacing:1px">Siaram Jewelry</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:22px;font-weight:normal;color:#1b3a2b;margin:0 0 18px">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:28px 0 0;font-size:13px;color:#6b6b5f">Questions? Reply to this email or WhatsApp us on +961 76 052 068.</p>
</td></tr></table></td></tr></table></body></html>`;
}

// attachments: [{ filename, content }] with content as bytes.
export async function sendEmail({ to, subject, html, replyTo, attachments }) {
  if (!env('RESEND_API_KEY') || !to) {
    console.warn('Email not sent (RESEND_API_KEY or recipient missing):', subject);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env('STORE_EMAIL_FROM') || 'Siaram Jewelry <orders@siaramjewelry.com>',
      to: [to],
      subject,
      html,
      reply_to: replyTo || env('ORDER_NOTIFY_EMAIL') || undefined,
      attachments: attachments?.length
        ? attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') }))
        : undefined,
    }),
  });
  if (!res.ok) {
    console.error('Email failed', subject, res.status, await res.text());
    return false;
  }
  return true;
}

// What the customer pays and how, for the line under the items.
export function payLabel(order) {
  return order.fulfilment === 'collection' ? 'To pay in cash at collection' : 'To pay in cash on delivery';
}

// Metal and size under each piece.
const METALS = { yellow: '18k yellow gold', rose: '18k rose gold', white: '18k white gold' };
function itemOptions(i) {
  const parts = [METALS[i.metal] || METALS.yellow];
  if (i.size) parts.push(i.size);
  return `<br><span style="font-size:13px;color:#6b665a">${parts.map(escapeHtml).join(' &middot; ')}</span>`;
}

// For the shop's email: one row per piece, in the order of the blue columns on the finance
// workbook's Sales tab, so each order can be typed (or pasted cell by cell) straight in.
// Website orders are cash. Cash Received Now stays 0 until the money arrives.
export function financeRowsHtml(order, today = new Date()) {
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', day: '2-digit', month: '2-digit', year: 'numeric' }).format(today);
  const method = 'Cash';
  const head = ['Invoice #', 'Sale Date', 'Customer', 'Sales Channel', 'SKU', 'Qty', 'Agreed Unit Price', 'Payment Method',
    'Cash Received Now', 'Gift Voucher Code', 'Paid by Voucher ($)'];
  const cell = 'padding:4px 8px;border:1px solid #d9d2c3;font-size:12px;white-space:nowrap';
  const rows = (order.items || []).map((i, n) => [
    order.reference, date, order.customer_name, 'Website', i.sku || '', i.quantity, Number(i.unit_price).toFixed(2), method, '0',
    n === 0 && Number(order.voucher_amount) > 0 ? order.voucher_code : '',
    n === 0 && Number(order.voucher_amount) > 0 ? Number(order.voucher_amount).toFixed(2) : '',
  ]);
  const tr = (cells, tag) => `<tr>${cells.map((c) => `<${tag} style="${cell}">${escapeHtml(String(c))}</${tag}>`).join('')}</tr>`;
  return `<h3 style="font-size:15px;margin:24px 0 6px">For your finance workbook (Sales tab)</h3>
    <p style="font-size:13px;line-height:1.5;margin:0 0 8px">One row per piece, same invoice # on each. Add the customer on the Customers tab first if they are new.
    When the money arrives, type it in Cash Received Now.</p>
    <table style="border-collapse:collapse">${tr(head, 'th')}${rows.map((r) => tr(r, 'td')).join('')}</table>`;
}

// The shop's copy also shows each piece's SKU, to match the finance workbook.
export function orderSummaryHtml(order, { sku = false } = {}) {
  const rows = (order.items || [])
    .map((i) => `<tr><td style="padding:6px 0">${sku && i.sku ? `${escapeHtml(i.sku)} &middot; ` : ''}${escapeHtml(i.name)} &times; ${i.quantity}${itemOptions(i)}</td>
      <td align="right" style="padding:6px 0">${money(i.unit_price * i.quantity)}</td></tr>`)
    .join('');
  const collection = order.fulfilment === 'collection';
  const delivery = collection ? 'Collection by appointment (free)'
    : order.delivery_fee === null || order.delivery_fee === undefined
      ? 'Confirmed before dispatch, paid to the courier in cash'
      : `${money(order.delivery_fee)}, paid to the courier in cash`;
  const voucher = Number(order.voucher_amount) > 0
    ? `<tr><td style="padding:6px 0">Gift voucher ${escapeHtml(order.voucher_code)}</td>
       <td align="right" style="padding:6px 0">&minus;${money(order.voucher_amount)}</td></tr>` : '';
  const address = [order.street, order.building && `Building ${order.building}`, order.floor && `Floor ${order.floor}`,
    order.city, order.governorate].filter(Boolean).map(escapeHtml).join(', ');
  return `<table role="presentation" width="100%" style="font-size:15px;border-top:1px solid #e3dccd;border-bottom:1px solid #e3dccd;margin:8px 0 18px">
${rows}
<tr><td style="padding:6px 0;border-top:1px solid #e3dccd">Subtotal</td><td align="right" style="padding:6px 0;border-top:1px solid #e3dccd">${money(order.subtotal)}</td></tr>
${voucher}
<tr><td style="padding:8px 0;font-weight:bold">${payLabel(order)}</td><td align="right" style="padding:8px 0;font-weight:bold">${money(order.total)}</td></tr>
<tr><td style="padding:6px 0;color:#6b6b5f">${collection ? 'Collection' : 'Delivery'}</td><td align="right" style="padding:6px 0;color:#6b6b5f">${delivery}</td></tr>
</table>
<p style="font-size:15px;line-height:1.6;margin:0 0 6px">${collection
    ? `<strong>Collection by appointment:</strong> ${escapeHtml(order.customer_name)}. We will message you to arrange a time.`
    : `<strong>Deliver to:</strong> ${escapeHtml(order.customer_name)}, ${address}`}</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 6px"><strong>Phone:</strong> ${escapeHtml(order.phone)} &nbsp; <strong>Email:</strong> ${escapeHtml(order.email)}</p>
${order.notes ? `<p style="font-size:15px;line-height:1.6;margin:0"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}`;
}

export function paymentInstructionsHtml(order) {
  if (Number(order.total) <= 0) {
    return '<p style="font-size:15px;line-height:1.6">Your gift voucher covers this order, so there is nothing to pay.</p>';
  }
  return order.fulfilment === 'collection'
    ? `<p style="font-size:15px;line-height:1.6">You will pay <strong>${money(order.total)}</strong> in cash when you collect your order.
We will contact you to confirm your order and arrange a time.</p>`
    : `<p style="font-size:15px;line-height:1.6">You will pay <strong>${money(order.total)}</strong> in cash to the driver
when your order arrives, plus the delivery fee. We will email you when your order ships.</p>`;
}
