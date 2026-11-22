// /functions/v1/record-sale — the Record a Sale tab on the account page. Only the shop owner may use it.
//   POST                 records an in-person, Instagram, WhatsApp or event sale as an order (same S numbers as website
//                        orders): pieces taken from stock come off it, a gift voucher used in payment is charged, and the
//                        sale goes to the workbook with its sales channel. With send_receipt and an email address, the
//                        customer is emailed the receipt and the care and warranty card, as after a website order.
//   GET ?receipt=S019    the receipt PDF of any order, for the owner to send on WhatsApp.
import { CustomerError, configured, emailLayout, escapeHtml, isOwner, json, readJson, rpc, sendEmail, userFromRequest } from '../store.mjs';
import { careWarrantyPdf, receiptPdf } from '../documents.mjs';

const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);
// The day of the sale, at midday in Beirut, so the receipt shows that date (and the warranty runs from it).
const saleDay = (date) => (/^\d{4}-\d{2}-\d{2}$/.test(date || '') ? new Date(`${date}T10:00:00Z`) : new Date());

async function owner(req) {
  const user = await userFromRequest(req);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!isOwner(user)) return json({ error: 'Only the shop owner can record sales.' }, 403);
  return null;
}

async function receiptDownload(reference) {
  const order = await rpc('order_receipt', { p_reference: reference });
  if (!order) return json({ error: `No order ${reference}.` }, 404);
  const pdf = await receiptPdf(order, saleDay(order.sale_date));
  return new Response(pdf, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="Siaram-receipt-${order.reference}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}

// Emails the receipt and care card; true once sent. A failure here never undoes the recorded sale.
async function emailReceipt(order, date) {
  try {
    const when = saleDay(date);
    const [receipt, care] = await Promise.all([receiptPdf(order, when), careWarrantyPdf(order, when)]);
    return await sendEmail({
      to: order.email,
      subject: `Your Siaram receipt ${order.reference}`,
      html: emailLayout(`Thank you, ${order.customer_name.split(' ')[0]}!`,
        `<p style="font-size:15px;line-height:1.6">Thank you for choosing Siaram Jewelry. Your receipt
          <strong>${escapeHtml(order.reference)}</strong> and your care and warranty card are attached.</p>
         <p style="font-size:15px;line-height:1.6">Keep them safe: the care and warranty card explains how to look after
          your jewellery, and the receipt is needed for any repair under warranty.</p>`),
      attachments: [
        { filename: `Siaram-receipt-${order.reference}.pdf`, content: receipt },
        { filename: `Siaram-care-and-warranty-${order.reference}.pdf`, content: care },
      ],
    });
  } catch (err) {
    console.error('Receipt email failed', order.reference, err);
    return false;
  }
}

export default async (req) => {
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'The store is not set up yet.' }, 503);
  try {
    const refused = await owner(req);
    if (refused) return refused;

    if (req.method === 'GET') {
      const reference = text(new URL(req.url).searchParams.get('receipt'), 20).toUpperCase();
      if (!/^S\d{3,}$/.test(reference)) return json({ error: 'Please give an order number like S019.' }, 400);
      return await receiptDownload(reference);
    }

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
    const emailed = body.send_receipt === true && Boolean(order.email)
      && await emailReceipt({ ...order, channel: sale.channel }, sale.sale_date);
    return json({ reference: order.reference, total: order.total, status: order.status, receipt_emailed: emailed ? order.email : null });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: req.method === 'GET' ? 'Could not prepare the receipt right now.' : 'Could not record the sale right now.' }, 500);
  }
};
