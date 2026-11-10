// POST /functions/v1/voucher-send — called by the database when a gift voucher order is marked paid (voucher_paid_email
// trigger in schema.sql) with {request_id}, and every morning by the daily job with {due: true} for vouchers whose send
// date has come. Emails the voucher (code, value, expiry, how to use it) once per order. Only the database knows the
// secret it must send.
import { configured, emailLayout, env, escapeHtml, json, money, readJson, rpc, sendEmail } from '../store.mjs';
import { voucherPdf } from '../documents.mjs';

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
  // Vouchers go straight to the recipient: by email when we have their address; otherwise to their WhatsApp, which the
  // owner sends by hand (the voucher PDF comes to the shop's inbox with the number to send it to).
  // (Older requests could ask for the buyer instead; they keep that.)
  const toBuyer = v.send_to === 'purchaser';
  const byEmail = !toBuyer && Boolean(v.recipient_email);
  const byWhatsApp = !toBuyer && !v.recipient_email && Boolean(v.recipient_phone);
  const first = (name) => String(name).split(' ')[0];
  const recipientHtml = `<p style="font-size:15px;line-height:1.6">${escapeHtml(v.name)} has sent you a Siaram Jewelry gift voucher, so you can
         choose a piece you love.</p>${voucherCard(v)}${howTo(site)}`;
  const voucherEmail = byEmail
    ? { to: v.recipient_email, subject: `${v.name} sent you a Siaram gift voucher`,
        html: emailLayout(`A gift for you, ${first(v.recipient_name)}`, recipientHtml) }
    : byWhatsApp
      ? { to: env('ORDER_NOTIFY_EMAIL'), subject: `Send gift voucher ${v.voucher_code} on WhatsApp to ${v.recipient_name}`,
          html: emailLayout(`Send this voucher on WhatsApp`,
            `<p style="font-size:15px;line-height:1.6">Order ${escapeHtml(v.reference)} only has the recipient's WhatsApp number:
             <strong>${escapeHtml(v.recipient_phone)}</strong>. Please send ${escapeHtml(v.recipient_name)} the attached voucher
             card on WhatsApp today, with the code and how to use it (below). The buyer has been told it is on its way.</p>
             <hr style="border:0;border-top:1px solid #e3dccd;margin:18px 0">${recipientHtml}`) }
      : { to: v.email, subject: `Your Siaram gift voucher for ${v.recipient_name}`,
          html: emailLayout(`Here is your gift voucher, ${first(v.name)}`,
            `<p style="font-size:15px;line-height:1.6">Thank you for your order ${escapeHtml(v.reference)}. Here is the voucher for
             ${escapeHtml(v.recipient_name)}, ready for you to give. Only ${escapeHtml(v.recipient_name)} can use it.</p>${voucherCard(v)}${howTo(site)}`) };
  // The voucher on the owner's Canva card (with the personal message card, when there is one), as a PDF.
  try {
    voucherEmail.attachments = [{ filename: `Siaram-gift-voucher-${v.voucher_code}.pdf`, content: await voucherPdf(v) }];
  } catch (err) {
    console.error('voucher pdf', err);
  }
  const message = String(v.message || '').trim();
  if (message) {
    voucherEmail.html = voucherEmail.html.replace(voucherCard(v), `${voucherCard(v)}<p style="font-size:15px;line-height:1.6;font-style:italic;text-align:center;color:#1b3a2b">&ldquo;${escapeHtml(message)}&rdquo;<br>&mdash; ${escapeHtml(v.name)}</p>`);
  }
  voucherEmail.html = voucherEmail.html.replace(howTo(site), `${howTo(site)}<p style="font-size:14px;line-height:1.6;color:#6b665a">The voucher card is attached as a PDF${message ? ', with the personal message card' : ''}.</p>`);
  const sent = await sendEmail(voucherEmail);
  if (!sent) {
    await rpc('claim_voucher_email', { p_id: id, p_release: true });
    return { id, sent: false, reason: 'email failed' };
  }
  const notes = [];
  if (byEmail || toBuyer) {
    notes.push(sendEmail({
      to: env('ORDER_NOTIFY_EMAIL'),
      subject: `Gift voucher ${v.voucher_code} sent (${v.reference})`,
      html: emailLayout(`Gift voucher ${v.voucher_code} sent`,
        `<p style="font-size:15px;line-height:1.6">The ${money(v.amount)} voucher for ${escapeHtml(v.recipient_name)}
         (order ${escapeHtml(v.reference)}, bought by ${escapeHtml(v.name)}) was emailed to ${escapeHtml(voucherEmail.to)}.</p>`),
    }));
  }
  if (byEmail || byWhatsApp) {
    notes.push(sendEmail({
      to: v.email,
      subject: `Your gift voucher for ${v.recipient_name} has been sent`,
      html: emailLayout(`Your gift is on its way, ${first(v.name)}`,
        `<p style="font-size:15px;line-height:1.6">${byEmail
          ? `We have emailed your ${money(v.amount)} Siaram gift voucher to ${escapeHtml(v.recipient_name)} (${escapeHtml(v.recipient_email)}).`
          : `We are sending your ${money(v.amount)} Siaram gift voucher to ${escapeHtml(v.recipient_name)} on WhatsApp (${escapeHtml(v.recipient_phone)}).`}
         It is valid until ${longDate(v.expires_at)}. Thank you for your order ${escapeHtml(v.reference)}.</p>`),
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
