// Wakilni courier API (https://wiki.wakilni.com/integrations/api).
// Secrets, set in Supabase -> Edge Functions -> Secrets (from the Wakilni portal: Settings -> Api Tokens ->
// "Link to your custom app"):
//   WAKILNI_KEY       the key
//   WAKILNI_SECRET    the secret
//   WAKILNI_API_URL   optional; https://api-dev.wakilni.com for Wakilni's test system (default https://api.wakilni.com)
import { env } from './store.mjs';

export const wakilniConfigured = () => Boolean(env('WAKILNI_KEY') && env('WAKILNI_SECRET'));
const base = () => (env('WAKILNI_API_URL') || 'https://api.wakilni.com').replace(/\/+$/, '');

// Wakilni's error messages come back in a few shapes; turn any of them into one readable line.
function errorText(status, body) {
  if (body && typeof body === 'object') {
    const parts = [body.message, body.error];
    if (body.errors && typeof body.errors === 'object') parts.push(...Object.values(body.errors).flat());
    const text = parts.filter((p) => typeof p === 'string' && p).join(' ');
    if (text) return `Wakilni said: ${text} (HTTP ${status})`;
  }
  return `Wakilni answered HTTP ${status}`;
}

async function call(method, path, { token, body, query } = {}) {
  const url = new URL(base() + path);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorText(res.status, data));
  return data || {};
}

export async function wakilniToken() {
  // The auth call is a GET; its key and secret go in the query string.
  const data = await call('GET', '/api/v2/third_party/auth_token',
                          { query: { key: env('WAKILNI_KEY'), secret: env('WAKILNI_SECRET') } });
  if (!data.token) throw new Error('Wakilni did not return a token: check WAKILNI_KEY and WAKILNI_SECRET.');
  return data.token;
}

const orderNumber = (reference) => Number(String(reference).replace(/\D/g, '')) || undefined;

function splitName(full) {
  const words = String(full || '').trim().split(/\s+/).filter(Boolean);
  return { first: words[0] || 'Customer', last: words.slice(1).join(' ') || '-' };
}

// What the driver collects: the jewellery still to pay plus the delivery fee (the customer pays both in cash).
export const collectionAmount = (order) =>
  Math.round((Number(order.total || 0) + Number(order.delivery_fee || 0)) * 100) / 100;

// The add_delivery body for one order (order = courier_booking_details from the database).
export function deliveryBody(order) {
  const gift = order.is_gift && order.gift_recipient_name;
  const name = splitName(gift ? order.gift_recipient_name : order.customer_name);
  const phone = (gift && order.gift_recipient_phone) || order.phone;
  const amount = collectionAmount(order);
  const floor = parseInt(order.floor, 10);
  const directions = [order.street, order.building && `Building ${order.building}`, order.floor && `Floor ${order.floor}`,
                      order.governorate, order.notes].filter(Boolean).join(', ');
  const skus = (order.items || []).map((i) => i.sku).filter(Boolean).join(', ');
  const note = [
    `Siaram Jewelry order ${order.reference}.`,
    amount > 0 ? `Collect $${amount.toFixed(2)} in cash (USD).` : 'Nothing to collect.',
    gift ? 'Gift: please hand it over as a gift; the receiver pays nothing extra.' : '',
    gift && phone !== order.phone ? `Sender: ${order.customer_name}, ${order.phone}.` : '',
    'Fragile jewellery, keep the box upright.',
  ].filter(Boolean).join(' ');
  return {
    get_order_details: false,
    get_barcode: true,
    waybill: order.reference,
    receiver_id: orderNumber(order.reference),
    receiver_first_name: name.first,
    receiver_last_name: name.last,
    receiver_phone_number: phone,
    receiver_secondary_phone_number: gift && phone !== order.phone ? order.phone : undefined,
    receiver_email: gift ? undefined : order.email,
    receiver_location_id: orderNumber(order.reference),
    receiver_building: order.building || undefined,
    receiver_floor: Number.isFinite(floor) ? floor : undefined,
    receiver_directions: directions || undefined,
    receiver_area: order.city || order.governorate,
    currency: 1,                                      // USD
    cash_collection_type_id: amount > 0 ? 52 : 54,    // 52 = collect on delivery, 54 = already paid
    collection_amount: amount,
    note,
    car_needed: false,
    is_express: false,
    packages: [{ quantity: 1, type_id: 59, name: 'Jewellery', sku: skus || undefined }], // 59 = small box
  };
}

// Books one delivery: open a bulk at your pickup address, add the delivery, close the bulk (which sends it to
// Wakilni's drivers). Returns Wakilni's ids and the barcode label (base64 PNG) if one was sent.
export async function bookDelivery(order) {
  if (!order.pickup_area) throw new Error('Fill in courier_pickup_area in Table Editor -> store_settings first.');
  const token = await wakilniToken();
  const pickup = { location_id: 1, area: order.pickup_area };
  if (order.pickup_floor != null) pickup.floor = Number(order.pickup_floor);
  if (order.pickup_latitude != null && order.pickup_longitude != null) {
    pickup.latitude = Number(order.pickup_latitude);
    pickup.longitude = Number(order.pickup_longitude);
  }
  const bulk = await call('POST', '/api/v2/clients/start_bulk', { token, body: pickup });
  const bulkId = bulk.bulk_id ?? bulk.id ?? bulk.data?.bulk_id;
  if (!bulkId) throw new Error('Wakilni did not open a pickup (no bulk_id).');
  const delivery = await call('POST', `/api/v2/clients/add_delivery/${bulkId}`, { token, body: deliveryBody(order) });
  await call('POST', `/api/v2/clients/end_bulk/${bulkId}`, { token });
  const id = Number(delivery.delivery_id ?? delivery.id ?? delivery.data?.delivery_id);
  if (!id) throw new Error('Wakilni did not return the delivery id.');
  return { id, trackingId: delivery.tracking_id || null, trackingUrl: delivery.tracking_url || null,
           label: typeof delivery.barcode_label === 'string' ? delivery.barcode_label : null };
}

// The latest status of a Wakilni order: { code, status } or null if Wakilni has none yet.
export async function deliveryStatus(token, courierOrderId) {
  const data = await call('GET', '/api/v2/clients/orders/status', { token, query: { order_id: String(courierOrderId) } });
  const logs = data?.data?.logs || [];
  if (!logs.length) return null;
  const latest = [...logs].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  return { code: Number(latest.status_code), status: String(latest.status) };
}
