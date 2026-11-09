// POST /functions/v1/courier-cancel — called by the database when a booked order is set to 'cancelled'
// (see the order_cancelled_courier trigger in schema.sql). Cancels the delivery with Wakilni; if Wakilni no longer
// allows it (a driver already has it), you are emailed to cancel it with them directly.
import { configured, emailLayout, env, escapeHtml, json, readJson, rpc, sendEmail } from '../store.mjs';
import { cancelDelivery, wakilniConfigured } from '../wakilni.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Not set up.' }, 503);
  const secret = req.headers.get('x-cron-secret') || '';
  if (!secret || !(await rpc('cron_secret_ok', { p_secret: secret }))) return json({ error: 'Not allowed.' }, 403);

  const { order_id: orderId } = await readJson(req, 2000);
  if (!orderId) return json({ error: 'Missing order.' }, 400);
  const order = await rpc('courier_cancel_details', { p_order_id: orderId });
  if (!order || order.status !== 'cancelled' || !order.courier_order_id) return json({ cancelled: false, reason: 'nothing to cancel' });

  try {
    if (!wakilniConfigured()) throw new Error('The WAKILNI_KEY and WAKILNI_SECRET secrets are not set in Supabase.');
    await cancelDelivery(order.courier_order_id, `Order ${order.reference} cancelled by Siaram Jewelry`);
    await rpc('courier_status_update', { p_order_id: orderId, p_code: 7, p_status: 'Canceled' });
    return json({ cancelled: true });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await sendEmail({
      to: env('ORDER_NOTIFY_EMAIL'),
      subject: `Cancel ${order.reference} with Wakilni`,
      html: emailLayout(`Please cancel ${order.reference} with Wakilni`,
        `<p style="font-size:15px;line-height:1.6">Order <strong>${escapeHtml(order.reference)}</strong> is cancelled on the website,
         but Wakilni did not accept the cancellation.</p>
         <p style="font-size:15px;line-height:1.6"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
         <p style="font-size:15px;line-height:1.6">Cancel it in the Wakilni portal, or ask on your Wakilni WhatsApp group.</p>`),
    });
    return json({ cancelled: false, reason }, 502);
  }
};
