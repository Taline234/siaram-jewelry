// POST /api/place-order — validates and saves an order, then emails the shop and the customer.
import {
  CustomerError, configured, emailLayout, escapeHtml, json, orderSummaryHtml, readJson,
  paymentInstructionsHtml, rpc, sendEmail, userFromRequest,
} from '../lib/store.mjs';

const FIELDS = ['customer_name', 'email', 'phone', 'fulfilment', 'payment_method', 'governorate', 'city', 'street', 'building', 'floor', 'notes', 'voucher_code'];

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Online ordering is not available yet.' }, 503);

  try {
    const body = await readJson(req);
    if (body.website) return json({ error: 'Invalid request.' }, 400); // spam trap field

    const order = { items: [], age_confirmed: body.age_confirmed === true };
    for (const field of FIELDS) order[field] = String(body[field] ?? '').slice(0, 300);
    order.fulfilment = order.fulfilment === 'collection' ? 'collection' : 'delivery';
    order.payment_method = order.payment_method === 'cash' ? 'cash' : 'whish';
    order.items = (Array.isArray(body.items) ? body.items : []).slice(0, 20).map((i) => ({
      slug: String(i?.slug ?? '').slice(0, 80),
      quantity: Number.parseInt(i?.quantity, 10) || 0,
    }));

    // Account holders proved they are 18+ when they signed up.
    const user = await userFromRequest(req);
    if (user) order.age_confirmed = true;

    const saved = await rpc('place_order', { p: order, p_user_id: user ? user.id : null });

    const notify = process.env.ORDER_NOTIFY_EMAIL;
    await Promise.all([
      sendEmail({
        to: saved.email,
        subject: `Your Siaram order ${saved.reference}`,
        html: emailLayout(`Thank you, ${saved.customer_name.split(' ')[0]}!`,
          `<p style="font-size:15px;line-height:1.6">We have received your order <strong>${escapeHtml(saved.reference)}</strong>.</p>
           ${paymentInstructionsHtml(saved)}${orderSummaryHtml(saved)}`),
      }),
      sendEmail({
        to: notify,
        replyTo: saved.email,
        subject: `New order ${saved.reference} — $${Number(saved.total).toFixed(2)} ${saved.payment_method === 'cash' ? 'cash' : 'Whish'} (${saved.customer_name})`,
        html: emailLayout(`New order ${saved.reference}`,
          `<p style="font-size:15px;line-height:1.6">${saved.payment_method === 'cash'
            ? `Payment: cash ${saved.fulfilment === 'collection' ? 'at collection' : 'on delivery'}. Status: being prepared`
            : 'Status: awaiting Whish payment'}${user ? ' — placed from a customer account' : ' — guest order'}.</p>
           ${orderSummaryHtml(saved, { sku: true })}`),
      }),
    ]);

    return json({ order: saved });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Sorry, something went wrong placing your order. Please try again or contact us.' }, 500);
  }
};

export const config = { path: '/api/place-order' };
