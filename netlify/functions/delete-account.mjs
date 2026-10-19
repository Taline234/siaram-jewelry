// POST /api/delete-account — lets a signed-in customer delete their own account.
// Order records are kept (without the link to the account) for accounting and warranty.
import { configured, deleteUser, emailLayout, json, sendEmail, userFromRequest } from '../lib/store.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'Accounts are not available yet.' }, 503);
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Please sign in again.' }, 401);
    await deleteUser(user.id);
    await sendEmail({
      to: user.email,
      subject: 'Your Siaram account has been deleted',
      html: emailLayout('Your account has been deleted',
        '<p style="font-size:15px;line-height:1.6">As requested, we have deleted your Siaram Jewelry account, saved addresses and wishlist. Records of past orders are kept as described in our Privacy Policy.</p>'),
    });
    return json({ deleted: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Could not delete your account right now. Please contact us.' }, 500);
  }
};

export const config = { path: '/api/delete-account' };
