// POST /functions/v1/newsletter-unsubscribe — the unsubscribe page (unsubscribe.html?t=...), and the one-click
// unsubscribe that email apps send. Marks the subscriber unsubscribed and, with RESEND_AUDIENCE_ID set, in Resend too.
import { configured, json, rpc } from '../store.mjs';
import { syncAudience } from '../newsletter.mjs';

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Not available.' }, 503);
  const url = new URL(req.url);
  let token = url.searchParams.get('t') || '';
  if (!token) {
    try {
      token = String((await req.json()).token || '');
    } catch {
      token = '';
    }
  }
  if (!TOKEN.test(token)) return json({ error: 'This unsubscribe link is not valid.' }, 400);
  try {
    const email = await rpc('unsubscribe_newsletter', { p_token: token });
    if (!email) return json({ error: 'This unsubscribe link is not valid.' }, 404);
    await syncAudience(email, true);
    return json({ unsubscribed: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Sorry, something went wrong. Please try again or email us.' }, 500);
  }
};
