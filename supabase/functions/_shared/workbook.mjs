// Backup download for the finance workbook: website sales and sales recorded by the owner, laid out like the Sales tab (columns A to Z),
// and new customers laid out like the Customers tab (columns A to G). Formula columns are left empty so
// the rows can be pasted with "Skip blanks" without overwriting the workbook's formulas.

const SALES_HEAD = ['Invoice #', 'Sale Date', 'Customer', 'Sales Channel', 'SKU', 'Batch (auto)', 'Qty',
  'Agreed Unit Price', 'Discount Type', 'Discount Value', 'Final Total', 'Payment Method', 'Cash Received Now',
  'Balance Due', 'Supplier Cost of Piece', 'Gross Profit', 'Line #', 'Warranty Until', 'Receipt Key (auto)',
  'Labour + Petrol Allowance', 'Profit after Labour & Petrol', 'Margin', 'Entry Check', 'Batch Override (optional)',
  'Gift Voucher Code', 'Paid by Voucher ($)'];
const CUSTOMER_HEAD = ['Name', 'Phone', 'Instagram', 'Email', 'Address', 'Birthday', 'How They Found Us'];

import { xlsx } from './xlsx.mjs';

const cents = (n) => Math.round(Number(n || 0) * 100);
const amount = (c) => (c / 100).toFixed(2);
const PAY = { cash: 'Cash', whish: 'Whish', card: 'Card', bank: 'Bank Transfer', voucher: 'Gift Voucher' };

function csv(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // The byte-order mark makes Excel read accents and Arabic names correctly.
  return `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

// One row per piece. Voucher credit is spread over the pieces in order. Money counts as received once
// the order is delivered; until then Cash Received Now is 0 and the workbook shows the balance due.
export function salesRows(orders) {
  const rows = [SALES_HEAD];
  for (const o of orders) {
    // Sales recorded by the owner are paid when recorded, even if the piece is still being made.
    const delivered = o.status === 'delivered' || (o.channel || 'Website') !== 'Website';
    let voucherLeft = cents(o.voucher_amount);
    for (const i of o.items || []) {
      const line = cents(i.unit_price) * i.quantity;
      const byVoucher = Math.min(voucherLeft, line);
      voucherLeft -= byVoucher;
      const cash = line - byVoucher;
      const website = (o.channel || 'Website') === 'Website';
      const method = cash === 0 && byVoucher > 0 ? 'Gift Voucher'
        : website && i.made_to_order ? 'Whish' : PAY[o.payment_method] || 'Cash';
      rows.push([
        o.reference, o.sale_date, o.customer_name, o.channel || 'Website', i.sku || '', '', i.quantity,
        amount(cents(i.unit_price)), 'Percentage', 0, '', method, delivered ? amount(cash) : '0.00',
        '', '', '', '', '', '', '', '', '', '', '',
        byVoucher > 0 ? o.voucher_code : '', byVoucher > 0 ? amount(byVoucher) : '',
      ]);
    }
  }
  return rows;
}

export const salesCsv = (orders) => csv(salesRows(orders));

// Each customer once, by name (the workbook matches customers by name), with their latest details.
export function customerRows(orders) {
  const latest = new Map();
  for (const o of orders) latest.set(o.customer_name.trim().toLowerCase(), o);
  const rows = [CUSTOMER_HEAD];
  for (const o of latest.values()) rows.push([o.customer_name, o.phone, '', o.email, o.address || '', '', o.channel || 'Website']);
  return rows;
}

export const customersCsv = (orders) => csv(customerRows(orders));

// The same two lists as one Excel file with a Sales tab and a Customers tab, so one download fills both.
// Prices and quantities are numbers and sale dates are real dates; empty cells stay empty for "Skip blanks".
export function workbookXlsx(orders) {
  const numeric = new Set([6, 7, 9, 12, 25]);
  const sales = salesRows(orders).map((r, n) => r.map((v, c) => (n > 0 && c === 1 && v ? { date: v }
    : n > 0 && numeric.has(c) && v !== '' && v != null ? Number(v) : v)));
  return xlsx([{ name: 'Sales', rows: sales }, { name: 'Customers', rows: customerRows(orders) }]);
}
