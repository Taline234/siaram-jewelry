// Return or Repair Request page: sends the form and any photos to the service-request function, which emails the shop.
// Without the online store set up, the form points to email instead.
import { apiUrl, escapeHtml, storeEnabled } from './store.js';

const form = document.querySelector('.service-form');
const MAX_FILES = 4;
const MAX_BYTES = 8 * 1024 * 1024;

function problem(f) {
  if (!f.elements.kind.value) return ['Please choose return, exchange or repair.', f.querySelector('[name=kind]')];
  for (const name of ['order_ref', 'piece', 'problem', 'cause', 'name', 'phone', 'email']) {
    const el = f.elements[name];
    if (!el.value.trim() || !el.checkValidity()) {
      return [name === 'email' ? 'Please enter a valid email address.' : 'Please fill in all the fields.', el];
    }
  }
  if (!f.elements.preferred_contact.value) return ['Please choose how you would like us to contact you.', f.querySelector('[name=preferred_contact]')];
  const files = [...f.elements.files.files];
  if (!files.length) return ['Please attach at least one photo of the piece.', f.elements.files];
  if (files.length > MAX_FILES) return [`Please attach up to ${MAX_FILES} photos.`, f.elements.files];
  const big = files.find((file) => file.size > MAX_BYTES);
  if (big) return [`"${big.name}" is larger than 8 MB. Please attach a smaller file.`, f.elements.files];
  return null;
}

if (form) {
  if (!storeEnabled) {
    form.innerHTML = '<p class="field-note">Please <a href="mailto:customerservice@siaramjewelry.com?subject=Return%20or%20repair">email us</a> with your order number, the piece, what happened and photos.</p>';
  } else {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = form.querySelector('.form-msg');
      msg.textContent = '';
      const bad = problem(form);
      if (bad) {
        msg.textContent = bad[0];
        bad[1].focus();
        return;
      }
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        const res = await fetch(apiUrl('service-request'), { method: 'POST', body: new FormData(form) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Sorry, your request could not be sent. Please try again or email us.');
        form.outerHTML = `<div class="order-done custom-done service-done">
          <span class="eyebrow">Request received</span>
          <h2>Thank you!</h2>
          <p class="order-ref">Your reference is <strong>${escapeHtml(body.reference)}</strong></p>
          <p>We have emailed you a copy and aim to respond within 2 days.
            Please do not send the piece until you receive our instructions.</p>
        </div>`;
      } catch (err) {
        msg.textContent = err.message;
        button.disabled = false;
        button.textContent = 'Send My Request';
      }
    });
  }
}
