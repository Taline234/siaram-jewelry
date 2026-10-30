# Siaram Jewelry website — handover notes

Everything needed to keep working on the site is in this repository. Start a new Claude Code session
on it and say "read HANDOVER.md first".

## What the site is
- Plain HTML/CSS/JS, hosted on Netlify (publish directory is the repository root, no build step).
- Online store: Supabase (database + customer logins), Netlify Functions (`netlify/functions/`) and
  Resend (order emails). It stays **switched off** until `js/store-config.js` holds the Supabase URL and
  anon key. Setup steps: `STORE-SETUP.md`.
- Tests: `python3 tests/check-site.py`, `node --test tests/store-functions-test.mjs`,
  `tests/run-store-db-test.sh` (Postgres), `tests/e2e/run.sh` (Chromium + Postgres).

## Decisions made with the owner
- 36 pieces in 7 collections from the October 2026 catalogue; names and prices exactly as printed.
  All 18k yellow gold with zircon; the Seahorse Bracelet has zircon and pearls. Coloured stones (red,
  turquoise, black) are described as in the catalogue — **still to confirm whether they are zircon**.
- Categories: Necklaces, Earrings, Rings, Bracelets (the Moon/Star Handchain is a bracelet), Anklets.
- Delivery: Lebanon only, **not South Lebanon**; free collection by appointment. The courier is Wakilni,
  but **the courier is not named anywhere on the site** (owner's choice).
- Payment: website orders are **cash** (to the courier on delivery, or at collection); gift-voucher credit
  is applied first. The delivery fee is always paid to the courier in cash, never by voucher.
- Customers must be 18+ (tick box); birthday optional. Marketing by email/WhatsApp is opt-in.
- Gift vouchers: from $100, valid 6 months, jewellery only. Inactive accounts: reminder at 12 months,
  deletion notice at 24 months, deleted 30 days later; orders are kept.
- Policies come from the owner's document (`tools/policies-source.md`). No "last updated" lines, no
  business address, and no publication dates on Journal posts.
- Still to come from the owner: product measurements, Wakilni delivery fees per governorate.

## Regenerating pages
- Product pages, shop/home grids, sitemap entries and the product seed in `supabase/schema.sql`:
  edit the catalogue data in `tools/build_products.py`, then run `python3 tools/build_products.py`.
- Policy pages: edit `tools/policies-source.md` (or the replacements in `tools/build_policies.py`),
  then run `python3 tools/build_policies.py tools/policies-source.md`.
- Product photos are in `images/products/<slug>-N.jpg` (1200×1500 where the original allowed). They
  were cropped from the July 2026 shoot; the originals are on the owner's laptop
  ("Siaram Shoot July 2026").

## Where things stand
- All work is on the branch `claude/clever-newton-ss0xqg`, pull request #1 (green, ready to merge).
- Next: merge the PR, then follow `STORE-SETUP.md` (Supabase → Resend + name.com DNS → Netlify
  environment variables → put the Supabase URL and anon key in `js/store-config.js` → test order).
