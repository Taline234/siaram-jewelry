// The two PDFs sent with every order, drawn after the owner's own Canva receipts (e.g. "Siaram Jewelry Invoice S014"):
//   receiptPdf        the receipt: invoice number, customer, and each piece with SKU, materials,
//                     size, price, quantity and totals (detailed enough for customs)
//   careWarrantyPdf   the thank-you letter, the filled-in warranty card and the care guide
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { ASSETS } from './pdf-assets.mjs';
import { CATALOGUE } from './catalogue.mjs';

const W = 595.28;
const H = 841.89;
const M = 40;
const C = {
  paper: rgb(0.945, 0.933, 0.914),
  panel: rgb(0.906, 0.886, 0.851),
  green: rgb(0.039, 0.231, 0.18),
  ink: rgb(0.263, 0.22, 0.176),
  rule: rgb(0.725, 0.682, 0.608),
};
const METALS = { yellow: '18k yellow gold', rose: '18k rose gold', white: '18k white gold' };

const b64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
const money = (v) => `$${Number(v || 0).toFixed(2)}`;
const day = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);

async function newDoc() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setAuthor('Siaram Jewelry');
  doc.setCreator('siaramjewelry.com');
  const f = {
    serif: await doc.embedFont(b64(ASSETS.serif), { subset: true }),
    italic: await doc.embedFont(b64(ASSETS.serifItalic), { subset: true }),
    sans: await doc.embedFont(b64(ASSETS.sans), { subset: true }),
    sansMed: await doc.embedFont(b64(ASSETS.sansMedium), { subset: true }),
  };
  const logo = await doc.embedPng(b64(ASSETS.logo));
  const qr = await doc.embedPng(b64(ASSETS.instagramQr));
  return { doc, f, logo, qr };
}

function page(doc) {
  const p = doc.addPage([W, H]);
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.paper });
  return p;
}

// Split text into lines that fit `width`; "\n" starts a new line.
function wrap(text, font, size, width) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

function text(p, str, x, y, font, size, color = C.ink, align = 'left') {
  const w = font.widthOfTextAtSize(str, size);
  const dx = align === 'right' ? -w : align === 'center' ? -w / 2 : 0;
  p.drawText(str, { x: x + dx, y, size, font, color });
}

// Draws wrapped text from top line `y` down; returns the y below it.
function para(p, str, x, y, width, font, size, color = C.ink, lead = 1.35) {
  for (const line of wrap(str, font, size, width)) {
    text(p, line, x, y, font, size, color);
    y -= size * lead;
  }
  return y;
}

function rule(p, x1, y, x2, color = C.rule, thickness = 0.6) {
  p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function centredLogo(p, f, logo, top) {
  const w = 190;
  const h = (w * logo.height) / logo.width;
  p.drawImage(logo, { x: (W - w) / 2, y: top - h, width: w, height: h });
  text(p, 'Simply Elegant. Endlessly Yours.', W / 2, top - h - 14, f.italic, 11, C.green, 'center');
  const y = top - h - 34;
  rule(p, W / 2 - 90, y, W / 2 - 10, C.green);
  rule(p, W / 2 + 10, y, W / 2 + 90, C.green);
  p.drawRectangle({ x: W / 2 - 4, y: y - 4, width: 8, height: 8, rotate: { type: 'degrees', angle: 45 }, borderColor: C.green, borderWidth: 0.7 });
  return y - 30;
}

// Plain-language description of a line: materials, stones, pearls and size or length.
export function itemDescription(item) {
  const c = CATALOGUE[item.sku] || {};
  const parts = [METALS[item.metal] || METALS.yellow];
  if (c.stone) parts.push(`Stones: ${c.stone}`);
  if (c.other) parts.push(c.other);
  const details = (c.details || []).filter(([k]) => !(item.size && k === 'Length' && c.category === 'Bracelets'));
  if (item.size) parts.push(c.category === 'Rings' ? `Ring size ${item.size}` : `Length ${item.size}`);
  for (const [k, v] of details) parts.push(`${k}: ${v}`);
  return parts.join('\n');
}

function paymentLabel(order) {
  if (Number(order.total) <= 0) return 'Gift voucher';
  return order.payment_method === 'whish' ? 'Whish' : 'Cash on delivery';
}

function billTo(order) {
  const lines = [order.customer_name];
  lines.push([order.street, order.building && `Building ${order.building}`, order.floor && `Floor ${order.floor}`].filter(Boolean).join(', '));
  lines.push([order.city, order.governorate, 'Lebanon'].filter(Boolean).join(', '));
  lines.push(order.phone, order.email);
  return lines.filter(Boolean);
}

// Small line icons, drawn in a 24-unit box (SVG coordinates, y down).
const ICONS = {
  instagram: { stroke: ['M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z', 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z'],
               fill: ['M17.5 5.3a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 1 0 0-2.4z'] },
  whatsapp: { stroke: ['M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z'],
              fill: ['M8.5 7.5c.3-.6.8-.6 1.1-.1l1 1.8c.2.4.1.8-.2 1.1l-.6.6c.5 1.2 1.6 2.3 2.8 2.8l.6-.6c.3-.3.7-.4 1.1-.2l1.8 1c.5.3.5.8-.1 1.1-1 .7-2.2.8-3.3.3-2.2-1-4-2.8-5-5-.5-1.1-.4-2.3.3-3.3z'] },
  email: { stroke: ['M3 5h18v14H3z', 'M3 5l9 7l9-7'], fill: [] },
};

// Draws an icon `size` points wide with its bottom-left corner at (x, y).
function icon(p, name, x, y, size, color = C.green) {
  const scale = size / 24;
  for (const path of ICONS[name].stroke) p.drawSvgPath(path, { x, y: y + size, scale, borderColor: color, borderWidth: 1.6 });
  for (const path of ICONS[name].fill) p.drawSvgPath(path, { x, y: y + size, scale, color });
}

// Icon followed by text; returns the x after it.
function iconText(p, f, name, str, x, y, size = 8) {
  icon(p, name, x, y - 1.5, size + 2);
  text(p, str, x + size + 6, y, f.sans, size, C.ink);
  return x + size + 6 + f.sans.widthOfTextAtSize(str, size);
}

// Columns as on the owner's receipt: Product (the SKU), Item Description, Price, Qty, Total.
const COLS = [['Product', 70], ['Item Description', 247], ['Price', 70], ['Qty', 38], ['Total', 90]];
const TABLE_W = COLS.reduce((s, [, w]) => s + w, 0);
const MIN_ROWS = 8;

function gridRow(p, y, h, fill) {
  let x = M;
  p.drawRectangle({ x: M, y: y - h, width: TABLE_W, height: h, borderColor: C.rule, borderWidth: 0.6, ...(fill ? { color: fill } : {}) });
  for (const [, w] of COLS.slice(0, -1)) {
    x += w;
    p.drawLine({ start: { x, y }, end: { x, y: y - h }, thickness: 0.6, color: C.rule });
  }
}

function tableHeader(p, f, y) {
  gridRow(p, y, 24, C.paper);
  let x = M;
  for (const [label, w] of COLS) {
    text(p, label, x + w / 2, y - 15.5, f.serif, 10.5, C.ink, 'center');
    x += w;
  }
  return y - 24;
}

function whitePage(doc) {
  const p = doc.addPage([W, H]);
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  return p;
}

export async function receiptPdf(order, when = new Date()) {
  const { doc, f, logo } = await newDoc();
  doc.setTitle(`Siaram Jewelry receipt ${order.reference}`);
  let p = whitePage(doc);

  // Header: RECEIPT on the left; logo with Instagram, WhatsApp and email on the right
  text(p, 'RECEIPT', M, H - 82, f.serif, 36, C.green);
  const lw = 160;
  const lh = (lw * logo.height) / logo.width;
  p.drawImage(logo, { x: W - M - lw, y: H - 34 - lh, width: lw, height: lh });
  let cy = H - 46 - lh;
  const igW = 14 + f.sans.widthOfTextAtSize('@siaram.jewelry', 8);
  const waW = 14 + f.sans.widthOfTextAtSize('+961 76 052 068', 8);
  let cx = W - M - (igW + 16 + waW);
  cx = iconText(p, f, 'instagram', '@siaram.jewelry', cx, cy) + 16;
  iconText(p, f, 'whatsapp', '+961 76 052 068', cx, cy);
  cy -= 15;
  const mail = 'customerservice@siaramjewelry.com';
  iconText(p, f, 'email', mail, W - M - (14 + f.sans.widthOfTextAtSize(mail, 8)), cy);

  // Date, invoice number and bill-to, each on its own line, as on the owner's receipt
  let y = H - 132;
  // Numbers use Jost: Cormorant's old-style figures make "S017" read like "So17".
  const field = (label, lines, numeric = false) => {
    text(p, label, M, y, f.serif, 10.5, C.ink);
    y -= 19;
    lines.forEach((line, i) => {
      const first = i === 0;
      const digits = numeric || /^\+?[\d\s]+$/.test(line);
      const font = digits ? f.sans : f.serif;
      text(p, line, M + 14, y, font, first ? (digits ? 12.5 : 15) : (digits ? 9.5 : 11.5), first ? C.green : C.ink);
      y -= first ? 16 : 13.5;
    });
    rule(p, M, y + 8, M + 230, C.green, 0.7);
    y -= 14;
  };
  field('Date:', [day(when)], true);
  field('Invoice No.:', [order.reference], true);
  field('Bill to:', billTo(order));

  // Line items in a full table, with empty rows below as on the template
  y -= 6;
  y = tableHeader(p, f, y);
  const items = order.items || [];
  for (const item of items) {
    const lines = [item.name, ...wrap(itemDescription(item), f.serif, 9.5, COLS[1][1] - 14)];
    const rowH = Math.max(26, lines.length * 12 + 12);
    if (y - rowH < 260) {
      p = whitePage(doc);
      y = tableHeader(p, f, H - M);
    }
    gridRow(p, y, rowH);
    let x = M;
    text(p, item.sku || '', x + COLS[0][1] / 2, y - 16, f.sans, 8.5, C.ink, 'center');
    x += COLS[0][1];
    lines.forEach((line, n) => text(p, line, x + 7, y - 16 - n * 12, f.serif, n === 0 ? 10.5 : 9.5, n === 0 ? C.green : C.ink));
    x += COLS[1][1];
    [[money(item.unit_price), COLS[2][1]], [String(item.quantity), COLS[3][1]], [money(item.unit_price * item.quantity), COLS[4][1]]]
      .forEach(([v, w]) => { text(p, v, x + w / 2, y - 16, f.sans, 8.5, C.ink, 'center'); x += w; });
    y -= rowH;
  }
  for (let i = items.length; i < MIN_ROWS && y - 24 > 270; i++) {
    gridRow(p, y, 24);
    y -= 24;
  }

  // Bottom: THANK YOU with care and returns notes on the left; totals and the letter on the right
  const top = Math.min(y - 28, 248);
  text(p, 'THANK YOU', M, top, f.serif, 26, C.green);
  const boxW = 240;
  const notes = [
    ['JEWELRY CARE:', 'Avoid contact with perfume, lotion and harsh chemicals. Store in the provided pouch.'],
    ['EXCHANGE / RETURN POLICY:', 'In-stock pieces may be returned or exchanged within 14 days of delivery in original, unworn, undamaged condition. Made-to-order and custom pieces are final sale.'],
    ['', 'Please see our full terms and policies, including the care guide: siaramjewelry.com/returns.html'],
  ];
  const noteLines = [];
  for (const [head, body] of notes) {
    if (head) noteLines.push([head, f.serif, 10, C.ink]);
    for (const l of wrap(body, f.serif, 9.5, boxW - 16)) noteLines.push([l, f.serif, 9.5, C.ink]);
    noteLines.push(['', f.serif, 5, C.ink]);
  }
  const boxTop = top - 10;
  const nh = noteLines.reduce((s, [, , size]) => s + size * 1.3, 0) + 10;
  p.drawRectangle({ x: M, y: boxTop - nh, width: boxW, height: nh, color: C.paper, borderColor: C.rule, borderWidth: 0.6 });
  let ny = boxTop - 13;
  for (const [l, font, size, color] of noteLines) {
    if (l) text(p, l, M + 8, ny, font, size, color);
    ny -= size * 1.3;
  }

  const rows = [['Subtotal:', money(order.subtotal)]];
  if (Number(order.voucher_amount) > 0) rows.push([`Gift voucher ${order.voucher_code}:`, `-${money(order.voucher_amount)}`]);
  rows.push(['Payment Method:', paymentLabel(order)]);
  rows.push(['Total:', money(order.total)]);
  rows.push(['Delivery:', order.delivery_fee == null ? 'Paid to the courier' : `${money(order.delivery_fee)}, paid to the courier`]);
  const bx = M + boxW + 22;
  const bw = W - M - bx;
  const bh = rows.length * 15 + 12;
  p.drawRectangle({ x: bx, y: top + 18 - bh, width: bw, height: bh, color: C.paper, borderColor: C.rule, borderWidth: 0.6 });
  rows.forEach(([k, v], i) => {
    const ty = top + 18 - 15 - i * 15;
    const bold = k === 'Total:';
    text(p, k, bx + 8, ty, f.serif, 10.5, C.ink);
    text(p, v, bx + bw - 8, ty, bold ? f.sansMed : f.sans, 8.5, C.ink, 'right');
  });
  para(p, 'Thank you for choosing Siaram Jewelry.\nEach piece is created with intention and care, designed to reflect confidence, elegance and individuality. We are honored to be part of your journey and hope your jewelry becomes a cherished part of your everyday moments.\n\nWith gratitude,\nSiaram Jewelry\nSimply Elegant. Endlessly Yours.',
    bx, top + 18 - bh - 20, bw, f.serif, 9.5, C.ink, 1.4);

  return doc.save();
}

export async function careWarrantyPdf(order, when = new Date()) {
  const { doc, f, logo, qr } = await newDoc();
  doc.setTitle(`Siaram Jewelry care and warranty ${order.reference}`);
  const until = new Date(when);
  until.setFullYear(until.getFullYear() + 1);

  // 1. Thank-you letter
  let p = page(doc);
  let y = centredLogo(p, f, logo, H - 90);
  y = para(p, 'Each Siaram Jewelry piece is designed with intention and care, meant to be worn with confidence and meaning. Created to make you feel empowered and elegant.',
    M + 30, y - 30, W - 2 * M - 60, f.serif, 17, C.green, 1.45);
  y = para(p, 'Carefully handcrafted for you, and I hope it becomes part of your everyday moments.', M + 30, y - 20, W - 2 * M - 60, f.serif, 17, C.green, 1.45);
  para(p, 'Thank you for choosing Siaram.', M + 30, y - 20, W - 2 * M - 60, f.serif, 17, C.green, 1.45);

  // 2. Warranty card, filled in for this order
  p = page(doc);
  y = centredLogo(p, f, logo, H - 60);
  const x = M + 20;
  const cw = W - 2 * M - 40;
  text(p, 'WARRANTY', x, y, f.serif, 22, C.green);
  y -= 34;
  const pieces = (order.items || []).map((i) => `${i.name} (${METALS[i.metal] || METALS.yellow}${i.size ? `, ${i.size}` : ''})`);
  const fields = [
    ['CLIENT NAME:', order.customer_name],
    ['ORDER NUMBER:', order.reference, true],
    ['REFERENCE NUMBER:', (order.items || []).map((i) => i.sku).filter(Boolean).join(', '), true],
    ['PIECE NAME:', pieces.join('; ')],
    ['DATE OF PURCHASE:', day(when), true],
  ];
  for (const [k, v, numeric] of fields) {
    text(p, k, x, y, f.sansMed, 9, C.green);
    const font = numeric ? f.sans : f.serif;
    const size = numeric ? 11 : 13;
    const lines = wrap(v, font, size, cw - 130);
    lines.forEach((l, i) => text(p, l, x + 130, y - i * 16, font, size));
    y -= Math.max(1, lines.length) * 16 + 12;
  }
  y = para(p, `Warranty valid for 1 year from the date of purchase, until ${day(until)}.`, x, y - 4, cw, f.serif, 14, C.green);
  const list = (title, items) => {
    y -= 12;
    text(p, title, x, y, f.sansMed, 9, C.green);
    y -= 16;
    for (const it of items) {
      p.drawCircle({ x: x + 6, y: y + 3.5, size: 1.6, color: C.ink });
      y = para(p, it, x + 16, y, cw - 16, f.serif, 12.5, C.ink, 1.3);
    }
  };
  list('COVERS:', ['Manufacturing defects', 'Clasps, closures and structural faults', 'Stone setting becoming loose or detaching']);
  list('NOT COVERED:', ['Wear and tear from normal use', 'Scratches, dents or bending', 'Loss, theft or accidental damage', 'Exposure to chemicals or any other damaging products']);
  y = para(p, 'Repairs outside the warranty are available at an additional cost.', x, y - 12, cw, f.serif, 12.5);
  y = para(p, 'If you experience any issue, message us on +961 76 052 068 or email customerservice@siaramjewelry.com with a photo of the piece and your order number.',
    x, y - 8, cw, f.serif, 12.5);

  // 3. Care guide
  p = page(doc);
  y = centredLogo(p, f, logo, H - 90);
  text(p, 'CARE GUIDE', x, y - 10, f.serif, 22, C.green);
  y = para(p, 'To preserve the longevity and beauty of your jewelry:', x, y - 46, cw, f.serif, 16, C.green);
  for (const it of ['Store pieces individually in their original pouch or box.', 'Avoid contact with perfumes, lotions and harsh chemicals (especially mercury-based compounds).',
    'Clean gently with a soft, dry cloth.', 'Although water-resistant, proper care ensures long-lasting shine.']) {
    y -= 6;
    p.drawCircle({ x: x + 6, y: y + 5, size: 2, color: C.green });
    y = para(p, it, x + 18, y, cw - 18, f.serif, 15, C.green, 1.4);
  }
  // Footer as on the template: a QR code to Instagram, then WhatsApp and Instagram
  p.drawImage(qr, { x: M + 20, y: 46, width: 62, height: 62 });
  let fx = iconText(p, f, 'whatsapp', '+961 76 052 068', M + 110, 66, 9) + 30;
  fx = iconText(p, f, 'instagram', 'SIARAM.JEWELRY', fx, 66, 9) + 30;
  iconText(p, f, 'email', 'customerservice@siaramjewelry.com', fx, 66, 9);

  return doc.save();
}
