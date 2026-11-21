// GET/POST /functions/v1/voucher-admin — the Gift Vouchers tab on the account page. Only the shop owner may use it.
// GET lists recent gift voucher requests; POST {reference, status: 'paid' | 'cancelled'} marks one that is still waiting.
// Marking it paid creates the voucher and sends it to the recipient (the database does this; see schema.sql).
import { CustomerError, configured, isOwner, json, readJson, rpc, userFromRequest } from '../store.mjs';

export default async (req) => {
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'The store is not set up yet.' }, 503);
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Please sign in again.' }, 401);
    if (!isOwner(user)) return json({ error: 'Only the shop owner can manage gift vouchers.' }, 403);
    if (req.method === 'GET') return json({ requests: await rpc('owner_voucher_requests', {}) });
    const body = await readJson(req, 2000);
    const reference = String(body.reference ?? '').trim().slice(0, 20);
    const status = String(body.status ?? '');
    if (!reference || !['paid', 'cancelled'].includes(status)) throw new CustomerError('Please choose a request and an action.');
    return json(await rpc('set_voucher_request_status', { p_reference: reference, p_status: status }));
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    if (/not waiting for payment/.test(err.detail || err.message || '')) return json({ error: 'This request has already been dealt with. Refresh the list.' }, 409);
    console.error(err);
    return json({ error: 'Could not update the gift vouchers right now.' }, 500);
  }
};
