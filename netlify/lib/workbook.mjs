// Backup download for the finance workbook: website sales laid out like the Sales tab (columns A to Z),
// and new customers laid out like the Customers tab (columns A to G). Formula columns are left empty so
// the rows can be pasted with "Skip blanks" without overwriting the workbook's formulas.

const SALES_HEAD = ['Invoice #', 'Sale Date', 'Customer', 'Sales Channel', 'SKU', 'Batch (auto)', 'Qty',
  'Agreed Unit Price', 'Discount Type', 'Discount Value', 'Final Total', 'Payment Method', 'Cash Received Now',
  'Balance Due', 'Supplier Cost of Piece', 'Gross Profit', 'Line #', 'Warranty Until', 'Receipt Key (auto)',
  'Labour + Petrol Allowance', 'Profit after Labour & Petrol', 'Margin', 'Entry Check', 'Batch Override (optional)',
  'Gift Voucher Code', 'Paid by Voucher ($)'];
const CUSTOMER_HEAD = ['Name', 'Phone', 'Instagram', 'Email', 'Address', 'Birthday', 'How They Found Us'];

const cents = (n) => Math.round(Number(n || 0) * 100);
const amount = (c) => (c / 100).toFixed(2);
const PAY = { cash: 'Cash', whish: 'Whish' };

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
export function salesCsv(orders) {
  const rows = [SALES_HEAD];
  for (const o of orders) {
    const delivered = o.status === 'delivered';
    let voucherLeft = cents(o.voucher_amount);
    for (const i of o.items || []) {
      const line = cents(i.unit_price) * i.quantity;
      const byVoucher = Math.min(voucherLeft, line);
      voucherLeft -= byVoucher;
      const cash = line - byVoucher;
      const method = cash === 0 && byVoucher > 0 ? 'Gift Voucher' : PAY[o.payment_method] || 'Cash';
      rows.push([
        o.reference, o.sale_date, o.customer_name, 'Website', i.sku || '', '', i.quantity,
        amount(cents(i.unit_price)), 'Percentage', 0, '', method, delivered ? amount(cash) : '0.00',
        '', '', '', '', '', '', '', '', '', '', '',
        byVoucher > 0 ? o.voucher_code : '', byVoucher > 0 ? amount(byVoucher) : '',
      ]);
    }
  }
  return csv(rows);
}

// Each customer once, by name (the workbook matches customers by name), with their latest details.
export function customersCsv(orders) {
  const latest = new Map();
  for (const o of orders) latest.set(o.customer_name.trim().toLowerCase(), o);
  const rows = [CUSTOMER_HEAD];
  for (const o of latest.values()) rows.push([o.customer_name, o.phone, '', o.email, o.address || '', '', 'Website']);
  return csv(rows);
}
