# Online Store — Setup & Day-to-Day Guide

The website now has a cart, checkout, customer accounts and wishlists. **Until the steps below are done, the
site keeps working exactly as before** (catalogue prices shown, "Enquire by Email" buttons only, no cart), so it is safe to
publish first and set up afterwards.

You will create two free accounts (Supabase and Resend), add a few DNS records at name.com, and paste
some keys into Netlify. Allow about an hour.

---

## 1. Supabase — the database and customer logins

1. Sign up at <https://supabase.com> and click **New project**.
   - Name: `siaram-jewelry`
   - Database password: generate a strong one and save it in your password manager.
   - Region: any **EU** region (for example Frankfurt or Ireland) — the Privacy Policy says your data is stored in the European Union.
2. When the project is ready, open **SQL Editor → New query**, paste the whole contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. It should say "Success".
3. Open **Table Editor** and fill in:
   - **products** → all 36 pieces are already there with the prices from your October 2026 catalogue
     (US dollars). Change a **price** here and the website follows; clear it to show "Price on request"
     and stop online orders for that piece.
   - **delivery_areas** → a **delivery_fee** per governorate, from your Wakilni rates. As your Shipping
     policy says, the customer pays this fee to the courier in cash, so it is shown at checkout but not
     added to the jewellery total. Leave it empty and checkout says the fee is confirmed before dispatch. South is already set to not accept orders;
     untick **accepts_orders** for any other area you want to block (for example Nabatieh).
4. Open **Authentication → URL Configuration**:
   - Site URL: `https://siaramjewelry.com`
   - Redirect URLs: add `https://siaramjewelry.com/account.html` and
     `https://deploy-preview-*--siaram-jewelry.netlify.app/**` (so previews work too).
5. Open **Project Settings → API keys** and note the keys below. If Supabase shows a **Legacy API keys** tab, use the
   **anon** and **service_role** keys from there (the website code is tested with those; a new-style `sb_secret_…`
   key also works for the server key):
   - **Project URL** and **anon / public key** → these go in `js/store-config.js` (send them to Claude,
     or paste them in yourself). They are safe to publish.
   - **service_role key** → **secret**. It goes only into Netlify (step 3). Never paste it in the website files or send it by email.

## 2. Resend — sending order emails from your domain

Your Outlook mailbox stays exactly as it is. Resend only *sends* the automatic emails
(order confirmations, password resets, inactivity notices) from `orders@siaramjewelry.com`.

1. Sign up at <https://resend.com> → **Domains → Add domain** → `siaramjewelry.com`.
2. Resend shows 3–4 DNS records (TXT and MX records on `send.siaramjewelry.com` and a
   `resend._domainkey` TXT record). Add each one at **name.com → My Domains → siaramjewelry.com →
   Manage DNS Records**, copying the *Type*, *Host* and *Answer/Value* exactly.
   - These records are on the `send` sub-domain, so they **do not touch your Outlook email records**.
     Don't edit or delete the existing MX records.
   - If your domain's nameservers point to Netlify instead of name.com, add the records in
     **Netlify → Domains → siaramjewelry.com → DNS settings** instead.
3. Back in Resend, click **Verify** (it can take up to an hour).
4. **API Keys → Create API key** (permission: Sending access). Copy it.
5. So that sign-up and password-reset emails also come from your domain: in **Supabase → Authentication →
   Emails → SMTP Settings**, turn on custom SMTP with:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key
   - Sender email `orders@siaramjewelry.com`, sender name `Siaram Jewelry`

## 3. Netlify — connect the website to the store

In **Netlify → siaram-jewelry → Site configuration → Environment variables**, add:

| Key | Value |
|---|---|
| `SUPABASE_URL` | the Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the Supabase **service_role** key (tick "Contains secret values") |
| `RESEND_API_KEY` | the Resend API key (secret) |
| `STORE_EMAIL_FROM` | `Siaram Jewelry <orders@siaramjewelry.com>` |
| `ORDER_NOTIFY_EMAIL` | `customerservice@siaramjewelry.com` (where new orders arrive) |
| `SITE_URL` | `https://siaramjewelry.com` |

Then fill in `js/store-config.js` with the Project URL and anon key, and redeploy
(**Deploys → Trigger deploy**). The cart and account icons appear in the header once this is live.

**Before announcing:** place a test order yourself, check both emails arrive (yours and the
"customer's"), then set that test order's status to `cancelled` in Supabase.

---

## Day-to-day

**A new order arrives**
1. You get an email "New order S016" in Outlook. Order numbers carry on from the finance workbook's invoice numbers
   (S016, S017, ...). Website orders are cash only, and the email lists the items with their
   SKUs, the amount to collect, and either the delivery address or "Collection by appointment"
   (free; message the customer to arrange a time). Replying to it emails the customer directly.
   The receipt PDF is attached, and the email ends with a "For your finance workbook" table: one row
   per piece in the order of the Sales tab's columns. The customer's email has the receipt and the
   care and warranty card attached (both drawn after the "Siaram Invoice" Canva template).
2. New orders start as `received`, and the customer has already had an "order received" email.
   If the order has a made-to-order piece (rose or white gold, or out of stock), send the customer a
   Whish payment request for it and start production once it clears. Then open **Supabase → Table
   Editor → orders** and set the status to `preparing` (or `cancelled` if it cannot go ahead).
3. Book the delivery with Wakilni as cash on delivery, for the order total plus the delivery fee (the
   email shows both); for a collection, take the cash at handover.
4. Then set `dispatched` and `delivered` as the order moves along. Customers with an account see this
   status under **My Account → Orders**.

**Issue a gift voucher** — after the purchaser has paid, open **SQL Editor** and run:
```sql
select issue_gift_voucher('Recipient Full Name', 'Purchaser Full Name', 150, 'recipient@email.com', '+961 70 000 000');
```
Put the recipient's email and phone number from the purchaser at the end (at least one of the two; write
`null` for one you don't have). It returns a code like `GV0001-K7QM4X`, valid for 6 months. `GV0001` is the
voucher number for the finance workbook; the random part after the dash stops anyone spending a voucher by
guessing the next number, so always send the recipient the whole code. Customers can type it in lower case
or without the dash. At checkout the website only accepts the voucher when the customer's email or phone
number is the recipient's, so a forwarded code cannot be used by someone else. Amounts under $100 are refused, as in
your Gift Voucher policy. Send it to the recipient's phone or email given by the purchaser.
Vouchers pay for jewellery only, never the delivery fee.
Customers enter the code at checkout; expired codes are refused automatically and any unused balance
stays on the voucher until it expires. See all vouchers in **Table Editor → gift_vouchers**
(set **status** to `void` to cancel one).

**Order and voucher numbers** — the next numbers are in **Table Editor → store_settings**
(`next_order_number`, `next_voucher_number`). Change them there if you record an order or voucher outside
the website, so the numbers stay in step with the finance workbook.

**Export orders to Excel** — **Table Editor → orders** (or **order_items** for the pieces and SKUs) →
**Export → Export as CSV**, then open the file in Excel.

**Change a price or stop selling a piece** — **products** table: edit **price**, or untick **available**.

**Add a new piece** — add a row to **products** (slug like `star-earrings`, name, category, SKU, price, image
path) and ask Claude to create its product page `product-star-earrings.html`.

**Inactive accounts** — handled automatically every day: a reminder after 12 months without activity,
a deletion notice after 24 months, and deletion 30 days later unless the customer signs in. Order
records are kept.

---

## For developers

- `supabase/schema.sql` — tables, access rules (row-level security) and business rules (`place_order`,
  vouchers, 18+, inactivity). Safe to re-run.
- `netlify/functions/` — `place-order`, `check-voucher`, `delete-account`, and the daily `inactive-accounts` job.
- `js/store.js`, `cart.js`, `checkout.js`, `account.js` — browser code; does nothing until `js/store-config.js` is filled in.
- Tests: `python3 tests/check-site.py` · `node --test tests/store-functions-test.mjs` · `tests/run-store-db-test.sh` (needs Postgres) ·
  `tests/e2e/run.sh` (needs Postgres + Chromium).
