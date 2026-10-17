# Online Store — Setup & Day-to-Day Guide

The website now has a cart, checkout, customer accounts and wishlists. **Until the steps below are done, the
site keeps working exactly as before** (prices hidden, "Enquire by Email" buttons only), so it is safe to
publish first and set up afterwards.

You will create two free accounts (Supabase and Resend), add a few DNS records at name.com, and paste
some keys into Netlify. Allow about an hour.

---

## 1. Supabase — the database and customer logins

1. Sign up at <https://supabase.com> and click **New project**.
   - Name: `siaram-jewelry`
   - Database password: generate a strong one and save it in your password manager.
   - Region: **Central EU (Frankfurt)** — the Privacy Policy says your data is stored in the EU, so pick this one.
2. When the project is ready, open **SQL Editor → New query**, paste the whole contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. It should say "Success".
3. Open **Table Editor** and fill in:
   - **products** → type a **price** (in US dollars) for each piece you want to sell online.
     A piece with no price keeps showing "Price on request".
   - **store_settings** → your **whish_number** (e.g. `+961 76 052 068`) and **whish_name** (the name
     customers will see on Whish).
   - **delivery_areas** → a **delivery_fee** per governorate once you have a courier. Leave it empty and
     checkout says "Delivery: confirmed after ordering". South is already set to not accept orders;
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
1. You get an email "New order SJ-XXXXXX" in Outlook, with the items, total and delivery address.
   Replying to it emails the customer directly.
2. When the Whish payment with that reference arrives, open **Supabase → Table Editor → orders** and change
   the order's **status** to `paid`, then `preparing`, `dispatched`, `delivered` as it moves along.
   Customers with an account see this status under **My Account → Orders**.
3. If payment never arrives, set the status to `cancelled`.

**Issue a gift voucher** — after the purchaser has paid, open **SQL Editor** and run:
```sql
select issue_gift_voucher('Recipient Full Name', 'Purchaser Full Name', 150);
```
It returns a code like `SIARAM-7F3A-91C2`, valid for 6 months. Send it to the purchaser.
Customers enter the code at checkout; expired codes are refused automatically and any unused balance
stays on the voucher until it expires. See all vouchers in **Table Editor → gift_vouchers**
(set **status** to `void` to cancel one).

**Change a price or stop selling a piece** — **products** table: edit **price**, or untick **available**.

**Add a new piece** — add a row to **products** (slug like `star-earrings`, name, category, price, image
path) and ask Claude to create its product page `product-star-earrings.html`.

**Inactive accounts** — handled automatically every day: a reminder after 12 months without activity,
a deletion notice after 24 months, and deletion 30 days later unless the customer signs in. Order
records are kept.

**When you choose a courier** — tell Claude so the Privacy Policy can name them, and add the delivery fees in
**delivery_areas**.

---

## For developers

- `supabase/schema.sql` — tables, access rules (row-level security) and business rules (`place_order`,
  vouchers, 18+, inactivity). Safe to re-run.
- `netlify/functions/` — `place-order`, `check-voucher`, `delete-account`, and the daily `inactive-accounts` job.
- `js/store.js`, `cart.js`, `checkout.js`, `account.js` — browser code; does nothing until `js/store-config.js` is filled in.
- Tests: `python3 tests/check-site.py` · `node --test tests/store-functions-test.mjs` · `tests/run-store-db-test.sh` (needs Postgres) ·
  `tests/e2e/run.sh` (needs Postgres + Chromium).
