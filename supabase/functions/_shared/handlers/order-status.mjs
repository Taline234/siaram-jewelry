// POST /functions/v1/order-status — called by the database when an order's status becomes 'dispatched'
// (see the order_dispatched trigger in schema.sql). Emails the customer that the order is on its way,
// once per order. Only the database knows the secret it must send.
import { configured, emailLayout, escapeHtml, json, money, orderSummaryHtml, readJson, rpc, sendEmail } from '../store.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Not set up.' }, 503);
  const secret = req.headers.get('x-cron-secret') || '';
  if (!secret || !(await rpc('cron_secret_ok', { p_secret: secret }))) return json({ error: 'Not allowed.' }, 403);

  const { order_id: orderId } = await readJson(req, 2000);
  if (!orderId) return json({ error: 'Missing order.' }, 400);
  if (!(await rpc('claim_dispatch_email', { p_order_id: orderId }))) return json({ sent: false, reason: 'already sent or not dispatched' });

  const order = await rpc('order_summary', { p_order_id: orderId });
  const toPay = Number(order.total) > 0
    ? `<p style="font-size:15px;line-height:1.6">Please have <strong>${money(order.total)}</strong> in cash ready for the driver,
       ${order.delivery_fee == null ? 'plus the delivery fee' : `plus the ${money(order.delivery_fee)} delivery fee`}.</p>`
    : `<p style="font-size:15px;line-height:1.6">Your gift voucher covers your jewellery${order.delivery_fee == null ? '; only the delivery fee is paid to the driver' : `; only the ${money(order.delivery_fee)} delivery fee is paid to the driver`}.</p>`;
  const tracking = order.tracking_number
    ? `<p style="font-size:15px;line-height:1.6">Wakilni tracking number: <strong>${escapeHtml(order.tracking_number)}</strong></p>` : '';
  const sent = await sendEmail({
    to: order.email,
    subject: `Your Siaram order ${order.reference} is on its way`,
    html: emailLayout(`Your order is on its way, ${order.customer_name.split(' ')[0]}!`,
      `<p style="font-size:15px;line-height:1.6">Your order <strong>${escapeHtml(order.reference)}</strong> has been handed to our
       courier, Wakilni, who will contact you to arrange delivery.</p>${tracking}${toPay}${orderSummaryHtml(order)}`),
  });
  if (!sent) {
    await rpc('claim_dispatch_email', { p_order_id: orderId, p_release: true });
    return json({ sent: false, reason: 'email failed' }, 502);
  }
  return json({ sent: true });
};
