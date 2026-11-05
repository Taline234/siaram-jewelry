// Unsubscribe page: unsubscribe.html?t=<token> from the link in every Siaram marketing email.
import { apiUrl, storeEnabled } from './store.js';

const box = document.querySelector('.unsubscribe-box');
const token = new URLSearchParams(location.search).get('t') || '';
const msg = box?.querySelector('.unsubscribe-msg');
const button = box?.querySelector('.unsubscribe-btn');

if (box) {
  if (!token || !storeEnabled) {
    box.querySelector('.unsubscribe-text').textContent = 'To stop receiving our emails, use the link at the bottom of any Siaram email, or email customerservice@siaramjewelry.com.';
    button.hidden = true;
  } else {
    button.addEventListener('click', async () => {
      button.disabled = true;
      msg.textContent = '';
      try {
        const res = await fetch(apiUrl('newsletter-unsubscribe'), {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Sorry, something went wrong. Please try again or email us.');
        box.querySelector('.unsubscribe-text').textContent = "You're unsubscribed. You won't receive marketing emails from Siaram Jewelry any more.";
        button.hidden = true;
      } catch (err) {
        msg.textContent = err.message;
        button.disabled = false;
      }
    });
  }
}
