// POST /api/place-order — validates and saves an order, then emails the shop and the customer.
import {
  CustomerError, configured, emailLayout, escapeHtml, financeRowsHtml, json, orderSummaryHtml, readJson,
  paymentInstructionsHtml, rpc, sendEmail, userFromRequest,
} from '../lib/store.mjs';
import { careWarrantyPdf, receiptPdf } from '../lib/documents.mjs';

const FIELDS = ['customer_name', 'email', 'phone', 'fulfilment', 'payment_method', 'governorate', 'city', 'street', 'building', 'floor', 'notes', 'voucher_code', 'submission_id'];

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Online ordering is not available yet.' }, 503);

  try {
    const body = await readJson(req);
    if (body.website) return json({ error: 'Invalid request.' }, 400); // spam trap field

    const order = { items: [], age_confirmed: body.age_confirmed === true, terms_accepted: body.terms_accepted === true };
    for (const field of FIELDS) order[field] = String(body[field] ?? '').slice(0, 300);
    order.fulfilment = order.fulfilment === 'collection' ? 'collection' : 'delivery';
    order.payment_method = 'cash'; // website orders are cash only
    order.items = (Array.isArray(body.items) ? body.items : []).slice(0, 20).map((i) => ({
      slug: String(i?.slug ?? '').slice(0, 80),
      quantity: Number.parseInt(i?.quantity, 10) || 0,
      metal: String(i?.metal ?? 'yellow').slice(0, 20),
      size: String(i?.size ?? '').slice(0, 30),
    }));

    // Account holders proved they are 18+ when they signed up.
    const user = await userFromRequest(req);
    if (user) order.age_confirmed = true;

    const saved = await rpc('place_order', { p: order, p_user_id: user ? user.id : null });
    // A repeated submission of the same checkout: the order and its emails already exist.
    if (saved.duplicate) return json({ order: saved });

    const notify = process.env.ORDER_NOTIFY_EMAIL;
    // The receipt and the care and warranty card, from the owner's Canva template. If they cannot be
    // drawn, the emails still go out without them: the order is already saved.
    let receipt = null;
    let care = null;
    try {
      [receipt, care] = await Promise.all([receiptPdf(saved), careWarrantyPdf(saved)]);
    } catch (err) {
      console.error('Order documents failed', saved.reference, err);
    }
    const receiptFile = receipt && { filename: `Siaram-receipt-${saved.reference}.pdf`, content: receipt };
    const careFile = care && { filename: `Siaram-care-and-warranty-${saved.reference}.pdf`, content: care };
    await Promise.all([
      sendEmail({
        to: saved.email,
        subject: `Your Siaram order ${saved.reference}`,
        html: emailLayout(`Thank you, ${saved.customer_name.split(' ')[0]}!`,
          `<p style="font-size:15px;line-height:1.6">We have received your order <strong>${escapeHtml(saved.reference)}</strong>.</p>
           ${paymentInstructionsHtml(saved)}${orderSummaryHtml(saved)}
           <p style="font-size:14px;line-height:1.6">Your receipt and your care and warranty card are attached.</p>`),
        attachments: [receiptFile, careFile].filter(Boolean),
      }),
      sendEmail({
        to: notify,
        replyTo: saved.email,
        subject: `New order ${saved.reference} — $${Number(saved.total).toFixed(2)} cash (${saved.customer_name})`,
        html: emailLayout(`New order ${saved.reference}`,
          `<p style="font-size:15px;line-height:1.6">Payment: cash ${saved.fulfilment === 'collection' ? 'at collection' : 'on delivery'}.
            Status: received — new order to prepare${user ? ' (placed from a customer account)' : ' (guest order)'}.</p>
           ${orderSummaryHtml(saved, { sku: true })}${financeRowsHtml(saved)}`),
        attachments: [receiptFile].filter(Boolean),
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
