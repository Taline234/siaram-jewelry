// POST /api/check-voucher — tells the checkout whether a gift voucher can be used, and its balance.
import { CustomerError, configured, json, readJson, rpc } from '../lib/store.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Online ordering is not available yet.' }, 503);
  try {
    const { code } = await readJson(req, 2000);
    if (!code || String(code).length > 40) throw new CustomerError('Please enter a gift voucher code.');
    const voucher = await rpc('check_voucher', { p_code: String(code) });
    return json({ code: voucher.code, balance: voucher.balance, expires_at: voucher.expires_at });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Could not check this voucher right now. Please try again.' }, 500);
  }
};

export const config = { path: '/api/check-voucher' };
