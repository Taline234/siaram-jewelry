// POST /functions/v1/zoho-sync — called every 10 minutes by the database (see supabase/cron.sql).
// Keeps Zoho Inventory (and with it Zoho Books) up to date with the store:
//   - each piece is an item (found by its SKU, or created), and its stock is kept equal to the website's stock table,
//   - each website order and recorded sale becomes an invoice numbered like the order (S017...), for its customer,
//   - a payment is recorded once it is paid: recorded sales straight away, website orders when delivered,
//   - a cancelled order's payment is removed and its invoice voided.
// The website stays the place where sales and stock are entered; Zoho follows it. If a copy fails, you get one
// email per reason, and it tries again 10 minutes later.
import { configured, emailLayout, env, escapeHtml, json, rpc, sendEmail } from '../store.mjs';
import { ZohoError, zoho, zohoConfigured } from '../zoho.mjs';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' }).format(new Date());
const money = (n) => Math.round(Number(n || 0) * 100) / 100;
const METAL = { yellow: 'Yellow gold', rose: 'Rose gold', white: 'White gold' };
const PAYMENT = { cash: 'Cash', card: 'Credit Card', bank: 'Bank Transfer', whish: 'Bank Transfer', voucher: 'Cash' };

const describe = (i) => [METAL[i.metal] || METAL.yellow, i.size, i.stone && `made with ${i.stone}`,
  i.made_to_order && 'made to order'].filter(Boolean).join(', ');

// ---- items
async function ensureItems(products) {
  const ids = {};
  for (const p of products) {
    if (p.item_id) { ids[p.slug] = p.item_id; continue; }
    if (!p.sku) continue;
    const found = (await zoho('GET', 'items', { query: { sku: p.sku } })).items?.find((i) => i.sku === p.sku);
    const id = found ? found.item_id : (await zoho('POST', 'items', {
      body: {
        name: p.name, sku: p.sku, rate: money(p.price), unit: 'pcs', item_type: 'inventory', product_type: 'goods',
        description: `${p.category}, 18k gold`,
      },
    })).item.item_id;
    ids[p.slug] = String(id);
    await rpc('zoho_save_item', { p_slug: p.slug, p_item_id: String(id) });
  }
  return ids;
}

// Makes Zoho's stock equal to the website's, allowing for the invoices about to be made or voided, so it is right
// once they are done (and the next run corrects any difference).
async function matchStock(products, ids, pending) {
  const onHand = {};
  for (let page = 1; page < 20; page += 1) {
    const res = await zoho('GET', 'items', { query: { page, per_page: 200 } });
    for (const i of res.items || []) onHand[String(i.item_id)] = Number(i.stock_on_hand || 0);
    if (!res.page_context?.has_more_page) break;
  }
  const lines = [];
  for (const p of products) {
    const id = ids[p.slug];
    if (!id) continue;
    const diff = Number(p.stock) + (pending[p.slug] || 0) - (onHand[id] || 0);
    if (diff) lines.push({ item_id: id, quantity_adjusted: diff });
  }
  if (lines.length) {
    await zoho('POST', 'inventoryadjustments', {
      body: { date: today(), reason: 'Website stock', adjustment_type: 'quantity',
        description: 'Matched to the stock on the Siaram website (sales, new pieces, made-to-order pieces, cancellations).',
        line_items: lines },
    });
  }
  return lines.length;
}

// ---- customers
async function ensureContact(order, contacts) {
  const key = (order.email || order.customer_name).trim().toLowerCase();
  if (contacts[key]) return contacts[key];
  let found = null;
  if (order.email) found = (await zoho('GET', 'contacts', { query: { email: order.email } })).contacts?.[0];
  if (!found) {
    found = (await zoho('GET', 'contacts', { query: { contact_name: order.customer_name } })).contacts
      ?.find((c) => c.contact_name.trim().toLowerCase() === order.customer_name.trim().toLowerCase());
  }
  if (!found) {
    const [first, ...rest] = order.customer_name.trim().split(/\s+/);
    found = (await zoho('POST', 'contacts', {
      body: {
        contact_name: order.customer_name.trim(), contact_type: 'customer',
        billing_address: order.address ? { address: order.address, country: 'Lebanon' } : undefined,
        contact_persons: [{ first_name: first, last_name: rest.join(' '), email: order.email || undefined,
          phone: order.phone || undefined, is_primary_contact: true }],
        notes: `From the Siaram website (${order.channel}).`,
      },
    })).contact;
  }
  contacts[key] = String(found.contact_id);
  await rpc('zoho_save_contact', { p_key: key, p_contact_id: contacts[key] });
  return contacts[key];
}

// ---- invoices and payments
async function createInvoice(order, customerId, ids) {
  const missing = order.items.find((i) => !ids[i.slug]);
  if (missing) throw new ZohoError(`${missing.name} has no SKU, so it is not in Zoho.`);
  const body = {
    customer_id: customerId, invoice_number: order.reference, reference_number: order.channel, date: order.sale_date,
    line_items: order.items.map((i) => ({ item_id: ids[i.slug], rate: money(i.unit_price), quantity: i.quantity, description: describe(i) })),
    notes: order.channel === 'Website' ? 'Website order.' : `Sale recorded on the website (${order.channel}).`,
  };
  if (Number(order.voucher_amount) > 0) {
    body.adjustment = -money(order.voucher_amount);
    body.adjustment_description = `Gift voucher ${order.voucher_code || ''}`.trim();
  }
  let invoice;
  try {
    invoice = (await zoho('POST', 'invoices', { body, query: { ignore_auto_number_generation: 'true' } })).invoice;
  } catch (err) {
    // Already created by an earlier run whose answer was lost: use that one.
    invoice = (await zoho('GET', 'invoices', { query: { invoice_number: order.reference } })).invoices
      ?.find((i) => i.invoice_number === order.reference);
    if (!invoice) throw err;
  }
  await zoho('POST', `invoices/${invoice.invoice_id}/status/sent`).catch(() => {});
  return String(invoice.invoice_id);
}

async function recordPayment(order, customerId, invoiceId) {
  const website = order.channel === 'Website';
  const payment = (await zoho('POST', 'customerpayments', {
    body: {
      customer_id: customerId, payment_mode: PAYMENT[order.payment_method] || 'Cash', amount: money(order.total),
      date: website ? today() : order.sale_date, reference_number: order.reference,
      description: website ? 'Paid on delivery (website order).' : `Paid by ${order.payment_method} (${order.channel}).`,
      invoices: [{ invoice_id: invoiceId, amount_applied: money(order.total) }],
    },
  })).payment;
  return String(payment.payment_id);
}

async function cancel(order) {
  if (order.payment_id) await zoho('DELETE', `customerpayments/${order.payment_id}`).catch(() => {});
  await zoho('POST', `invoices/${order.invoice_id}/status/void`);
}

export async function syncZoho(work) {
  const result = { items: 0, invoices: 0, payments: 0, voided: 0, stock_changes: 0, errors: [] };
  const known = work.products.filter((p) => p.item_id).length;
  const ids = await ensureItems(work.products);
  result.items = Object.keys(ids).length - known;

  const toInvoice = work.orders.filter((o) => o.status !== 'cancelled' && !o.invoice_id);
  const pending = {};
  for (const o of toInvoice) for (const i of o.items || []) pending[i.slug] = (pending[i.slug] || 0) + i.quantity;
  // Voiding an invoice gives its pieces back to Zoho's stock, so leave room for that too.
  for (const o of work.orders.filter((x) => x.status === 'cancelled' && x.invoice_id)) {
    for (const i of o.items || []) pending[i.slug] = (pending[i.slug] || 0) - i.quantity;
  }
  result.stock_changes = await matchStock(work.products, ids, pending);

  for (const order of work.orders) {
    try {
      if (order.status === 'cancelled') {
        if (order.invoice_id) { await cancel(order); result.voided += 1; }
        await rpc('zoho_save_order', { p_order_id: order.id, p_invoice_id: null, p_payment_id: null, p_voided: true, p_error: '' });
        continue;
      }
      const customerId = await ensureContact(order, work.contacts);
      let invoiceId = order.invoice_id;
      if (!invoiceId) {
        invoiceId = await createInvoice(order, customerId, ids);
        await rpc('zoho_save_order', { p_order_id: order.id, p_invoice_id: invoiceId, p_payment_id: null, p_voided: null, p_error: '' });
        result.invoices += 1;
      }
      const paid = order.channel !== 'Website' || order.status === 'delivered';
      if (paid && !order.payment_id && Number(order.total) > 0) {
        const paymentId = await recordPayment(order, customerId, invoiceId);
        await rpc('zoho_save_order', { p_order_id: order.id, p_invoice_id: invoiceId, p_payment_id: paymentId, p_voided: null, p_error: '' });
        result.payments += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${order.reference}: ${message}`);
      await rpc('zoho_save_order', { p_order_id: order.id, p_invoice_id: null, p_payment_id: null, p_voided: null, p_error: message })
        .catch(() => {});
    }
  }
  return result;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Not set up.' }, 503);
  const secret = req.headers.get('x-cron-secret') || '';
  if (!secret || !(await rpc('cron_secret_ok', { p_secret: secret }))) return json({ error: 'Not allowed.' }, 403);
  if (!zohoConfigured()) return json({ skipped: 'Zoho secrets not set.' });
  if (!(await rpc('claim_zoho_sync', {}))) return json({ skipped: 'Not connected, or already running.' });

  let problem = '';
  let result = null;
  try {
    result = await syncZoho(await rpc('zoho_work', {}));
    problem = result.errors.join('\n');
  } catch (err) {
    problem = err instanceof Error ? err.message : String(err);
    console.error('zoho-sync', err);
  }
  const previous = await rpc('finish_zoho_sync', { p_error: problem }).catch(() => problem);
  if (problem && previous !== problem) {
    await sendEmail({
      to: env('ORDER_NOTIFY_EMAIL'),
      subject: 'Zoho could not be updated',
      html: emailLayout('Zoho could not be updated',
        `<p style="font-size:15px;line-height:1.6">The website could not copy everything into Zoho. It tries again every
         10 minutes, and nothing is lost on the website in the meantime.</p>
         <p style="font-size:15px;line-height:1.6">What Zoho said:<br><strong>${escapeHtml(problem).replace(/\n/g, '<br>')}</strong></p>
         <p style="font-size:15px;line-height:1.6">You won't get this email again for the same reason.</p>`),
    });
  }
  return json(result || { error: problem }, result ? 200 : 500);
};
