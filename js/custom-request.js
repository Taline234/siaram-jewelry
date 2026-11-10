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
  if (!f.elements.preferred_contact.value) return ['Please choose how you would like us to contact you.', f.querySelector('[name=preferred_contact]')];
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
    // Pendants and charms hang a gold pendant from the chain instead of a plain chain.
    studio.querySelector('.neck-picker')?.classList.toggle('is-pendant', piece === 'Pendant or charm');
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
  const choose = (value) => {
    input.value = value;
    mark();
  };
  setupRingDial(studio, choose);
  studio.querySelectorAll('.fit-picker').forEach((picker) => setupFitDial(picker, choose));
  input.addEventListener('input', mark);
  f.querySelectorAll('[name=piece]').forEach((r) => r.addEventListener('change', showPanel));
  showPanel();
  mark();
}

// Ring sizes from the size guide: EU, US and inside diameter in mm.
const RINGS = [[44, '3', 14.0], [45, '3.5', 14.3], [47, '4', 15.0], [48, '4.5', 15.3], [49, '5', 15.6], [50, '5.5', 15.9],
  [51, '6', 16.2], [52, '6.5', 16.6], [54, '7', 17.2], [55, '7.5', 17.5], [56, '8', 17.8], [58, '8.5', 18.5], [59, '9', 18.8],
  [61, '9.5', 19.4], [62, '10', 19.7], [63, '10.5', 20.1], [65, '11', 20.7], [66, '11.5', 21.0], [67, '12', 21.3],
  [69, '12.5', 22.0], [70, '13', 22.3]];

// Ring: tap a finger on the drawn hand (or its button) and the ring appears on it; slide to the size. Either
// one fills the size box, e.g. "EU 54 · US 7, ring finger".
function setupRingDial(studio, choose) {
  const picker = studio.querySelector('.ring-picker');
  if (!picker) return;
  const range = picker.querySelector('.ring-range');
  const readout = picker.querySelector('.dial-readout');
  let finger = '';
  let sized = false;
  const draw = (fill) => {
    const [eu, us, mm] = RINGS[Number(range.value)];
    picker.querySelectorAll('.finger-ring').forEach((g) => g.classList.toggle('is-on', g.dataset.finger === finger));
    picker.querySelectorAll('.finger').forEach((g) => g.classList.toggle('is-on', g.dataset.finger === finger));
    picker.querySelectorAll('.finger-choice').forEach((b) => b.setAttribute('aria-pressed', b.dataset.finger === finger));
    readout.querySelector('strong').textContent = `EU ${eu}`;
    readout.querySelector('span').textContent = `US ${us} · ${mm.toFixed(1)} mm inside${finger ? ` · ${finger} finger` : ''}`;
    range.setAttribute('aria-valuetext', `EU ${eu}, US ${us}, ${mm.toFixed(1)} millimetres inside`);
    if (!fill) return;
    const size = sized ? `EU ${eu} · US ${us}` : '';
    const where = finger ? `${finger} finger` : '';
    choose([size, where].filter(Boolean).join(', '));
  };
  const pick = (name) => {
    finger = finger === name ? '' : name;
    draw(true);
  };
  picker.querySelectorAll('.finger').forEach((g) => g.addEventListener('click', () => pick(g.dataset.finger)));
  picker.querySelectorAll('.finger-choice').forEach((b) => b.addEventListener('click', () => pick(b.dataset.finger)));
  range.addEventListener('input', () => {
    sized = true;
    draw(true);
  });
  draw(false);
}

// Bracelet and anklet: measure the wrist or ankle, choose a close (+1 cm) or loose (+2 cm) fit, as in the size
// guide. The drawing shows the chain snug at the wrist or ankle, or draping lower; any change fills the size box.
function setupFitDial(picker, choose) {
  const range = picker.querySelector('.limb-range');
  const readout = picker.querySelector('.dial-readout');
  const fits = [...picker.querySelectorAll('.fit-choice')];
  const piece = picker.dataset.piece;
  const limb = picker.dataset.limb.toLowerCase();
  let fit = 'close';
  const draw = (fill) => {
    const cm = Number(range.value);
    const length = cm + (fit === 'close' ? 1 : 2);
    picker.querySelectorAll('.fit-chain-group').forEach((g) => g.classList.toggle('is-on', g.dataset.fit === fit));
    readout.querySelector('strong').textContent = `${piece} ${length} cm`;
    readout.querySelector('span').textContent = `${limb[0].toUpperCase() + limb.slice(1)} ${cm} cm · ${fit} fit`;
    range.setAttribute('aria-valuetext', `${cm} centimetres`);
    fits.forEach((b) => b.setAttribute('aria-pressed', b.dataset.fit === fit));
    if (fill) choose(`${piece} ${length} cm (${limb} ${cm} cm, ${fit} fit)`);
  };
  range.addEventListener('input', () => draw(true));
  fits.forEach((b) => b.addEventListener('click', () => {
    fit = b.dataset.fit;
    draw(true);
  }));
  draw(false);
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

// "I have nothing to upload": clears and switches off the photo field.
document.addEventListener('change', (event) => {
  if (event.target.name !== 'no_upload') return;
  const files = event.target.form && event.target.form.elements.files;
  if (!files) return;
  if (event.target.checked) files.value = '';
  files.disabled = event.target.checked;
  files.closest('.field').classList.toggle('is-off', event.target.checked);
});
