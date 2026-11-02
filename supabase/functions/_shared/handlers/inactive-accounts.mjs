// POST /functions/v1/inactive-accounts — called once a day by the database's scheduler (pg_cron).
// Emails customers whose accounts have been inactive for 12 months, warns after 24 months that the
// account will be deleted in 30 days, then deletes it. Only the scheduler knows the secret it must send.
import { configured, deleteUser, emailLayout, env, escapeHtml, json, rpc, sendEmail } from '../store.mjs';

const site = () => env('SITE_URL') || 'https://siaramjewelry.com';

const MESSAGES = {
  reminder: (name) => ({
    subject: 'We miss you at Siaram Jewelry',
    html: emailLayout(`Hello ${name},`,
      `<p style="font-size:15px;line-height:1.6">It has been a year since you last visited your Siaram account.
       Your saved details and wishlist are still here whenever you need them.</p>
       <p style="font-size:15px;line-height:1.6">Accounts with no activity for 24 months are deleted, so
       <a href="${site()}/account.html" style="color:#1b3a2b">sign in</a> any time to keep yours.</p>`),
  }),
  deletion_notice: (name) => ({
    subject: 'Your Siaram account will be deleted in 30 days',
    html: emailLayout(`Hello ${name},`,
      `<p style="font-size:15px;line-height:1.6">Your Siaram Jewelry account has not been used for 24 months.
       As explained in our Privacy Policy, we will delete it, with your saved addresses and wishlist, in 30 days.</p>
       <p style="font-size:15px;line-height:1.6">To keep it, simply
       <a href="${site()}/account.html" style="color:#1b3a2b">sign in</a> before then.</p>`),
  }),
  delete: (name) => ({
    subject: 'Your Siaram account has been deleted',
    html: emailLayout(`Hello ${name},`,
      `<p style="font-size:15px;line-height:1.6">Your inactive Siaram Jewelry account has now been deleted.
       You are always welcome to create a new one at <a href="${site()}" style="color:#1b3a2b">siaramjewelry.com</a>.</p>`),
  }),
};

export default async (req) => {
  if (!configured()) return json({ error: 'Not set up.' }, 503);
  const secret = req.headers.get('x-cron-secret') || '';
  if (!secret || !(await rpc('cron_secret_ok', { p_secret: secret }))) return json({ error: 'Not allowed.' }, 403);
  const due = await rpc('inactivity_due', {});
  for (const account of due) {
    try {
      const message = MESSAGES[account.action](escapeHtml(account.first_name || 'there'));
      if (account.action === 'delete') {
        await deleteUser(account.user_id);
        await sendEmail({ to: account.email, ...message });
      } else if (await sendEmail({ to: account.email, ...message })) {
        await rpc('mark_inactivity_email', { p_user_id: account.user_id, p_action: account.action });
      }
    } catch (err) {
      console.error('Inactivity step failed for', account.user_id, err);
    }
  }
  console.log(`Inactivity job: ${due.length} account(s) processed`);
  return json({ processed: due.length });
};
