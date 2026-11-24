// Custom page: the custom-piece request form. Sends the answers and any sketches to the custom-request
// function, which emails the shop. Without the online store set up, the form points to email instead.
import { apiUrl, escapeHtml, storeEnabled } from './store.js';

const form = document.querySelector('.custom-form');
const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;

const NOT_SURE = 'Not sure — please advise';
// A call, text or WhatsApp needs a phone number; an email reply does not.
const PHONE_NEEDED = ['Call', 'Text message', 'WhatsApp'];
const phoneNeeded = (f) => PHONE_NEEDED.includes(f.elements.preferred_contact.value);
// Guided: the customer is not sure of the piece, or knows the piece but not the design. We help instead of asking for the design.
const guided = (f) => f.elements.piece.value === 'Not sure yet' || f.elements.design.value === 'help';

// Only what the customer can see is checked: optional design details never block sending.
function problem(f) {
  if (!f.elements.piece.value) return ['Please choose the type of piece, or "Not sure yet".', f.querySelector('[name=piece]')];
  if (!guided(f) && !f.elements.design.value) return ['Please tell us whether you know what you would like it to look like.', f.querySelector('[name=design]')];
  if (!f.elements.preferred_contact.value) return ['Please choose how you would like us to contact you.', f.querySelector('[name=preferred_contact]')];
  // Guided requests have no design to describe: the guidance box asks what they would like help with.
  for (const name of [...(guided(f) ? [] : ['description']), 'name', 'email', ...(phoneNeeded(f) ? ['phone'] : [])]) {
    const el = f.elements[name];
    if (!el.value.trim() || !el.checkValidity()) {
      if (name === 'email') return ['Please enter a valid email address.', el];
      if (name === 'phone') return ['Please add your phone number so we can call, text or WhatsApp you, or choose email.', el];
      if (name === 'description') return ['Please tell us a little about your idea.', el];
      return ['Please fill in your name.', el];
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

// "No stones" and the other gemstones exclude each other; with no stones, the cut and setting questions are hidden.
function setupStones(f) {
  const boxes = [...f.querySelectorAll('[name=stones]')];
  const none = boxes.find((b) => b.value === 'No stones');
  const style = f.querySelector('.stone-style');
  const sync = () => { if (style) style.hidden = none.checked; };
  boxes.forEach((b) => b.addEventListener('change', () => {
    if (b === none && none.checked) boxes.forEach((o) => { if (o !== none && o.checked) { o.checked = false; o.dispatchEvent(new Event('change')); } });
    if (b !== none && b.checked && none.checked) none.checked = false;
    sync();
  }));
  sync();
}

// Guidance: the "Need a little guidance?" box shows for "Not sure yet", or once guidance is asked for.
// "Not sure" in a design field shows a short note beside it, with the guide and a link that asks for guidance
// (the same single checkbox, so the request is flagged once).
function setupGuidance(f) {
  const box = f.querySelector('.guidance-box');
  const check = f.elements.guidance;
  if (!box || !check) return;
  const sync = () => {
    box.hidden = !(guided(f) || check.checked || f.elements.call_requested.value === 'yes');
    const notSure = {
      gold: f.elements.gold.value === NOT_SURE,
      stones: Boolean(f.querySelector(`[name=stones][value="${NOT_SURE}"]`)?.checked),
      cut: f.elements.cut.value === NOT_SURE || f.elements.setting.value === NOT_SURE,
    };
    f.querySelectorAll('.not-sure-help').forEach((help) => {
      help.hidden = !notSure[help.dataset.helpFor];
      const ask = help.querySelector('.ask-guidance');
      ask.textContent = check.checked ? 'guidance requested ✓' : 'ask us to guide you';
      ask.setAttribute('aria-pressed', check.checked);
    });
  };
  f.addEventListener('change', sync);
  f.addEventListener('click', (e) => {
    if (!e.target.closest('.ask-guidance')) return;
    check.checked = true;
    sync();
  });
  sync();
}

// "Request a guidance call": a request, not a booking. Calls are Monday to Friday, 9am-5pm Beirut time.
const isWeekday = (iso) => { const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); return d >= 1 && d <= 5; };
const beirutToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' }).format(new Date());
function setupCallRequest(f) {
  const toggle = f.querySelector('.call-toggle');
  const fields = f.querySelector('.call-fields');
  if (!toggle || !fields) return;
  const notesLabel = f.querySelector('.guidance-notes-label');
  const route = f.querySelector('.message-route');
  // With a call, the notes are optional; without one, "Not sure yet" customers say what they would like guidance on.
  const label = () => {
    const byMessage = guided(f) && f.elements.call_requested.value !== 'yes';
    notesLabel.textContent = byMessage ? 'What would you like guidance on?' : 'Anything you’d like us to know before we talk? (optional)';
    f.elements.guidance_notes.required = byMessage;
    route.hidden = !byMessage;
    toggle.textContent = byMessage ? 'Request a guidance call instead' : 'Request a guidance call';
  };
  const set = (on) => {
    f.elements.call_requested.value = on ? 'yes' : '';
    fields.hidden = !on;
    toggle.hidden = on;
    toggle.setAttribute('aria-expanded', on);
    if (on) { f.elements.guidance.checked = true; f.elements.guidance.dispatchEvent(new Event('change', { bubbles: true })); }
    label();
  };
  f.elements.call_date.min = beirutToday();
  let declined = false;
  let autoCall = false; // the call request opened by itself on entering guided mode (not asked for by the customer)
  toggle.addEventListener('click', () => { declined = false; autoCall = false; set(true); f.elements.call_date.focus(); });
  f.querySelector('.call-cancel').addEventListener('click', () => {
    declined = true;
    set(false);
    if (guided(f)) f.elements.guidance_notes.focus(); else toggle.focus();
  });
  // Type of piece, then "Do you know what you'd like it to look like?":
  //   "Yes, I have an idea"        -> your idea and the optional design choices;
  //   "Not sure about the design"  -> the guidance box (a call, or tell us what you'd like help with);
  //   "Not sure yet" (the piece)   -> straight to guidance, no design question.
  // Size, inspiration, budget and date are for everyone once the piece is chosen (and the design question answered).
  const question = f.querySelector('.design-question');
  const ideas = f.querySelector('.idea-fields');
  const design = f.querySelector('.design-details');
  let wasGuided = false;
  let askedBefore = false; // guidance asked for from a design field before switching to guided mode
  const flow = () => {
    const piece = f.elements.piece.value;
    question.hidden = !piece || piece === 'Not sure yet';
    const isGuided = guided(f);
    f.classList.toggle('is-guided', isGuided);
    f.classList.toggle('is-not-sure', piece === 'Not sure yet');
    ideas.hidden = !piece || piece === 'Not sure yet' || !f.elements.design.value;
    design.hidden = isGuided;
    if (isGuided) {
      if (!wasGuided) askedBefore = f.elements.guidance.checked;
      f.elements.guidance.checked = true;
      if (!declined && f.elements.call_requested.value !== 'yes') { set(true); autoCall = true; }
      f.elements.guidance.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (wasGuided) {
      if (autoCall) { set(false); autoCall = false; }
      // Leaving guided mode: the guidance it implied goes (guidance asked for from a design field stays).
      f.elements.guidance.checked = askedBefore || f.elements.call_requested.value === 'yes';
      f.elements.guidance.dispatchEvent(new Event('change', { bubbles: true }));
    }
    wasGuided = isGuided;
    label();
  };
  f.querySelectorAll('[name=piece], [name=design]').forEach((r) => r.addEventListener('change', flow));
  flow();
}
function callProblem(f) {
  if (f.elements.call_requested.value !== 'yes') {
    if (f.elements.piece.value === 'Not sure yet' && !f.elements.guidance_notes.value.trim()) {
      return ['Please tell us what you would like guidance on, or request a guidance call.', f.elements.guidance_notes];
    }
    return null;
  }
  const day = f.elements.call_date.value;
  if (!day) return ['Please choose a day for your guidance call.', f.elements.call_date];
  if (!isWeekday(day)) return ['Guidance calls are Monday to Friday. Please choose a weekday.', f.elements.call_date];
  if (day < beirutToday()) return ['Please choose a day from today onwards.', f.elements.call_date];
  if (!f.elements.call_time.value) return ['Please choose a time between 9am and 5pm Beirut time.', f.elements.call_time];
  return null;
}

// The phone number is required only for a call, text or WhatsApp reply.
function setupPhone(f) {
  const phone = f.elements.phone;
  const label = f.querySelector('.phone-label');
  const sync = () => {
    phone.required = phoneNeeded(f);
    label.textContent = phone.required ? 'Phone (with country code)' : 'Phone (optional, with country code)';
  };
  f.querySelectorAll('[name=preferred_contact]').forEach((r) => r.addEventListener('change', sync));
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
    studio.hidden = Boolean(piece) && !any && !input.value;
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
  setupStones(form);
  setupGuidance(form);
  setupPhone(form);
  setupCallRequest(form);
  setupSizeStudio(form);
  if (!storeEnabled) {
    form.innerHTML = '<p class="field-note">Please <a href="mailto:customerservice@siaramjewelry.com?subject=Custom%20Piece%20Enquiry">email us</a> with your idea.</p>';
  } else {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = form.querySelector('.form-msg');
      msg.textContent = '';
      const bad = problem(form) || callProblem(form);
      if (bad) {
        msg.textContent = bad[0];
        bad[1].focus();
        return;
      }
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        const data = new FormData(form);
        // With no stones, a cut or setting chosen earlier does not apply.
        if (data.getAll('stones').includes('No stones')) { data.delete('cut'); data.delete('setting'); }
        // Guided: the design section is hidden, so anything typed or chosen there before switching is not sent.
        if (guided(form)) ['description', 'gold', 'stones', 'stones_other', 'cut', 'setting'].forEach((k) => data.delete(k));
        const res = await fetch(apiUrl('custom-request'), { method: 'POST', body: data });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Sorry, your request could not be sent. Please try again or email us.');
        form.outerHTML = `<div class="order-done custom-done">
          <span class="eyebrow">Request received</span>
          <h2>Thank you!</h2>
          <p class="order-ref">Your reference is <strong>${escapeHtml(body.reference)}</strong></p>
          <p>We have emailed you a copy and aim to reply within 2 days${form.elements.guidance.checked ? ', with some guidance to get you started' : ''}.</p>
          ${form.elements.call_requested.value === 'yes' ? `<p><strong>Your guidance call is requested, not yet booked.</strong> We will reply within 2 days to
            confirm a time (Monday to Friday, 9am to 5pm Beirut time) and email you the Microsoft Teams link.</p>` : ''}
        </div>`;
      } catch (err) {
        msg.textContent = err.message;
        button.disabled = false;
        button.textContent = 'Send my request';
      }
    });
  }
}
