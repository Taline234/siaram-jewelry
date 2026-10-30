// GET /api/export-sales — the owner's backup download for the finance workbook.
//   ?check=1                     tells the account page whether to show the Workbook tab
//   ?kind=sales|customers&from=YYYY-MM-DD&to=YYYY-MM-DD   returns a CSV file
// Only signed-in, confirmed accounts listed in OWNER_EMAILS (comma separated) may use it.
import { configured, json, rpc, userFromRequest } from '../lib/store.mjs';
import { customersCsv, salesCsv } from '../lib/workbook.mjs';

const DEFAULT_OWNERS = 'siaramjewelry@hotmail.com,finance@siaramjewelry.com,customerservice@siaramjewelry.com';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isOwner(user) {
  const owners = (process.env.OWNER_EMAILS || DEFAULT_OWNERS).split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(user && user.email_confirmed_at && owners.includes(String(user.email).toLowerCase()));
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'The store is not set up yet.' }, 503);
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Please sign in again.' }, 401);
    const url = new URL(req.url);
    if (url.searchParams.get('check')) return json({ owner: isOwner(user) });
    if (!isOwner(user)) return json({ error: 'Only the shop owner can download this.' }, 403);

    const kind = url.searchParams.get('kind') === 'customers' ? 'customers' : 'sales';
    const day = (name) => (DAY.test(url.searchParams.get(name) || '') ? url.searchParams.get(name) : null);
    const from = day('from');
    const to = day('to');
    const orders = await rpc('sales_export', { p_from: from, p_to: to });
    const body = kind === 'customers' ? customersCsv(orders) : salesCsv(orders);
    const name = `Siaram-website-${kind}${from ? `-from-${from}` : ''}${to ? `-to-${to}` : ''}.csv`;
    return new Response(body, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Could not prepare the download right now.' }, 500);
  }
};

export const config = { path: '/api/export-sales' };
