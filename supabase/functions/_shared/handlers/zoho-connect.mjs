// /functions/v1/zoho-connect — the "Zoho" tab on the owner's account page.
//   POST { action: 'status' }   whether Zoho is connected, to which organisation, and how the last copy went
//   POST { action: 'start' }    the Zoho page to open, where the owner clicks Accept
//   GET  ?code=...&state=...    where Zoho sends the owner back: saves the connection, then returns to the account page
import { configured, env, isOwner, json, readJson, rpc, userFromRequest } from '../store.mjs';
import { SCOPE, accountsUrl, exchangeCode, redirectUri, zoho, zohoConfigured } from '../zoho.mjs';

const back = (result) => {
  const site = env('SITE_URL') || 'https://siaramjewelry.com';
  return new Response(null, { status: 302, headers: { location: `${site}/account.html?zoho=${result}#zoho` } });
};

async function callback(url) {
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (url.searchParams.get('error') || !code || !state) return back('cancelled');
  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back('failed');
    const orgs = await zoho('GET', 'organizations', { token: tokens.access_token });
    const org = (orgs.organizations || []).find((o) => o.is_default_org) || (orgs.organizations || [])[0];
    if (!org) return back('no-organization');
    const ok = await rpc('zoho_finish_connect', {
      p_state: state, p_refresh_token: tokens.refresh_token, p_access_token: tokens.access_token,
      p_expires_in: tokens.expires_in, p_organization_id: String(org.organization_id), p_organization_name: org.name,
    });
    return back(ok ? 'connected' : 'expired');
  } catch (err) {
    console.error('zoho-connect', err);
    return back('failed');
  }
}

export default async (req) => {
  if (!configured()) return json({ error: 'The store is not set up yet.' }, 503);
  const url = new URL(req.url);
  if (req.method === 'GET') return callback(url);
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const user = await userFromRequest(req);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!isOwner(user)) return json({ error: 'Only the shop owner can do this.' }, 403);
  const body = await readJson(req).catch(() => ({}));

  if (body.action === 'start') {
    if (!zohoConfigured()) return json({ error: 'Add the ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET secrets in Supabase first.' }, 400);
    const state = await rpc('zoho_begin_connect', {});
    const params = new URLSearchParams({
      scope: SCOPE, client_id: env('ZOHO_CLIENT_ID'), response_type: 'code', access_type: 'offline',
      prompt: 'consent', redirect_uri: redirectUri(), state,
    });
    return json({ url: `${accountsUrl()}/oauth/v2/auth?${params}` });
  }
  return json({ ...(await rpc('zoho_status', {})), keys_added: zohoConfigured() });
};
