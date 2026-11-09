// POST /functions/v1/courier-book — called by the database when an order's status becomes 'ready'
// (see the order_ready trigger in schema.sql). Books the delivery with Wakilni as cash on delivery, saves the
// tracking number, and emails you the result (with the parcel label when Wakilni sends one).
import { Buffer } from 'node:buffer';
import { configured, emailLayout, env, escapeHtml, json, money, readJson, rpc, sendEmail } from '../store.mjs';
import { bookDelivery, collectionAmount, wakilniConfigured } from '../wakilni.mjs';

const notify = (subject, title, body, attachments) =>
  sendEmail({ to: env('ORDER_NOTIFY_EMAIL'), subject, html: emailLayout(title, body), attachments });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Not set up.' }, 503);
  const secret = req.headers.get('x-cron-secret') || '';
  if (!secret || !(await rpc('cron_secret_ok', { p_secret: secret }))) return json({ error: 'Not allowed.' }, 403);

  const { order_id: orderId } = await readJson(req, 2000);
  if (!orderId) return json({ error: 'Missing order.' }, 400);
  if (!(await rpc('claim_courier_booking', { p_order_id: orderId }))) {
    return json({ booked: false, reason: 'already booked, not ready, or a collection' });
  }
  const order = await rpc('courier_booking_details', { p_order_id: orderId });

  let booking;
  try {
    if (!wakilniConfigured()) throw new Error('The WAKILNI_KEY and WAKILNI_SECRET secrets are not set in Supabase.');
    booking = await bookDelivery(order);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await rpc('record_courier_booking', { p_order_id: orderId, p_courier_order_id: null, p_tracking: null, p_url: null,
                                          p_error: reason });
    await notify(`Wakilni booking failed for ${order.reference}`, `Order ${order.reference} was not booked`,
      `<p style="font-size:15px;line-height:1.6">Wakilni did not accept the delivery for order
       <strong>${escapeHtml(order.reference)}</strong>.</p>
       <p style="font-size:15px;line-height:1.6"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
       <p style="font-size:15px;line-height:1.6">Fix the address in <strong>Table Editor &rarr; orders</strong> if needed
       (the area is the <strong>city</strong> column), then set the status to <strong>preparing</strong> and back to
       <strong>ready</strong> to try again. Or book it yourself in the Wakilni portal and type the tracking number in
       <strong>tracking_number</strong>.</p>`);
    return json({ booked: false, reason }, 502);
  }

  await rpc('record_courier_booking', { p_order_id: orderId, p_courier_order_id: booking.id,
                                        p_tracking: booking.trackingId, p_url: booking.trackingUrl });
  const label = booking.label
    ? [{ filename: `wakilni-label-${order.reference}.png`, content: Buffer.from(booking.label, 'base64') }] : [];
  await notify(`Wakilni booked for ${order.reference}`, `Order ${order.reference} is booked with Wakilni`,
    `<p style="font-size:15px;line-height:1.6">Wakilni will pick up the parcel for <strong>${escapeHtml(order.reference)}</strong>
     and collect <strong>${money(collectionAmount(order))}</strong> in cash on delivery.</p>
     ${booking.trackingId ? `<p style="font-size:15px;line-height:1.6">Tracking number: <strong>${escapeHtml(booking.trackingId)}</strong>
       ${booking.trackingUrl ? ` &middot; <a href="${escapeHtml(booking.trackingUrl)}">track it</a>` : ''}</p>` : ''}
     <p style="font-size:15px;line-height:1.6">${label.length ? 'The parcel label is attached: print it and stick it on the box. ' : ''}
     Write <strong>${escapeHtml(order.reference)}</strong> on the parcel. The order is now <strong>dispatched</strong>, and
     the customer has been emailed that it is on its way, with the link to track it.</p>`, label);
  return json({ booked: true, tracking_id: booking.trackingId });
};
