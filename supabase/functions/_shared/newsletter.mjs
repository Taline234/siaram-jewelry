// Keeps the Resend audience the owner sends newsletters from in step with the mailing list. Does nothing until the
// RESEND_AUDIENCE_ID secret is set in Supabase; a failure here never stops a sign-up or an unsubscribe.
import { env } from './store.mjs';

export async function syncAudience(email, unsubscribed) {
  const audience = env('RESEND_AUDIENCE_ID');
  const key = env('RESEND_API_KEY');
  if (!audience || !key) return false;
  const base = `https://api.resend.com/audiences/${encodeURIComponent(audience)}/contacts`;
  const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    let res = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ email, unsubscribed }) });
    if (!res.ok && unsubscribed) {
      // Already in the audience: update the existing contact instead.
      res = await fetch(`${base}/${encodeURIComponent(email)}`, { method: 'PATCH', headers, body: JSON.stringify({ unsubscribed: true }) });
    }
    if (!res.ok) console.error('Resend audience', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('Resend audience', err);
    return false;
  }
}
