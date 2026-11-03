// GET /functions/v1/export-sales — the owner's backup download for the finance workbook.
//   ?check=1                     tells the account page whether to show the Workbook tab
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   returns one Excel file with a Sales tab and a Customers tab
//   ?kind=sales|customers&...        returns that list alone as a CSV file
// Only signed-in, confirmed accounts listed in OWNER_EMAILS (comma separated) may use it.
import { configured, isOwner, json, rpc, userFromRequest } from '../store.mjs';
import { customersCsv, salesCsv, workbookXlsx } from '../workbook.mjs';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'The store is not set up yet.' }, 503);
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Please sign in again.' }, 401);
    const url = new URL(req.url);
    if (url.searchParams.get('check')) return json({ owner: isOwner(user) });
    if (!isOwner(user)) return json({ error: 'Only the shop owner can download this.' }, 403);

    const kind = ['sales', 'customers'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'workbook';
    const day = (name) => (DAY.test(url.searchParams.get(name) || '') ? url.searchParams.get(name) : null);
    const from = day('from');
    const to = day('to');
    const orders = await rpc('sales_export', { p_from: from, p_to: to });
    const dates = `${from ? `-from-${from}` : ''}${to ? `-to-${to}` : ''}`;
    const file = kind === 'workbook'
      ? { body: workbookXlsx(orders), name: `Siaram-workbook${dates}.xlsx`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      : { body: kind === 'customers' ? customersCsv(orders) : salesCsv(orders), name: `Siaram-website-${kind}${dates}.csv`,
        type: 'text/csv; charset=utf-8' };
    return new Response(file.body, {
      headers: {
        'content-type': file.type,
        'content-disposition': `attachment; filename="${file.name}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Could not prepare the download right now.' }, 500);
  }
};
