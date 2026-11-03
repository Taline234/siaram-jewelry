// POST /functions/v1/service-request — the return and repair request form (return-repair.html), as multipart form data so
// customers can attach photos. Saves the request with an RR number, emails it to the shop with the photos attached,
// and sends the customer a confirmation telling them not to post anything before we reply.
import { Buffer } from 'node:buffer';
import { CustomerError, configured, emailLayout, env, escapeHtml, json, rpc, sendEmail } from '../store.mjs';

const KINDS = ['Return', 'Exchange', 'Repair'];
const MAX_FILES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const FILE_TYPES = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;

const text = (form, name, max = 200) => String(form.get(name) ?? '').trim().slice(0, max);

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
      kind: KINDS.includes(text(form, 'kind')) ? text(form, 'kind') : '',
      order_ref: text(form, 'order_ref', 40),
      piece: text(form, 'piece', 120),
      problem: text(form, 'problem', 3000),
      cause: text(form, 'cause', 3000),
      name: text(form, 'name'),
      email: text(form, 'email'),
      phone: text(form, 'phone', 40),
    };
    if (!request.kind) throw new CustomerError('Please choose return, exchange or repair.');
    for (const [field, label] of [['order_ref', 'your order or invoice number'], ['piece', 'the name of the piece'],
      ['problem', "what's wrong"], ['cause', 'how the issue happened'], ['name', 'your name'], ['phone', 'your WhatsApp number']]) {
      if (!request[field]) throw new CustomerError(`Please tell us ${label}.`);
    }

    const files = form.getAll('files').filter((f) => f && typeof f === 'object' && f.size > 0);
    if (files.length > MAX_FILES) throw new CustomerError(`Please attach up to ${MAX_FILES} photos.`);
    const attachments = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) throw new CustomerError(`"${f.name}" is larger than 8 MB. Please attach a smaller file.`);
      if (!FILE_TYPES.test(f.type)) throw new CustomerError(`"${f.name}" is not a photo or PDF.`);
      attachments.push({ filename: f.name.replace(/[^\w.\- ]+/g, '_').slice(0, 80), content: Buffer.from(await f.arrayBuffer()) });
    }

    const { reference } = await rpc('save_service_request', { p: { ...request, files: attachments.map((a) => a.filename) } });

    const rows = [['Request', request.kind], ['Order / invoice', request.order_ref.toUpperCase()], ['Piece', request.piece]]
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b665a">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`).join('');
    const details = `<table role="presentation" style="font-size:15px;margin:8px 0 14px">${rows}</table>
      <p style="font-size:14px;color:#6b665a;margin:0">What's wrong</p>
      <p style="font-size:15px;line-height:1.6;white-space:pre-line;margin:2px 0 12px">${escapeHtml(request.problem)}</p>
      <p style="font-size:14px;color:#6b665a;margin:0">How it happened</p>
      <p style="font-size:15px;line-height:1.6;white-space:pre-line;margin:2px 0 12px">${escapeHtml(request.cause)}</p>`;
    const what = request.kind.toLowerCase();
    await Promise.all([
      sendEmail({
        to: env('ORDER_NOTIFY_EMAIL'),
        replyTo: request.email,
        subject: `${request.kind} request ${reference} — ${request.order_ref.toUpperCase()} (${request.name})`,
        html: emailLayout(`${request.kind} request ${reference}`,
          `<p style="font-size:15px;line-height:1.6"><strong>${escapeHtml(request.name)}</strong> &middot; ${escapeHtml(request.email)}
           &middot; WhatsApp ${escapeHtml(request.phone)}</p>${details}
           <p style="font-size:14px;line-height:1.6">${attachments.length ? `${attachments.length} photo(s) attached.` : 'No photos attached.'}
           Reply to this email to answer the customer. The request is saved in Supabase (service_requests).</p>`),
        attachments,
      }),
      sendEmail({
        to: request.email,
        subject: `Your ${what} request ${reference}`,
        html: emailLayout(`Thank you, ${request.name.split(' ')[0]}`,
          `<p style="font-size:15px;line-height:1.6">We have received your ${what} request (reference
           <strong>${escapeHtml(reference)}</strong>). We will reply within 3 to 5 business days with the next steps.</p>
           <p style="font-size:15px;line-height:1.6"><strong>Please do not send the piece until you receive our instructions.</strong></p>${details}`),
      }),
    ]);
    return json({ reference });
  } catch (err) {
    if (err instanceof CustomerError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Sorry, your request could not be sent. Please try again or email us.' }, 500);
  }
};
