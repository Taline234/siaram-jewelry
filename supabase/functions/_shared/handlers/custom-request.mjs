// POST /functions/v1/custom-request — the custom-piece request form on the Custom page (multipart form data,
// so customers can attach sketches or photos). Saves the request, emails it to the shop with the files attached,
// and sends the customer a confirmation.
import { Buffer } from 'node:buffer';
import { configured, contactMethod, CustomerError, emailLayout, env, escapeHtml, json, replyBy, rpc, sendEmail } from '../store.mjs';

// "Not sure — please advise" is offered in every design field; older forms sent "Not sure yet" or
// "Not sure, I need guidance", which are still accepted.
const NOT_SURE = 'Not sure — please advise';
const PIECES = ['Ring', 'Necklace', 'Bracelet', 'Earrings', 'Anklet', 'Pendant or charm', 'Other', 'Not sure yet'];
const GOLDS = ['Yellow gold', 'Rose gold', 'White gold', NOT_SURE, 'Not sure yet'];
const STONES = ['No stones', 'Diamond', 'White zircon', 'Black zircon', 'Emerald', 'Ruby', 'Sapphire', 'Pearl',
  'Turquoise', 'Black onyx', 'Birthstone', 'My own stone', 'Other', NOT_SURE, 'Not sure, I need guidance'];
const CUTS = ['Round brilliant', 'Oval', 'Princess', 'Cushion', 'Emerald cut', 'Pear', 'Marquise', 'Heart', 'Baguette',
  'Cabochon', NOT_SURE, 'Not sure yet'];
const SETTINGS = ['Prong (claw)', 'Bezel', 'Pavé', 'Channel', 'Halo', 'Flush', 'Bar', 'Cluster', NOT_SURE, 'Not sure yet'];
const BUDGETS = ['Under $500', '$500–$1,000', '$1,000–$2,000', 'Over $2,000', 'Not sure yet'];
const MAX_FILES = 3;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const FILE_TYPES = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;

// Guidance calls: a request the team confirms. Monday to Friday, 9am-5pm Beirut time, up to 30 minutes, so the
// last start is 4:30pm. The owner works from Ghana, so the shop's email also gives the time there.
const CALL_TIMES = Array.from({ length: 16 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const weekday = (iso) => { const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); return d >= 1 && d <= 5; };
const todayIn = (zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date());
const clock = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${(h + 11) % 12 + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const longDate = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(`${iso}T12:00:00Z`));
// The same moment in Ghana (GMT): Beirut is 2 hours ahead in winter and 3 in summer.
function ghanaTime(iso, hhmm) {
  const guess = new Date(`${iso}T${hhmm}:00Z`);
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(guess).split(':').map(Number);
  const offset = ((h * 60 + m) - (guess.getUTCHours() * 60 + guess.getUTCMinutes()) + 1440) % 1440;
  const ghana = new Date(guess.getTime() - offset * 60000);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true }).format(ghana);
}

const text = (form, name, max = 200) => String(form.get(name) ?? '').trim().slice(0, max);
const oneOf = (value, list) => (list.includes(value) ? value : '');

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!configured()) return json({ error: 'The request form is not available yet. Please email us instead.' }, 503);
  try {
    let form;
    try {
      form = await req.formData();
    } catch {
      throw new CustomerError('Your request could not be read. Please try again.');
    }
    if (text(form, 'website')) return json({ error: 'Invalid request.' }, 400); // spam trap

    const request = {
      name: text(form, 'name'),
      email: text(form, 'email'),
      phone: text(form, 'phone', 40),
      preferred_contact: contactMethod(text(form, 'preferred_contact', 20)),
      piece: oneOf(text(form, 'piece'), PIECES),
      gold: oneOf(text(form, 'gold'), GOLDS),
      stones: form.getAll('stones').map(String).filter((s) => STONES.includes(s))
        .map((s) => (s === 'Other' && text(form, 'stones_other') ? `Other: ${text(form, 'stones_other')}` : s)),
      cut: oneOf(text(form, 'cut'), CUTS),
      setting: oneOf(text(form, 'setting'), SETTINGS),
      size: text(form, 'size', 80),
      description: text(form, 'description', 4000),
      occasion: /^\d{4}-\d{2}-\d{2}$/.test(text(form, 'occasion')) ? text(form, 'occasion') : '',
      budget: oneOf(text(form, 'budget'), BUDGETS),
      // "I'd like some guidance": flags the request for the team; no call is booked.
      guidance: text(form, 'guidance') === 'yes',
      call_requested: text(form, 'call_requested') === 'yes',
      call_date: text(form, 'call_date', 10),
      call_time: text(form, 'call_time', 5),
      call_note: text(form, 'call_note'),
    };
    if (request.call_requested) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(request.call_date)) throw new CustomerError('Please choose a day for your guidance call.');
      if (!weekday(request.call_date)) throw new CustomerError('Guidance calls are Monday to Friday. Please choose a weekday.');
      if (request.call_date < todayIn('Asia/Beirut')) throw new CustomerError('Please choose a day from today onwards.');
      if (!CALL_TIMES.includes(request.call_time)) throw new CustomerError('Please choose a time between 9am and 5pm Beirut time.');
      request.guidance = true;
    } else {
      request.call_date = '';
      request.call_time = '';
      request.call_note = '';
    }
    // Design details are optional. With no stones, a cut or setting does not apply.
    if (request.stones.includes('No stones')) {
      request.stones = ['No stones'];
      request.cut = '';
      request.setting = '';
    }
    if (!request.preferred_contact) throw new CustomerError('Please choose how you would like us to contact you.');
    if (!request.piece) throw new CustomerError('Please choose the type of piece.');
    if (!request.description) throw new CustomerError('Please tell us a little about your idea.');
    // A call, text or WhatsApp reply needs a phone number; an email reply does not.
    if (request.preferred_contact !== 'Email' && !request.phone) {
      throw new CustomerError('Please add your phone number so we can call, text or WhatsApp you, or choose email.');
    }

    const files = form.getAll('files').filter((f) => f && typeof f === 'object' && f.size > 0);
    if (files.length > MAX_FILES) throw new CustomerError(`Please attach up to ${MAX_FILES} files.`);
    const attachments = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) throw new CustomerError(`"${f.name}" is larger than 8 MB. Please attach a smaller file.`);
      if (!FILE_TYPES.test(f.type)) throw new CustomerError(`"${f.name}" is not a photo or PDF.`);
      attachments.push({ filename: f.name.replace(/[^\w.\- ]+/g, '_').slice(0, 80), content: Buffer.from(await f.arrayBuffer()) });
    }

    const { reference } = await rpc('save_custom_request', { p: { ...request, files: attachments.map((a) => a.filename) } });

    const rows = [
      ['Piece', request.piece], ['Guidance', request.guidance ? 'Requested' : '—'], ['Gold', request.gold || '—'],
      ['Stones', request.stones.join(', ') || '—'],
      ['Cut', request.cut || '—'], ['Setting', request.setting || '—'], ['Size', request.size || '—'], ['Occasion date', request.occasion || '—'],
      ['Budget', request.budget || '—'],
    ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b665a">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`).join('');
    const callFor = request.call_requested ? `${longDate(request.call_date)}, ${clock(request.call_time)} Beirut time` : '';
    const callRules = `<ul style="font-size:14px;line-height:1.6;margin:6px 0 14px;padding-left:18px">
      <li>This is a request: the call is booked only once we confirm a time with you. We reply within 2 days.</li>
      <li>Calls are free, up to 30 minutes, Monday to Friday, 9am to 5pm Beirut time, by Microsoft Teams video (we email you the link).</li>
      <li>To cancel or change the time, please tell us at least 12 hours before.</li>
      <li>If you are more than 10 minutes late, the call is cancelled; you are welcome to request another.</li></ul>`;
    const details = `<table role="presentation" style="font-size:15px;margin:8px 0 14px">${rows}</table>
      <p style="font-size:15px;line-height:1.6;white-space:pre-line">${escapeHtml(request.description)}</p>`;
    await Promise.all([
      sendEmail({
        to: env('ORDER_NOTIFY_EMAIL'),
        replyTo: request.email,
        subject: `Custom request ${reference} — ${request.piece} (${request.name})${request.call_requested ? ' — guidance call requested'
          : request.guidance ? ' — guidance requested' : ''}`,
        html: emailLayout(`Custom request ${reference}`,
          `<p style="font-size:15px;line-height:1.6"><strong>${escapeHtml(request.name)}</strong> &middot; ${escapeHtml(request.email)}
           &middot; Phone ${escapeHtml(request.phone || '—')}<br>${request.guidance
             ? '<strong style="color:#8a2c1c">Guidance requested: the customer would like help choosing.</strong><br>' : ''}${request.call_requested
             ? `<strong style="color:#8a2c1c">Guidance call requested for ${escapeHtml(callFor)}
                (${escapeHtml(ghanaTime(request.call_date, request.call_time))} in Ghana).</strong>
                ${request.call_note ? `Other times: ${escapeHtml(request.call_note)}.` : ''}
                Reply within 2 days to confirm a time and send the Microsoft Teams link.<br>` : ''}<strong>Preferred contact: ${escapeHtml(request.preferred_contact)}</strong></p>${details}
           <p style="font-size:14px;line-height:1.6">${attachments.length ? `${attachments.length} file(s) attached.` : 'No files attached.'}
           Reply to this email to answer the customer. The request is saved in Supabase (custom_requests).</p>`),
        attachments,
      }),
      sendEmail({
        to: request.email,
        subject: `Your custom piece request ${reference}`,
        html: emailLayout(`Thank you, ${request.name.split(' ')[0]}!`,
          `<p style="font-size:15px;line-height:1.6">We have received your request for a custom piece (reference
           <strong>${escapeHtml(reference)}</strong>). We aim to respond by ${escapeHtml(replyBy(request.preferred_contact))}
           within 2 days with ideas, questions or a first design and quote.${request.guidance
             ? ' You asked for some guidance, so we will help you find a starting point.' : ''}</p>${request.call_requested
             ? `<p style="font-size:15px;line-height:1.6"><strong>Your guidance call is requested, not yet booked.</strong> You asked for
                ${escapeHtml(callFor)}. We will reply within 2 days to confirm a time and email you the Microsoft Teams link.</p>${callRules}` : ''}${details}`),
      }),
    ]);
    return json({ reference });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Sorry, your request could not be sent. Please try again or email us.' }, 500);
  }
};
