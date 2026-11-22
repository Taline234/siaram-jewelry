// Reads and writes the finance workbook in Google Sheets, signed in as a Google "service account" (a robot Google
// account the workbook is shared with as an editor). Free, and needs no npm packages.
//
// Secrets (Supabase -> Edge Functions -> Secrets), see STORE-SETUP.md "Finance workbook in Google Sheets":
//   GOOGLE_SERVICE_ACCOUNT   the whole JSON key file of the service account
//   WORKBOOK_SHEET_ID        the long id in the workbook's address: docs.google.com/spreadsheets/d/<id>/edit
import { Buffer } from 'node:buffer';
import { env } from './store.mjs';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

export const sheetsConfigured = () => Boolean(env('GOOGLE_SERVICE_ACCOUNT') && env('WORKBOOK_SHEET_ID'));

const base64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

// An access token for the Sheets API, from a JWT signed with the service account's private key.
export async function googleToken() {
  let account;
  try {
    account = JSON.parse(env('GOOGLE_SERVICE_ACCOUNT'));
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not the JSON key file (paste the whole file).');
  }
  const der = Buffer.from(String(account.private_key || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${base64url(signature)}`,
    }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed (${res.status}): ${body.error_description || body.error || ''}`);
  return body.access_token;
}

async function call(token, path, init = {}) {
  const res = await fetch(`${SHEETS}/${encodeURIComponent(env('WORKBOOK_SHEET_ID'))}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = body.error?.message || '';
    if (res.status === 403) throw new Error(`Google Sheets refused access: share the workbook with the service account as an Editor. ${why}`);
    if (res.status === 404) throw new Error(`Workbook not found: check WORKBOOK_SHEET_ID. ${why}`);
    throw new Error(`Google Sheets error ${res.status}: ${why}`);
  }
  return body;
}

// 'Sales' -> "'Sales'" so tab names with spaces work in ranges.
export const tab = (name) => `'${String(name).replace(/'/g, "''")}'`;

// The tabs' numeric ids by name (needed to delete rows).
export async function tabIds(token) {
  const body = await call(token, '?fields=sheets.properties(sheetId,title)');
  return Object.fromEntries((body.sheets || []).map((s) => [s.properties.title, s.properties.sheetId]));
}

// The values of a range as shown in the sheet (rows of strings; trailing empty cells left out).
export async function readRange(token, range) {
  const body = await call(token, `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
  return body.values || [];
}

// Writes several ranges at once, as if typed in (so dates become dates and numbers numbers).
export async function writeRanges(token, data) {
  if (!data.length) return;
  await call(token, '/values:batchUpdate', {
    method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  });
}

// Deletes whole rows (1-based row numbers) from a tab, bottom first so the numbers stay right.
export async function deleteRows(token, sheetId, rows) {
  if (!rows.length) return;
  const requests = [...new Set(rows)].sort((a, b) => b - a).map((row) => ({
    deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } },
  }));
  await call(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
}
