// POST /functions/v1/record-sale — the Record a Sale tab on the account page. Only the shop owner may use it.
// Records an in-person, Instagram, WhatsApp or event sale as an order (same S numbers as website orders): pieces
// taken from stock come off it, a gift voucher used in payment is charged, and the sale appears in the workbook
// download with its sales channel. No emails are sent.
import { CustomerError, configured, isOwner, json, readJson, rpc, userFromRequest } from '../store.mjs';

const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'The store is not set up yet.' }, 503);
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Please sign in again.' }, 401);
    if (!isOwner(user)) return json({ error: 'Only the shop owner can record sales.' }, 403);

    const body = await readJson(req, 20000);
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const sale = {
      sale_date: /^\d{4}-\d{2}-\d{2}$/.test(text(body.sale_date)) ? text(body.sale_date) : '',
      channel: text(body.channel, 40),
      customer_name: text(body.customer_name),
      phone: text(body.phone, 40),
      email: text(body.email),
      notes: text(body.notes, 1000),
      payment_method: text(body.payment_method, 20),
      voucher_code: text(body.voucher_code, 40),
      items: items.map((i) => ({
        slug: text(i.slug, 80), metal: text(i.metal, 10), size: text(i.size, 20), quantity: Number(i.quantity),
        unit_price: i.unit_price === '' || i.unit_price == null ? null : Number(i.unit_price), from_stock: i.from_stock !== false,
      })),
    };
    if (sale.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sale.email)) throw new CustomerError('Please check the email address.');
    if (sale.items.some((i) => i.unit_price != null && !(i.unit_price >= 0))) throw new CustomerError('Please check the prices.');
    const order = await rpc('record_sale', { p: sale });
    return json({ reference: order.reference, total: order.total, status: order.status });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Could not record the sale right now.' }, 500);
  }
};
