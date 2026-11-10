// POST /functions/v1/voucher-request — the gift voucher order form (gift-voucher.html). Saves the order with a VR number
// and emails the shop and the buyer. Payment is arranged by WhatsApp for now; when the owner marks the order paid, the
// database creates the voucher and voucher-send emails it.
import { configured, contactMethod, CustomerError, emailLayout, env, escapeHtml, json, replyBy, rpc, sendEmail } from '../store.mjs';

const text = (body, name, max = 200) => String(body?.[name] ?? '').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Gift voucher orders are not available yet. Please email us instead.' }, 503);
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      throw new CustomerError('Your order could not be read. Please try again.');
    }
    if (text(body, 'website')) return json({ error: 'Invalid request.' }, 400); // spam trap

    const amount = Number(text(body, 'amount', 10));
    const order = {
      amount,
      recipient_name: text(body, 'recipient_name'),
      recipient_email: text(body, 'recipient_email'),
      recipient_phone: text(body, 'recipient_phone', 40),
      send_to: 'recipient', // vouchers are always sent straight to the recipient
      send_on: /^\d{4}-\d{2}-\d{2}$/.test(text(body, 'send_on')) ? text(body, 'send_on') : '',
      name: text(body, 'name'),
      email: text(body, 'email'),
      phone: text(body, 'phone', 40),
      preferred_contact: contactMethod(text(body, 'preferred_contact', 20)),
      message: text(body, 'message', 400),
    };
    if (!Number.isInteger(amount) || amount < 100 || amount > 100000) {
      throw new CustomerError('Please choose an amount of $100 or more, in whole dollars.');
    }
    if (!order.recipient_name) throw new CustomerError("Please enter the recipient's name.");
    if (!order.recipient_email && !order.recipient_phone) {
      throw new CustomerError("Please add the recipient's email or WhatsApp number, so that only they can use the voucher.");
    }
    if (!order.name || !order.phone) throw new CustomerError('Please enter your name and phone number.');
    if (!order.preferred_contact) throw new CustomerError('Please choose how you would like us to contact you.');
    if (body.final_sale !== true) {
      throw new CustomerError('Please confirm that you understand gift vouchers are final sale.');
    }

    const { reference } = await rpc('save_voucher_request', { p: order });

    const sendTo = order.recipient_email ? `${order.recipient_name}, by email` : `${order.recipient_name}, on WhatsApp`;
    // Payment is arranged on WhatsApp unless the buyer chose another way.
    const contactBy = order.preferred_contact && order.preferred_contact !== 'WhatsApp' ? replyBy(order.preferred_contact) : 'WhatsApp';
    const rows = [
      ['Amount', `$${amount}`], ['Recipient', order.recipient_name], ["Recipient's email", order.recipient_email || '—'],
      ["Recipient's WhatsApp", order.recipient_phone || '—'], ['Send the voucher to', sendTo],
      ['Send on', order.send_on || 'As soon as it is paid'], ['Personal message', order.message || '—'],
    ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b665a">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`).join('');
    const details = `<table role="presentation" style="font-size:15px;margin:8px 0 14px">${rows}</table>`;
    await Promise.all([
      sendEmail({
        to: env('ORDER_NOTIFY_EMAIL'),
        replyTo: order.email,
        subject: `Gift voucher order ${reference} — $${amount} (${order.name})`,
        html: emailLayout(`Gift voucher order ${reference}`,
          `<p style="font-size:15px;line-height:1.6"><strong>${escapeHtml(order.name)}</strong> &middot; ${escapeHtml(order.email)}
           &middot; Phone ${escapeHtml(order.phone)}<br><strong>Preferred contact: ${escapeHtml(order.preferred_contact)}</strong></p>${details}
           <p style="font-size:14px;line-height:1.6">1. Send the buyer a Whish payment link (by ${escapeHtml(contactBy)}).<br>
           2. Once paid, open Supabase, then Table Editor, then <strong>voucher_requests</strong>, and change ${escapeHtml(reference)}'s
           status from <strong>new</strong> to <strong>paid</strong>.<br>
           3. That's all: the voucher code is created and sent to the recipient${order.send_on ? ` on ${escapeHtml(order.send_on)}` : ''}
           (by email automatically; if we only have their WhatsApp, you get the voucher to send them).</p>`),
      }),
      sendEmail({
        to: order.email,
        subject: `Your gift voucher request ${reference}`,
        html: emailLayout(`Thank you, ${order.name.split(' ')[0]}!`,
          `<p style="font-size:15px;line-height:1.6">We have received your request for a <strong>$${amount}</strong> Siaram gift voucher
           (reference <strong>${escapeHtml(reference)}</strong>). We will contact you by ${escapeHtml(contactBy)} to arrange payment by
           Whish payment link. Once it is paid, we issue the voucher and send it to ${escapeHtml(order.recipient_name)}. It is valid
           for six months.</p>${details}
           <p style="font-size:14px;line-height:1.6;color:#6b665a">Gift vouchers are final sale: once issued, they cannot be cancelled,
           refunded or exchanged for cash.</p>`),
      }),
    ]);
    return json({ reference, contact_by: contactBy });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Sorry, your order could not be sent. Please try again or email us.' }, 500);
  }
};
