// POST /functions/v1/courier-sync — called every hour by the database (see supabase/cron.sql).
// Reads Wakilni's status for every booked order still on its way: when the driver has the parcel the order becomes
// 'dispatched' (which emails the customer), then 'delivered'. Problems (cancelled, failed, refused) are emailed to you.
import { configured, emailLayout, env, escapeHtml, json, rpc, sendEmail } from '../store.mjs';
import { deliveryStatus, wakilniConfigured, wakilniToken } from '../wakilni.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Not set up.' }, 503);
  const secret = req.headers.get('x-cron-secret') || '';
  if (!secret || !(await rpc('cron_secret_ok', { p_secret: secret }))) return json({ error: 'Not allowed.' }, 403);

  const open = await rpc('courier_orders_open', {});
  if (!open.length) return json({ checked: 0 });
  if (!wakilniConfigured()) return json({ error: 'Wakilni secrets not set.' }, 503);

  const token = await wakilniToken();
  const results = [];
  for (const order of open) {
    try {
      const latest = await deliveryStatus(token, order.courier_order_id);
      if (!latest) { results.push({ reference: order.reference, status: null }); continue; }
      const change = await rpc('courier_status_update', { p_order_id: order.id, p_code: latest.code, p_status: latest.status });
      results.push({ reference: order.reference, status: latest.status, order_status: change.order_status });
      if (change.changed && change.problem) {
        await sendEmail({
          to: env('ORDER_NOTIFY_EMAIL'),
          subject: `Wakilni: ${latest.status} for ${order.reference}`,
          html: emailLayout(`Delivery problem for ${order.reference}`,
            `<p style="font-size:15px;line-height:1.6">Wakilni now shows <strong>${escapeHtml(latest.status)}</strong> for order
             <strong>${escapeHtml(order.reference)}</strong>. Check the order in the Wakilni portal or on your WhatsApp group
             with them, and contact the customer if needed.</p>`),
        });
      }
    } catch (err) {
      console.error('courier-sync', order.reference, err);
      results.push({ reference: order.reference, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return json({ checked: open.length, results });
};
