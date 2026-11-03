// Custom page: the custom-piece request form. Sends the answers and any sketches to the custom-request
// function, which emails the shop. Without the online store set up, the form points to email instead.
import { apiUrl, escapeHtml, storeEnabled } from './store.js';

const form = document.querySelector('.custom-form');
const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;

function problem(f) {
  if (!f.elements.piece.value) return ['Please choose the type of piece.', f.querySelector('[name=piece]')];
  if (!f.elements.gold.value) return ['Please choose a gold colour, or "Not sure yet".', f.querySelector('[name=gold]')];
  if (f.querySelector('[name=stones][value=Other]').checked && !f.elements.stones_other.value.trim()) {
    return ['Please tell us which other gemstones you would like.', f.elements.stones_other];
  }
  for (const name of ['description', 'name', 'phone', 'email']) {
    const el = f.elements[name];
    if (!el.value.trim() || !el.checkValidity()) {
      return [name === 'email' ? 'Please enter a valid email address.' : 'Please fill in all required fields.', el];
    }
  }
  const files = [...f.elements.files.files];
  if (files.length > MAX_FILES) return [`Please attach up to ${MAX_FILES} files.`, f.elements.files];
  const big = files.find((file) => file.size > MAX_BYTES);
  if (big) return [`"${big.name}" is larger than 8 MB. Please attach a smaller file.`, f.elements.files];
  return null;
}

// "Other" gemstones: show a box to name them.
function setupStonesOther(f) {
  const other = f.querySelector('[name=stones][value=Other]');
  const box = f.querySelector('.stones-other');
  if (!other || !box) return;
  const sync = () => {
    box.hidden = !other.checked;
    if (!other.checked) f.elements.stones_other.value = '';
  };
  other.addEventListener('change', () => {
    sync();
    if (other.checked) f.elements.stones_other.focus();
  });
  sync();
}

// Size or length: shows the picker for the chosen piece (a neckline drawing for necklaces, sizes for rings and so on).
// A choice fills the "type your own" box, which is what is sent.
function setupSizeStudio(f) {
  const studio = f.querySelector('.size-studio');
  if (!studio) return;
  const input = f.elements.size;
  const hint = studio.querySelector('.size-studio-hint');
  const mark = () => {
    studio.querySelectorAll('[data-size]').forEach((el) => {
      const on = el.dataset.size === input.value;
      el.classList.toggle('is-on', on);
      if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', on);
    });
  };
  const showPanel = () => {
    const piece = f.elements.piece.value;
    let any = false;
    studio.querySelectorAll('.size-panel').forEach((panel) => {
      panel.hidden = !panel.dataset.for.split('|').includes(piece);
      any ||= !panel.hidden;
    });
    hint.hidden = Boolean(piece);
    if (piece && !any) hint.hidden = true;
  };
  studio.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-size]');
    if (!choice) return;
    input.value = input.value === choice.dataset.size ? '' : choice.dataset.size;
    mark();
  });
  studio.querySelectorAll('.neck-line').forEach((line) => {
    const button = studio.querySelector(`.neck-choices [data-size="${line.dataset.size}"]`);
    line.addEventListener('mouseenter', () => button?.classList.add('is-hover'));
    line.addEventListener('mouseleave', () => button?.classList.remove('is-hover'));
    button?.addEventListener('mouseenter', () => line.classList.add('is-hover'));
    button?.addEventListener('mouseleave', () => line.classList.remove('is-hover'));
    button?.addEventListener('focus', () => line.classList.add('is-hover'));
    button?.addEventListener('blur', () => line.classList.remove('is-hover'));
  });
  input.addEventListener('input', mark);
  f.querySelectorAll('[name=piece]').forEach((r) => r.addEventListener('change', showPanel));
  showPanel();
  mark();
}

if (form) {
  setupStonesOther(form);
  setupSizeStudio(form);
  if (!storeEnabled) {
    form.innerHTML = '<p class="field-note">Please <a href="mailto:customerservice@siaramjewelry.com?subject=Custom%20Piece%20Enquiry">email us</a> with your idea.</p>';
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
        const res = await fetch(apiUrl('custom-request'), { method: 'POST', body: new FormData(form) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Sorry, your request could not be sent. Please try again or email us.');
        form.outerHTML = `<div class="order-done custom-done">
          <span class="eyebrow">Request received</span>
          <h2>Thank you!</h2>
          <p class="order-ref">Your reference is <strong>${escapeHtml(body.reference)}</strong></p>
          <p>We have emailed you a copy and will reply within 3 to 5 business days.</p>
        </div>`;
      } catch (err) {
        msg.textContent = err.message;
        button.disabled = false;
        button.textContent = 'Send My Request';
      }
    });
  }
}
