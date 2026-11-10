// Buy a Gift Voucher page: sends the order to the voucher-request function, which emails the shop and the buyer.
// Without the online store set up, the form points to email instead.
import { apiUrl, escapeHtml, storeEnabled } from './store.js';

const form = document.querySelector('.voucher-form');

function amountOf(f) {
  const choice = f.elements.amount_choice.value;
  return choice === 'other' ? Number(f.elements.amount_other.value) : Number(choice);
}

function problem(f) {
  if (!f.elements.amount_choice.value) return ['Please choose an amount.', f.querySelector('[name=amount_choice]')];
  const amount = amountOf(f);
  if (!Number.isInteger(amount) || amount < 100) return ['Gift vouchers start at $100, in whole dollars.', f.elements.amount_other];
  if (!f.elements.recipient_name.value.trim()) return ["Please enter the recipient's name.", f.elements.recipient_name];
  const rEmail = f.elements.recipient_email;
  if (!rEmail.value.trim() && !f.elements.recipient_phone.value.trim()) {
    return ["Please add the recipient's email or WhatsApp number.", rEmail];
  }
  if (!rEmail.checkValidity()) return ["Please check the recipient's email address.", rEmail];
  for (const name of ['name', 'phone', 'email']) {
    const el = f.elements[name];
    if (!el.value.trim() || !el.checkValidity()) {
      return [name === 'email' ? 'Please enter a valid email address.' : 'Please fill in your details.', el];
    }
  }
  if (!f.elements.preferred_contact.value) return ['Please choose how you would like us to contact you.', f.querySelector('[name=preferred_contact]')];
  if (!f.elements.final_sale.checked) return ['Please confirm that you understand gift vouchers are final sale.', f.elements.final_sale];
  return null;
}

if (form) {
  const other = form.querySelector('.voucher-other');
  form.addEventListener('change', (e) => {
    if (e.target.name === 'amount_choice') other.hidden = e.target.value !== 'other';
  });
  if (!storeEnabled) {
    form.innerHTML = '<p class="field-note">Please <a href="mailto:customerservice@siaramjewelry.com?subject=Gift%20Voucher">email us</a> to order a gift voucher.</p>';
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
      const f = form.elements;
      const body = {
        amount: amountOf(form), recipient_name: f.recipient_name.value, recipient_email: f.recipient_email.value,
        recipient_phone: f.recipient_phone.value, send_to: 'recipient', send_on: f.send_on.value, message: f.message.value,
        name: f.name.value, email: f.email.value, phone: f.phone.value, preferred_contact: f.preferred_contact.value, final_sale: f.final_sale.checked, website: f.website.value,
      };
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        const res = await fetch(apiUrl('voucher-request'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const reply = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(reply.error || 'Sorry, your order could not be sent. Please try again or email us.');
        form.outerHTML = `<div class="order-done custom-done voucher-done">
          <span class="eyebrow">Request received</span>
          <h2>Thank you!</h2>
          <p class="order-ref">Your reference is <strong>${escapeHtml(reply.reference)}</strong></p>
          <p>We have emailed you a copy and will contact you ${reply.contact_by ? `by ${escapeHtml(reply.contact_by)}` : 'on WhatsApp'}
            to arrange payment by Whish payment link. Once it is paid, we issue the voucher and send it to the recipient.</p>
        </div>`;
      } catch (err) {
        msg.textContent = err.message;
        button.disabled = false;
        button.textContent = 'Send Voucher Request';
      }
    });
  }
}
