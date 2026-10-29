// Order documents: node --test tests/documents-test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { careWarrantyPdf, itemDescription, receiptPdf } from '../netlify/lib/documents.mjs';
import { CATALOGUE } from '../netlify/lib/catalogue.mjs';

test('item descriptions name the metal, stones, pearls and size for customs', () => {
  assert.equal(itemDescription({ sku: 'RG-06', metal: 'rose', size: 'EU 54' }),
    '18k rose gold\nStones: Red stone (centre), white zircon\nRing size EU 54');
  assert.equal(itemDescription({ sku: 'BR-06', metal: 'white', size: '17 cm' }),
    '18k white gold\nWhite freshwater pearl\nLength 17 cm', 'a chosen bracelet length replaces the standard one');
  assert.match(itemDescription({ sku: 'NK-01', metal: 'yellow', size: '' }), /^18k yellow gold\nStones: White zircon\nLength: 40 cm chain \+ 6 cm drop chain$/);
});

test('every website piece has catalogue details', () => {
  assert.equal(Object.keys(CATALOGUE).length, 36);
  for (const [sku, c] of Object.entries(CATALOGUE)) assert.ok(c.name && c.category, sku);
});

test('receipt and care card are PDFs, with a second receipt page for long orders', async () => {
  const items = Array.from({ length: 9 }, () => ({ sku: 'NK-05', name: 'Midnight Horseshoe Necklace', unit_price: 525, quantity: 1, metal: 'yellow', size: '' }));
  const order = { reference: 'S016', customer_name: 'Rana Haddad', email: 'r@example.com', phone: '70', fulfilment: 'collection',
    payment_method: 'cash', subtotal: 4725, total: 4725, voucher_amount: 0, items };
  const receipt = Buffer.from(await receiptPdf(order));
  const care = Buffer.from(await careWarrantyPdf(order));
  assert.equal(receipt.subarray(0, 5).toString(), '%PDF-');
  assert.equal(care.subarray(0, 5).toString(), '%PDF-');
  assert.equal((await PDFDocument.load(receipt)).getPageCount(), 2, 'nine pieces spill onto a second page');
  assert.equal((await PDFDocument.load(care)).getPageCount(), 3, 'letter, warranty and care guide');
});
