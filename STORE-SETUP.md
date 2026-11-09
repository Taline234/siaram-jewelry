# Online Store — Setup & Day-to-Day Guide

The website now has a cart, checkout, customer accounts and wishlists. **Until the steps below are done, the
site keeps working exactly as before** (catalogue prices shown, "Enquire by Email" buttons only, no cart), so it is safe to
publish first and set up afterwards.

Everything runs on free plans: **Cloudflare Pages** shows the website, **Supabase** stores the data and runs
the order code (placing orders, receipts, vouchers, the Workbook download, the daily account job), and
**Resend** sends the automatic emails. Updates pushed to GitHub go live on their own.

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
     the Cloudflare address shown after the first deploy (`https://siaram-jewelry.<account>.workers.dev/**`).
5. Open **Project Settings → API keys** and note the keys below. If Supabase shows a **Legacy API keys** tab, use the
   **anon** and **service_role** keys from there (the website code is tested with those; a new-style `sb_secret_…`
   key also works for the server key):
   - **Project URL** and **anon / public key** → these go in `js/store-config.js` (send them to Claude,
     or paste them in yourself). They are safe to publish.
   - **service_role key** → **secret**. Supabase gives it to the order code by itself, so you never need to copy
     it anywhere. Never paste it in the website files or send it by email.

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

## 3. Supabase — the order code and its settings

1. **Secrets** (Supabase → **Edge Functions → Secrets**, or Project Settings → Edge Functions): add

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the Resend API key (secret) |
   | `STORE_EMAIL_FROM` | `Siaram Jewelry <orders@siaramjewelry.com>` |
   | `ORDER_NOTIFY_EMAIL` | `customerservice@siaramjewelry.com` (where new orders arrive) |
   | `SITE_URL` | `https://siaramjewelry.com` |

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase automatically.
2. **Automatic updates of the order code**: Supabase → your avatar → **Account → Access Tokens → Generate new
   token** (name it `GitHub`). In GitHub → the repository → **Settings → Secrets and variables → Actions → New
   repository secret**, name `SUPABASE_ACCESS_TOKEN`, paste the token. From then on, every change to
   `supabase/functions` on `main` is sent to Supabase by `.github/workflows/deploy-functions.yml`
   (GitHub → **Actions** shows each run; **Run workflow** sends it by hand).
3. **Wakilni (the courier)**:
   1. In the Wakilni portal: **Settings → Api Tokens → Link to your custom app**, type `Siaram website`, click
      **Create**. Copy the key and the secret it shows.
   2. In Supabase → **Edge Functions → Secrets**, add `WAKILNI_KEY` (the key) and `WAKILNI_SECRET` (the secret).
   3. In Supabase → **Table Editor → store_settings**, fill in **courier_pickup_area** with the area of the address
      Wakilni picks parcels up from, written as in the Wakilni portal (for example `Achrafieh`), and
      **courier_pickup_floor** if you like.
   Delivery fees: Wakilni charges online stores $5 anywhere in Lebanon, so every open area is set to $5 in
   **delivery_areas** (change it there if your contract differs). Baalbek-Hermel is closed, because Wakilni does
   not deliver items over $200 there.
4. **Daily account job**: run [`supabase/cron.sql`](supabase/cron.sql) once in the SQL Editor. It asks the
   database to call the `inactive-accounts` function every night, which also keeps the free project awake.

## 4. Cloudflare Pages — the website

1. In <https://dash.cloudflare.com> → **Workers & Pages → Create** → import the `siaram-jewelry` GitHub repository.
2. Project name `siaram-jewelry`; build command `bash tools/build-site.sh`; deploy command `npx wrangler deploy`
   (the settings are in `wrangler.jsonc`: the files in `dist/` are served as they are, with `404.html` for unknown
   addresses). The site appears at `siaram-jewelry.<account>.workers.dev`.
3. **Custom domains → Set up a custom domain** → `siaramjewelry.com` (and `www.siaramjewelry.com`), and follow
   Cloudflare's instructions for name.com. Keep your existing MX records so Outlook email keeps working.

`js/store-config.js` holds the Supabase Project URL and anon key; both are safe to publish.

### Closing the site while you edit ("Private access" page)

The site can be hidden behind a branded password page (`worker/gate.js`). It is **off** until you set a password.

- **Close the site:** Cloudflare → **Workers & Pages → siaram-jewelry → Settings → Variables and Secrets → Add**.
  Type **Secret**, name `SITE_PASSWORD`, value = the password you choose → **Deploy**. Within a minute every
  page shows "Private access"; you (and anyone you give the password to) type it once and stay signed in for
  30 days on that device.
- **Open the site again:** delete the `SITE_PASSWORD` secret → **Deploy**.
- **Lock out everyone who has the password:** change the secret's value. Everyone is signed out.
- **Sign yourself out:** visit `siaramjewelry.com/__private-access/sign-out`.

While it is closed, visitors can't browse or order on the website, so take orders on WhatsApp/Instagram.
Order emails, Supabase and the order functions keep working. Google is told the site is briefly closed
(not gone), so search ranking isn't lost for a short closure.

**Before announcing:** place a test order yourself, check both emails arrive (yours and the
"customer's"), then set that test order's status to `cancelled` in Supabase.

---

## Day-to-day

**A new order arrives**
1. You get an email "New order S017" in Outlook. Order numbers carry on from the finance workbook's invoice numbers
   (S017, S018, ...). Website orders are cash only, and the email lists the items with their
   SKUs, the amount to collect, and either the delivery address or "Collection by appointment"
   (free; message the customer to arrange a time). Replying to it emails the customer directly.
   The receipt PDF is attached, and the email ends with a "For your finance workbook" table: one row
   per piece in the order of the Sales tab's columns. The customer's email has the receipt and the
   care and warranty card attached (both drawn after the "Siaram Invoice" Canva template).
2. New orders start as `received`, and the customer has already had an "order received" email.
   If the order has a made-to-order piece (rose or white gold, or out of stock), send the customer a
   Whish payment request for it and start production once it clears. Then open **Supabase → Table
   Editor → orders** and set the status to `preparing` (or `cancelled` if it cannot go ahead).
3. When the parcel is packed, set **status** to `ready`. The site books it with Wakilni straight away, as cash on
   delivery for the order total plus the delivery fee, and emails you the tracking number and the parcel label
   (print it and stick it on the box). If Wakilni refuses it (for example an area it does not recognise), you get an
   email saying why: fix the **city** column, set the status to `preparing` and back to `ready` to try again.
4. Every hour the site reads Wakilni's status. Once the driver has the parcel the order becomes `dispatched` and the
   customer is emailed that it is on its way (with the tracking number and the cash to have ready); once delivered it
   becomes `delivered`. If Wakilni shows a problem (cancelled, failed, refused) you get an email.
   You can still do it by hand: book in the Wakilni portal, type the tracking number in **tracking_number** and set
   **status** to `dispatched`.
5. Orders booked by hand: set `delivered` once it arrives. Customers with an account see the status under **My Account → Orders**.

**Stock** — in **Table Editor → stock**, one row per piece, metal and size you have ready to ship (size is
empty for necklaces and earrings, `EU 54` for rings, the length as listed on the site for bracelets, e.g.
`16–17 cm`). The website shows "In stock" for those and "Made to order" for everything else. Website orders take
a piece off automatically, and setting an order to `cancelled` puts it back. When you sell on Instagram,
WhatsApp or in person, lower the quantity yourself; when new pieces arrive, add a row (**Insert**) or raise it.

**Mailing list** — sign-ups from the footer form are in **Table Editor → newsletter_subscribers**, each with the
consent wording, date and page. To unsubscribe someone, set **status** to `unsubscribed` (keep the row, so they
are never emailed again); newsletter_events keeps the history. When you start sending newsletters, export the
`subscribed` rows (**Export → CSV**) and import them into Brevo or MailerLite.

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

**Finance workbook backup download** — sign in on the website's **My Account** page with your shop email
(siaramjewelry@hotmail.com, finance@ or customerservice@siaramjewelry.com; to use other emails, add an `OWNER_EMAILS`
secret in Supabase with a comma-separated list). A **Workbook** tab appears only for you. Pick dates (or none for everything)
and download:
- **Sales**: one row per piece in the Sales tab's columns A to Z, with the formula columns left empty. Copy the rows
  under the heading, click column A of the first empty Sales row, then Paste Special → Values with **Skip blanks**
  ticked, so the workbook's formulas stay. Cash Received Now is filled in only for delivered orders.
- **Customers**: name, phone, email, address and "Website", in the Customers tab's columns A to G. Paste only names
  that are not there yet; the workbook matches customers by name.

## Backups

Every Sunday, `.github/workflows/backup-database.yml` copies the whole database and keeps the copy for 90 days
(GitHub → **Actions → Weekly database backup** → a run → **Artifacts**). The repository is public, so each copy is
locked with your passphrase; without it the file cannot be opened.

Setup (once): in GitHub → **Settings → Secrets and variables → Actions → New repository secret**, add
- `SUPABASE_DB_URL`: Supabase → **Connect** → **Session pooler** connection string, with your database password in
  place of `[YOUR-PASSWORD]` (forgot it? Supabase → Project Settings → Database → Reset database password);
- `BACKUP_PASSPHRASE`: a long passphrase you invent. Save it in your password manager: it is the only way to open
  the backups.

To open a copy: download the artifact, then in Terminal
`gpg --decrypt siaram-backup-DATE.tar.gz.gpg | tar xz` (it asks for the passphrase). Restoring is a developer job:
`structure.sql`, then `logins.sql`, then `data.sql`, into a fresh Supabase project.

## For developers

- `supabase/schema.sql` — tables, access rules (row-level security) and business rules (`place_order`,
  vouchers, 18+, inactivity). Safe to re-run.
- `supabase/functions/` — Supabase Edge Functions: `place-order`, `check-voucher`, `delete-account`, `export-sales`
  and the daily `inactive-accounts` job (started by `supabase/cron.sql`). Each `index.ts` is a two-line entry point;
  the code is in `_shared/handlers/`, which the Node tests import directly.
- `tools/build-site.sh` — Cloudflare Pages build: copies the public files into `dist/`.
- `js/store.js`, `cart.js`, `checkout.js`, `account.js` — browser code; does nothing until `js/store-config.js` is filled in.
- Tests: `python3 tests/check-site.py` · `node --test tests/store-functions-test.mjs` · `tests/run-store-db-test.sh` (needs Postgres) ·
  `tests/e2e/run.sh` (needs Postgres + Chromium).
