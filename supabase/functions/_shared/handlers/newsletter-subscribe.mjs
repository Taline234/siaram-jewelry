// POST /functions/v1/newsletter-subscribe — the mailing-list form on every page. Saves the sign-up with its consent
// wording (subscribe_newsletter), sends new subscribers a welcome email with their unsubscribe link, and, when
// RESEND_AUDIENCE_ID is set, adds them to the Resend audience the owner sends newsletters from.
import { CustomerError, configured, emailLayout, env, escapeHtml, json, readJson, rpc, sendEmail } from '../store.mjs';
import { syncAudience } from '../newsletter.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'The mailing list is not available yet.' }, 503);
  try {
    const body = await readJson(req, 2000);
    if (body.website) return json({ error: 'Invalid request.' }, 400); // spam trap
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254);
    const source = String(body.source ?? '').slice(0, 80);
    const status = await rpc('subscribe_newsletter', { p_email: email, p_source: source });
    if (status === 'subscribed') {
      const token = await rpc('newsletter_token', { p_email: email });
      const site = env('SITE_URL') || 'https://siaramjewelry.com';
      const unsubscribe = `${site}/unsubscribe.html?t=${token}`;
      // Until launch day the welcome email promises the launch news; set SITE_LAUNCHED=true in Supabase at launch.
      const launched = env('SITE_LAUNCHED') === 'true';
      await Promise.all([
        sendEmail({
          to: email,
          subject: 'Welcome to Siaram',
          from: env('NEWSLETTER_EMAIL_FROM') || undefined,
          headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
          html: emailLayout('Welcome to Siaram', (launched
            ? `<p style="font-size:15px;line-height:1.7">Thank you for joining us. You will be the first to hear about new
             collections, with styling inspiration, jewelry care advice and the stories behind our pieces.</p>
             <p style="font-size:15px;line-height:1.7">Every Siaram piece is made in 18k gold and designed to be worn every day,
             layered or on its own.</p>
             <p style="margin:24px 0"><a href="${escapeHtml(site)}/shop.html" style="background:#1b3a2b;color:#f3ede2;text-decoration:none;
             padding:12px 22px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px">DISCOVER THE COLLECTION</a></p>`
            : `<p style="font-size:15px;line-height:1.7">Thank you for joining us. Our website is almost ready, and you will be
             the first to know the day it launches.</p>
             <p style="font-size:15px;line-height:1.7">After that, we will share our new collections, the stories and meaning behind
             each piece, and jewelry care advice. Every Siaram piece is made in 18k gold and designed to be worn every day.</p>
             <p style="margin:24px 0"><a href="https://instagram.com/siaram.jewelry" style="background:#1b3a2b;color:#f3ede2;text-decoration:none;
             padding:12px 22px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px">FOLLOW US ON INSTAGRAM</a></p>`)
            + `
             <p style="font-size:12px;line-height:1.6;color:#6b6b5f">You are receiving this because you signed up on siaramjewelry.com.
             <a href="${escapeHtml(unsubscribe)}" style="color:#6b6b5f">Unsubscribe</a> at any time.</p>`),
        }),
        syncAudience(email, false),
      ]);
    }
    return json({ status });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Sorry, something went wrong. Please try again.' }, 500);
  }
};
