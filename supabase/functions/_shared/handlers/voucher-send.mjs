// POST /functions/v1/voucher-send — called by the database when a gift voucher order is marked paid (voucher_paid_email
// trigger in schema.sql) with {request_id}, and every morning by the daily job with {due: true} for vouchers whose send
// date has come. Emails the voucher (code, value, expiry, how to use it) once per order. Only the database knows the
// secret it must send.
import { configured, emailLayout, env, escapeHtml, json, money, readJson, rpc, sendEmail } from '../store.mjs';

const longDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Beirut' });

function voucherCard(v) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #c9a96e;background:#1b3a2b">
<tr><td align="center" style="padding:28px 20px;color:#f3ede2">
  <div style="font-size:12px;letter-spacing:3px;color:#c9a96e">SIARAM GIFT VOUCHER</div>
  <div style="font-size:40px;margin:12px 0 6px">${money(v.amount)}</div>
  <div style="font-size:14px">for ${escapeHtml(v.recipient_name)}, from ${escapeHtml(v.name)}</div>
  <div style="font-family:'Courier New',monospace;font-size:22px;letter-spacing:2px;background:#f3ede2;color:#1b3a2b;
              display:inline-block;padding:10px 18px;margin:18px 0 8px">${escapeHtml(v.voucher_code)}</div>
  <div style="font-size:13px;color:#d9cfbd">Valid until ${longDate(v.expires_at)}</div>
</td></tr></table>`;
}

const howTo = (site) => `<p style="font-size:15px;line-height:1.6"><strong>How to use it:</strong> choose your piece on
  <a href="${site}" style="color:#1b3a2b">siaramjewelry.com</a> and enter the code at checkout, with the email address or
  WhatsApp number this voucher was issued to. You can also use it by message or in person. Any remaining value stays on
  the voucher until it expires. Vouchers cover jewellery, not delivery.</p>`;

async function sendOne(id) {
  const v = await rpc('claim_voucher_email', { p_id: id });
  if (!v) return { id, sent: false, reason: 'not paid, already sent or not due yet' };
  const site = env('SITE_URL') || 'https://siaramjewelry.com';
  const toRecipient = v.send_to === 'recipient' && v.recipient_email;
  const first = (name) => String(name).split(' ')[0];
  const voucherEmail = toRecipient
    ? {
      to: v.recipient_email,
      subject: `${v.name} sent you a Siaram gift voucher`,
      html: emailLayout(`A gift for you, ${first(v.recipient_name)}`,
        `<p style="font-size:15px;line-height:1.6">${escapeHtml(v.name)} has sent you a Siaram Jewelry gift voucher, so you can
         choose a piece you love.</p>${voucherCard(v)}${howTo(site)}`),
    }
    : {
      to: v.email,
      subject: `Your Siaram gift voucher for ${v.recipient_name}`,
      html: emailLayout(`Here is your gift voucher, ${first(v.name)}`,
        `<p style="font-size:15px;line-height:1.6">Thank you for your order ${escapeHtml(v.reference)}. Here is the voucher for
         ${escapeHtml(v.recipient_name)}, ready for you to give${v.send_to === 'recipient' ? ' (we only had their WhatsApp number, so please pass it on)' : ''}.
         Only ${escapeHtml(v.recipient_name)} can use it.</p>${voucherCard(v)}${howTo(site)}`),
    };
  const sent = await sendEmail(voucherEmail);
  if (!sent) {
    await rpc('claim_voucher_email', { p_id: id, p_release: true });
    return { id, sent: false, reason: 'email failed' };
  }
  const notes = [sendEmail({
    to: env('ORDER_NOTIFY_EMAIL'),
    subject: `Gift voucher ${v.voucher_code} sent (${v.reference})`,
    html: emailLayout(`Gift voucher ${v.voucher_code} sent`,
      `<p style="font-size:15px;line-height:1.6">The ${money(v.amount)} voucher for ${escapeHtml(v.recipient_name)}
       (order ${escapeHtml(v.reference)}, bought by ${escapeHtml(v.name)}) was emailed to ${escapeHtml(voucherEmail.to)}.</p>`),
  })];
  if (toRecipient) {
    notes.push(sendEmail({
      to: v.email,
      subject: `Your gift voucher for ${v.recipient_name} has been sent`,
      html: emailLayout(`Your gift has been sent, ${first(v.name)}`,
        `<p style="font-size:15px;line-height:1.6">We have emailed your ${money(v.amount)} Siaram gift voucher to
         ${escapeHtml(v.recipient_name)} (${escapeHtml(v.recipient_email)}). It is valid until ${longDate(v.expires_at)}.
         Thank you for your order ${escapeHtml(v.reference)}.</p>`),
    }));
  }
  await Promise.all(notes);
  return { id, sent: true, code: v.voucher_code };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Not set up.' }, 503);
  const secret = req.headers.get('x-cron-secret') || '';
  if (!secret || !(await rpc('cron_secret_ok', { p_secret: secret }))) return json({ error: 'Not allowed.' }, 403);

  const body = await readJson(req, 2000);
  const ids = body.due ? (await rpc('vouchers_due', {})) || [] : [body.request_id].filter(Boolean);
  if (!ids.length) return json({ results: [] });
  const results = [];
  for (const id of ids) results.push(await sendOne(typeof id === 'object' ? Object.values(id)[0] : id));
  return json({ results }, results.some((r) => r.reason === 'email failed') ? 502 : 200);
};
