// Talks to Zoho Inventory (whose invoices and payments also appear in Zoho Books), over plain HTTPS.
//
// Secrets (Supabase -> Edge Functions -> Secrets), see STORE-SETUP.md "Zoho Inventory and Books":
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET   from api-console.zoho.eu (a "Server-based Application")
//   ZOHO_REGION                          optional: eu (default), com, in, com.au, jp, ca, sa
// The connection itself (Zoho's refresh token and organisation) is saved in the database by zoho-connect.
import { env, rpc } from './store.mjs';

export const zohoConfigured = () => Boolean(env('ZOHO_CLIENT_ID') && env('ZOHO_CLIENT_SECRET'));

const region = () => env('ZOHO_REGION') || 'eu';
export const accountsUrl = () => `https://accounts.zoho.${region()}`;
const apiUrl = (app = 'inventory') => `https://www.zohoapis.${region()}/${app === 'books' ? 'books/v3' : 'inventory/v1'}`;
export const redirectUri = () => `${env('SUPABASE_URL')}/functions/v1/zoho-connect`;
// Inventory for items, stock, invoices and payments; Books for expenses and owner's money (the workbook import).
export const SCOPE = 'ZohoInventory.FullAccess.all,ZohoBooks.fullaccess.all';

export class ZohoError extends Error {}

async function tokenRequest(params) {
  const res = await fetch(`${accountsUrl()}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('ZOHO_CLIENT_ID'), client_secret: env('ZOHO_CLIENT_SECRET'), ...params }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error || !body.access_token) {
    throw new ZohoError(`Zoho sign-in failed: ${body.error || res.status}. If this keeps happening, click Connect Zoho again.`);
  }
  return body;
}

// The first sign-in, with the code Zoho sends back after the owner clicks Accept.
export const exchangeCode = (code) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });

// An access token (valid about an hour), reused from the database while it is still good.
async function accessToken() {
  const saved = await rpc('zoho_credentials', {});
  if (!saved?.refresh_token) throw new ZohoError('Zoho is not connected yet: click Connect Zoho on your account page.');
  if (saved.access_token) return { token: saved.access_token, org: saved.organization_id };
  const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: saved.refresh_token });
  await rpc('zoho_save_access', { p_access_token: fresh.access_token, p_expires_in: fresh.expires_in });
  return { token: fresh.access_token, org: saved.organization_id };
}

// Calls made in this run, so a run stays under Zoho's limit of about 100 a minute.
let callCount = 0;
export const zohoCalls = () => callCount;
export const resetZohoCalls = () => { callCount = 0; };

// One Zoho Inventory API call (or Zoho Books with app: 'books'). Zoho answers { code: 0, ... } when it worked.
export async function zoho(method, path, { body, query = {}, token, org, app = 'inventory' } = {}) {
  callCount += 1;
  const auth = token ? { token, org } : await accessToken();
  const params = new URLSearchParams({ ...(auth.org ? { organization_id: auth.org } : {}), ...query });
  const res = await fetch(`${apiUrl(app)}/${path}?${params}`, {
    method,
    headers: { authorization: `Zoho-oauthtoken ${auth.token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.code !== undefined && data.code !== 0)) {
    const scope = /scope|unauthori[sz]ed|oauth/i.test(String(data.message || '')) || res.status === 401;
    throw new ZohoError(`Zoho ${app === 'books' ? 'Books ' : ''}${method} ${path.split('/')[0]}: ${data.message || res.status}`
      + (scope && app === 'books' ? ' (click Connect Again on the Zoho tab to give the website access to Zoho Books)' : ''));
  }
  return data;
}
