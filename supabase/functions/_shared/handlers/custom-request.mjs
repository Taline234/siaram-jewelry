// POST /functions/v1/custom-request — the custom-piece request form on the Custom page (multipart form data,
// so customers can attach sketches or photos). Saves the request, emails it to the shop with the files attached,
// and sends the customer a confirmation.
import { Buffer } from 'node:buffer';
import { configured, contactMethod, CustomerError, emailLayout, env, escapeHtml, json, replyBy, rpc, sendEmail } from '../store.mjs';

const PIECES = ['Ring', 'Necklace', 'Bracelet', 'Earrings', 'Anklet', 'Pendant or charm', 'Other', 'Not sure yet'];
const GOLDS = ['Yellow gold', 'Rose gold', 'White gold', 'Not sure yet'];
const STONES = ['No stones', 'Diamond', 'White zircon', 'Black zircon', 'Emerald', 'Ruby', 'Sapphire', 'Pearl',
  'Turquoise', 'Black onyx', 'Birthstone', 'My own stone', 'Other', 'Not sure, I need guidance'];
const CUTS = ['Round brilliant', 'Oval', 'Princess', 'Cushion', 'Emerald cut', 'Pear', 'Marquise', 'Heart', 'Baguette',
  'Cabochon', 'Not sure yet'];
const SETTINGS = ['Prong (claw)', 'Bezel', 'Pavé', 'Channel', 'Halo', 'Flush', 'Bar', 'Cluster', 'Not sure yet'];
const BUDGETS = ['Under $500', '$500–$1,000', '$1,000–$2,000', 'Over $2,000', 'Not sure yet'];
const MAX_FILES = 3;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const FILE_TYPES = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;

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
    };
    if (!request.preferred_contact) throw new CustomerError('Please choose how you would like us to contact you.');
    if (!request.piece) throw new CustomerError('Please choose the type of piece.');
    if (!request.gold) throw new CustomerError('Please choose a gold colour.');
    if (request.stones.includes('Other')) throw new CustomerError('Please tell us which other gemstones you would like.');

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
      ['Piece', request.piece], ['Gold', request.gold], ['Stones', request.stones.join(', ') || '—'],
      ['Cut', request.cut || '—'], ['Setting', request.setting || '—'], ['Size', request.size || '—'], ['Occasion date', request.occasion || '—'],
      ['Budget', request.budget || '—'],
    ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b665a">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`).join('');
    const details = `<table role="presentation" style="font-size:15px;margin:8px 0 14px">${rows}</table>
      <p style="font-size:15px;line-height:1.6;white-space:pre-line">${escapeHtml(request.description)}</p>`;
    await Promise.all([
      sendEmail({
        to: env('ORDER_NOTIFY_EMAIL'),
        replyTo: request.email,
        subject: `Custom request ${reference} — ${request.piece} (${request.name})`,
        html: emailLayout(`Custom request ${reference}`,
          `<p style="font-size:15px;line-height:1.6"><strong>${escapeHtml(request.name)}</strong> &middot; ${escapeHtml(request.email)}
           &middot; Phone ${escapeHtml(request.phone)}<br><strong>Preferred contact: ${escapeHtml(request.preferred_contact)}</strong></p>${details}
           <p style="font-size:14px;line-height:1.6">${attachments.length ? `${attachments.length} file(s) attached.` : 'No files attached.'}
           Reply to this email to answer the customer. The request is saved in Supabase (custom_requests).</p>`),
        attachments,
      }),
      sendEmail({
        to: request.email,
        subject: `Your custom piece request ${reference}`,
        html: emailLayout(`Thank you, ${request.name.split(' ')[0]}!`,
          `<p style="font-size:15px;line-height:1.6">We have received your request for a custom piece (reference
           <strong>${escapeHtml(reference)}</strong>). We will reply by ${escapeHtml(replyBy(request.preferred_contact))}
           within 3 to 5 business days with ideas, questions or a first design and quote.</p>${details}`),
      }),
    ]);
    return json({ reference });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Sorry, your request could not be sent. Please try again or email us.' }, 500);
  }
};
