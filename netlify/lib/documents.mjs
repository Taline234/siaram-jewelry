// The two PDFs sent with every order, drawn after the owner's Canva template "Siaram Invoice":
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
const CONTACT = ['@siaram.jewelry  ·  +961 76 052 068', 'customerservice@siaramjewelry.com  ·  finance@siaramjewelry.com'];

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
  return { doc, f, logo };
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
  return order.fulfilment === 'collection' ? 'Cash at collection' : 'Cash on delivery';
}

function billTo(order) {
  const lines = [order.customer_name];
  if (order.fulfilment === 'collection') lines.push('Collection by appointment');
  else {
    lines.push([order.street, order.building && `Building ${order.building}`, order.floor && `Floor ${order.floor}`].filter(Boolean).join(', '));
    lines.push([order.city, order.governorate, 'Lebanon'].filter(Boolean).join(', '));
  }
  lines.push(order.phone, order.email);
  return lines.filter(Boolean);
}

const COLS = [
  ['SKU', 52], ['Product', 104], ['Item description', 196], ['Price', 60], ['Qty', 36], ['Total', 67],
];

function tableHeader(p, f, y) {
  let x = M;
  p.drawRectangle({ x: M, y: y - 22, width: W - 2 * M, height: 22, borderColor: C.rule, borderWidth: 0.6 });
  for (const [label, w] of COLS) {
    text(p, label.toUpperCase(), x + w / 2, y - 14.5, f.sansMed, 7.5, C.green, 'center');
    x += w;
    if (x < W - M) p.drawLine({ start: { x, y }, end: { x, y: y - 22 }, thickness: 0.6, color: C.rule });
  }
  return y - 22;
}

export async function receiptPdf(order, when = new Date()) {
  const { doc, f, logo } = await newDoc();
  doc.setTitle(`Siaram Jewelry receipt ${order.reference}`);
  let p = page(doc);

  // Header: title, logo and contact details, as in the template
  text(p, 'RECEIPT', M, H - 78, f.serif, 34, C.green);
  const lw = 150;
  const lh = (lw * logo.height) / logo.width;
  p.drawImage(logo, { x: W - M - lw, y: H - 42 - lh, width: lw, height: lh });
  CONTACT.forEach((line, i) => text(p, line, W - M, H - 104 - i * 12, f.sans, 7.5, C.ink, 'right'));

  let y = H - 130;
  const field = (label, value) => {
    text(p, label, M, y, f.sansMed, 8, C.green);
    text(p, value, M + 70, y, f.sans, 10.5);
    rule(p, M, y - 6, M + 260);
    y -= 26;
  };
  field('Date:', day(when));
  field('Invoice No.:', order.reference);
  text(p, 'Bill to:', M, y, f.sansMed, 8, C.green);
  for (const line of billTo(order)) {
    text(p, line, M + 70, y, f.serif, 12);
    y -= 15;
  }
  rule(p, M, y + 9, M + 260);
  y -= 20;

  // Line items
  y = tableHeader(p, f, y);
  for (const item of order.items || []) {
    const desc = wrap(itemDescription(item), f.serif, 10, COLS[2][1] - 12);
    const name = wrap(item.name, f.serif, 10.5, COLS[1][1] - 12);
    const rowH = Math.max(desc.length, name.length) * 12.5 + 12;
    if (y - rowH < 250) {
      p = page(doc);
      y = tableHeader(p, f, H - M);
    }
    const cells = [[item.sku || ''], name, desc, [money(item.unit_price)], [String(item.quantity)], [money(item.unit_price * item.quantity)]];
    let x = M;
    cells.forEach((lines, i) => {
      const w = COLS[i][1];
      const right = i >= 3;
      lines.forEach((line, n) => {
        const numeric = i === 0 || i >= 3;
        const font = numeric ? f.sans : f.serif;
        const size = numeric ? 8.5 : 10.5 - (i === 2 ? 0.5 : 0);
        text(p, line, right ? x + w - 6 : x + 6, y - 15 - n * 12.5, font, size, C.ink, right ? 'right' : 'left');
      });
      x += w;
      if (x < W - M) p.drawLine({ start: { x, y }, end: { x, y: y - rowH }, thickness: 0.6, color: C.rule });
    });
    p.drawLine({ start: { x: M, y }, end: { x: M, y: y - rowH }, thickness: 0.6, color: C.rule });
    p.drawLine({ start: { x: W - M, y }, end: { x: W - M, y: y - rowH }, thickness: 0.6, color: C.rule });
    y -= rowH;
    rule(p, M, y, W - M);
  }

  // Totals box, right
  const rows = [['Subtotal:', money(order.subtotal)]];
  if (Number(order.voucher_amount) > 0) rows.push([`Gift voucher ${order.voucher_code}:`, `-${money(order.voucher_amount)}`]);
  rows.push(['Payment method:', paymentLabel(order)]);
  rows.push(['Total:', money(order.total)]);
  if (order.fulfilment !== 'collection') {
    rows.push(['Delivery:', order.delivery_fee == null ? 'Paid to the courier' : `${money(order.delivery_fee)}, paid to the courier`]);
  }
  rows.push(['Warranty:', '6 months from delivery']);
  const bx = W - M - 240;
  const bh = rows.length * 17 + 12;
  y -= 14;
  p.drawRectangle({ x: bx, y: y - bh, width: 240, height: bh, borderColor: C.rule, borderWidth: 0.6 });
  rows.forEach(([k, v], i) => {
    const ty = y - 17 - i * 17;
    const bold = k === 'Total:';
    text(p, k, bx + 10, ty, bold ? f.sansMed : f.sans, 8.5, C.green);
    text(p, v, bx + 230, ty, bold ? f.sansMed : f.sans, bold ? 10.5 : 9, C.ink, 'right');
  });

  // Thank-you and policy notes along the bottom
  const top = Math.min(y - bh - 26, 230);
  text(p, 'THANK YOU', M, top, f.serif, 24, C.green);
  const boxTop = top - 12;
  const notes = [
    ['JEWELRY CARE:', 'Avoid contact with perfume, lotion and harsh chemicals. Store in the provided pouch.'],
    ['EXCHANGE / RETURN POLICY:', 'Returns and exchanges within 14 days of delivery, unworn, undamaged and in the original packaging. Return costs are paid by the customer unless the piece is defective or incorrect. Custom pieces are final sale.'],
    ['', 'Full terms, care guide and policies: siaramjewelry.com/returns.html'],
  ];
  let ny = boxTop - 14;
  const boxW = 250;
  const noteLines = [];
  for (const [head, body] of notes) {
    if (head) noteLines.push([head, f.sansMed, 7.5, C.green]);
    for (const l of wrap(body, f.serif, 9.5, boxW - 16)) noteLines.push([l, f.serif, 9.5, C.ink]);
    noteLines.push(['', f.serif, 4, C.ink]);
  }
  const nh = noteLines.reduce((s, [, , size]) => s + size * 1.3, 0) + 12;
  p.drawRectangle({ x: M, y: boxTop - nh, width: boxW, height: nh, color: C.panel, borderColor: C.rule, borderWidth: 0.6 });
  for (const [l, font, size, color] of noteLines) {
    if (l) text(p, l, M + 8, ny, font, size, color);
    ny -= size * 1.3;
  }
  para(p, 'Thank you for choosing Siaram Jewelry.\nEach piece is created with intention and care, designed to reflect confidence, elegance and individuality. We are honored to be part of your journey and hope your jewelry becomes a cherished part of your everyday moments.\n\nWith gratitude,\nSiaram Jewelry\nSimply Elegant. Endlessly Yours.',
    M + boxW + 25, boxTop - 14, W - 2 * M - boxW - 25, f.serif, 10, C.ink, 1.4);

  return doc.save();
}

export async function careWarrantyPdf(order, when = new Date()) {
  const { doc, f, logo } = await newDoc();
  doc.setTitle(`Siaram Jewelry care and warranty ${order.reference}`);

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
  y = para(p, 'Warranty valid for 6 months from the date your piece is delivered.', x, y - 4, cw, f.serif, 14, C.green);
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
  ['siaramjewelry.com  ·  @siaram.jewelry  ·  +961 76 052 068', 'customerservice@siaramjewelry.com  ·  finance@siaramjewelry.com']
    .forEach((line, i) => text(p, line, W / 2, 70 - i * 14, f.sans, 9, C.ink, 'center'));

  return doc.save();
}
