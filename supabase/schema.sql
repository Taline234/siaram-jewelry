-- ==========================================================================
-- Siaram Jewelry — online store database (Supabase / Postgres)
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: it only creates what is missing and replaces functions.
--
-- Day-to-day you manage the store from Table Editor:
--   products        set a price to make a piece purchasable (empty = "Price on request")
--   delivery_areas  which governorates accept orders, and the delivery fee
--   store_settings  your Whish number and name shown at checkout
--   orders          incoming orders; change status when paid / dispatched
--   gift_vouchers   issue vouchers with:
--                     select issue_gift_voucher('Recipient', 'Purchaser', 150, 'recipient@email.com', '+961 70 000 000');
--   store_settings  also holds the next order number (S017, S018, ...) and the next voucher number (GV0001, ...)
-- ==========================================================================

-- ---------------------------------------------------------------- catalogue
create table if not exists public.products (
  slug        text primary key,
  name        text not null,
  category    text not null,
  price       numeric(10,2) check (price >= 0),
  available   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Photo shown in the cart and wishlist, relative to the website (e.g. images/my-piece.jpeg).
-- Each product's page is product-<slug>.html.
alter table public.products add column if not exists image text;

insert into public.products (slug, name, category, image, price) values
  ('horseshoe-necklace', 'Horse Shoe Necklace', 'Necklaces', 'images/products/horseshoe-necklace-1.jpg', 490),
  ('horseshoe-necklace-black-stone', 'Midnight Horseshoe Necklace', 'Necklaces', 'images/products/horseshoe-necklace-black-stone-1.jpg', 525),
  ('horseshoe-bracelet', 'Midnight Horseshoe Bracelet', 'Bracelets', 'images/products/horseshoe-bracelet-1.jpg', 450),
  ('horseshoe-ring', 'Horse Shoe Ring', 'Rings', 'images/products/horseshoe-ring-1.jpg', 350),
  ('horseshoe-chain-earrings', 'Horse Shoe Earring', 'Earrings', 'images/products/horseshoe-chain-earrings-1.jpg', 420),
  ('horse-eye-ring', 'Horse Eye Ring', 'Rings', 'images/products/horse-eye-ring-1.jpg', 555),
  ('horse-eye-stud', 'Horse Eye Stud', 'Earrings', 'images/products/horse-eye-stud-1.jpg', 410),
  ('horse-eye-bracelet', 'Horse Eye Bracelet', 'Bracelets', 'images/products/horse-eye-bracelet-1.jpg', 450),
  ('horse-eye-necklace', 'Horse Eye Necklace', 'Necklaces', 'images/products/horse-eye-necklace-1.jpg', 620),
  ('curved-marquise-necklace', 'Curved Marquise Necklace', 'Necklaces', 'images/products/curved-marquise-necklace-1.jpg', 610),
  ('curved-marquise-bracelet', 'Curved Marquise Bracelet', 'Bracelets', 'images/products/curved-marquise-bracelet-1.jpg', 465),
  ('curved-marquise-earrings', 'Curved Marquise Earrings', 'Earrings', 'images/products/curved-marquise-earrings-1.jpg', 540),
  ('eye-necklace', 'Eye Necklace', 'Necklaces', 'images/products/eye-necklace-1.jpg', 630),
  ('fatima-pearl-earrings', 'Fatima & Pearl Drop Asymmetric Earrings', 'Earrings', 'images/products/fatima-pearl-earrings-1.jpg', 450),
  ('fatima-necklace', 'Fatima Necklace', 'Necklaces', 'images/products/fatima-necklace-1.jpg', 645),
  ('fatima-ring', 'Fatima Ring', 'Rings', 'images/products/fatima-ring-1.jpg', 355),
  ('fatima-anklet', 'Fatima Anklet', 'Anklets', 'images/products/fatima-anklet-1.jpg', 420),
  ('v-pendant-necklace', 'V Pendant', 'Necklaces', 'images/products/v-pendant-necklace-1.jpg', 489),
  ('triangle-necklace', 'Triangle Necklace', 'Necklaces', 'images/products/triangle-necklace-1.jpg', 519),
  ('v-bird-necklace', 'V Bird Necklace', 'Necklaces', 'images/products/v-bird-necklace-1.jpg', 559),
  ('moon-star-handchain', 'Moon/Star Handchain', 'Bracelets', 'images/products/moon-star-handchain-1.jpg', 622),
  ('moon-star-pendant-earring', 'Moon & Star Pendant Earring', 'Earrings', 'images/products/moon-star-pendant-earring-1.jpg', 450),
  ('crescent-moon-earrings', 'Crescent Moon Earrings', 'Earrings', 'images/products/crescent-moon-earrings-1.jpg', 499.99),
  ('star-moon-necklace', 'Star/Moon Necklace', 'Necklaces', 'images/products/star-moon-necklace-1.jpg', 470),
  ('qamar-ring', 'Qamar Ring', 'Rings', 'images/products/qamar-ring-1.jpg', 430),
  ('crescent-moon-ring', 'Crescent Moon Ring', 'Rings', 'images/products/crescent-moon-ring-1.jpg', 340),
  ('sun-necklace', 'Sun Necklace', 'Necklaces', 'images/products/sun-necklace-1.jpg', 579.99),
  ('sun-ring', 'Sun Ring', 'Rings', 'images/products/sun-ring-1.jpg', 540),
  ('sun-stud-earrings', 'Sun Stud Earring', 'Earrings', 'images/products/sun-stud-earrings-1.jpg', 569),
  ('seahorse-pearl-bracelet', 'Seahorse Bracelet', 'Bracelets', 'images/products/seahorse-pearl-bracelet-1.jpg', 420),
  ('wave-bracelet', 'Wave Bracelet', 'Bracelets', 'images/products/wave-bracelet-1.jpg', 410),
  ('arrow-necklace', 'Arrow Necklace', 'Necklaces', 'images/products/arrow-necklace-1.jpg', 489),
  ('arrow-bracelet', 'Arrow Bracelet', 'Bracelets', 'images/products/arrow-bracelet-1.jpg', 689),
  ('arrow-earrings', 'Arrow Earring', 'Earrings', 'images/products/arrow-earrings-1.jpg', 499),
  ('arrow-open-ring', 'Diverge Arrow Ring', 'Rings', 'images/products/arrow-open-ring-1.jpg', 589),
  ('arrow-ring', 'Sahm Ring', 'Rings', 'images/products/arrow-ring-1.jpg', 679)
on conflict (slug) do update set name = excluded.name, category = excluded.category, image = excluded.image;

-- The product code from the finance workbook (Products tab). Shown on orders so they match the spreadsheet.
-- Earring pairs have one code each since the workbook's 22 October 2026 renumbering.
alter table public.products add column if not exists sku text;
update public.products p set sku = v.sku
  from (values
    ('horseshoe-necklace', 'NK-01'), ('horseshoe-necklace-black-stone', 'NK-05'), ('horseshoe-bracelet', 'BR-02'),
    ('horseshoe-ring', 'RG-04'), ('horseshoe-chain-earrings', 'EA-02'), ('horse-eye-ring', 'RG-07'),
    ('horse-eye-stud', 'EA-06'), ('horse-eye-bracelet', 'BR-08'), ('horse-eye-necklace', 'NK-10'),
    ('curved-marquise-necklace', 'NK-12'), ('curved-marquise-bracelet', 'BR-07'), ('curved-marquise-earrings', 'EA-08'),
    ('eye-necklace', 'NK-02'), ('fatima-pearl-earrings', 'EA-01'), ('fatima-necklace', 'NK-06'),
    ('fatima-ring', 'RG-03'), ('fatima-anklet', 'AK-01'), ('v-pendant-necklace', 'NK-08'),
    ('triangle-necklace', 'NK-09'), ('v-bird-necklace', 'NK-07'), ('moon-star-handchain', 'BR-04'),
    ('moon-star-pendant-earring', 'EA-03'), ('crescent-moon-earrings', 'EA-05'), ('star-moon-necklace', 'NK-03'),
    ('qamar-ring', 'RG-02'), ('crescent-moon-ring', 'RG-01'), ('sun-necklace', 'NK-11'),
    ('sun-ring', 'RG-08'), ('sun-stud-earrings', 'EA-07'), ('seahorse-pearl-bracelet', 'BR-01'),
    ('wave-bracelet', 'BR-06'), ('arrow-necklace', 'NK-04'), ('arrow-bracelet', 'BR-05'),
    ('arrow-earrings', 'EA-04'), ('arrow-open-ring', 'RG-05'), ('arrow-ring', 'RG-06')
  ) as v(slug, sku)
 where p.slug = v.slug and p.sku is distinct from v.sku;

-- Sizes a piece can be ordered in (rings and bracelets; empty = no size to choose).
-- Every piece is made to order. Filled in by tools/build_products.py.
alter table public.products add column if not exists sizes text[];
-- product sizes start
update public.products p set sizes = v.sizes
  from (values
    ('horseshoe-bracelet', array['11 cm', '11.5 cm', '12 cm', '12.5 cm', '13 cm', '13.5 cm', '14 cm', '14.5 cm', '15–17 cm', '17.5 cm', '18 cm', '18.5 cm', '19 cm', '19.5 cm', '20 cm', '20.5 cm', '21 cm', '21.5 cm', '22 cm']),
    ('horseshoe-ring', array['EU 44', 'EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59', 'EU 61', 'EU 62', 'EU 63', 'EU 65', 'EU 66', 'EU 67', 'EU 69', 'EU 70']),
    ('horse-eye-ring', array['EU 44', 'EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59', 'EU 61', 'EU 62', 'EU 63', 'EU 65', 'EU 66', 'EU 67', 'EU 69', 'EU 70']),
    ('horse-eye-bracelet', array['11 cm', '11.5 cm', '12 cm', '12.5 cm', '13 cm', '13.5 cm', '14 cm', '14.5 cm', '15 cm', '15.5 cm', '16–17.5 cm', '18 cm', '18.5 cm', '19 cm', '19.5 cm', '20 cm', '20.5 cm', '21 cm', '21.5 cm', '22 cm']),
    ('curved-marquise-bracelet', array['11 cm', '11.5 cm', '12 cm', '12.5 cm', '13 cm', '13.5 cm', '14 cm', '14.5 cm', '15–17 cm', '17.5 cm', '18 cm', '18.5 cm', '19 cm', '19.5 cm', '20 cm', '20.5 cm', '21 cm', '21.5 cm', '22 cm']),
    ('fatima-ring', array['EU 44', 'EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59', 'EU 61', 'EU 62', 'EU 63', 'EU 65', 'EU 66', 'EU 67', 'EU 69', 'EU 70']),
    ('moon-star-handchain', array['11 cm', '11.5 cm', '12 cm', '12.5 cm', '13 cm', '13.5 cm', '14 cm', '14.5 cm', '15 cm', '15.5 cm', '16–18 cm', '18.5 cm', '19 cm', '19.5 cm', '20 cm', '20.5 cm', '21 cm', '21.5 cm', '22 cm']),
    ('qamar-ring', array['EU 44', 'EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59', 'EU 61', 'EU 62', 'EU 63', 'EU 65', 'EU 66', 'EU 67', 'EU 69', 'EU 70']),
    ('crescent-moon-ring', array['EU 44', 'EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59', 'EU 61', 'EU 62', 'EU 63', 'EU 65', 'EU 66', 'EU 67', 'EU 69', 'EU 70']),
    ('sun-ring', array['EU 44', 'EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59', 'EU 61', 'EU 62', 'EU 63', 'EU 65', 'EU 66', 'EU 67', 'EU 69', 'EU 70']),
    ('seahorse-pearl-bracelet', array['11 cm', '11.5 cm', '12 cm', '12.5 cm', '13 cm', '13.5 cm', '14 cm', '14.5 cm', '15–16 cm', '16.5 cm', '17 cm', '17.5 cm', '18 cm', '18.5 cm', '19 cm', '19.5 cm', '20 cm', '20.5 cm', '21 cm', '21.5 cm', '22 cm']),
    ('wave-bracelet', array['11 cm', '11.5 cm', '12 cm', '12.5 cm', '13 cm', '13.5 cm', '14 cm', '14.5 cm', '15–16.5 cm', '17 cm', '17.5 cm', '18 cm', '18.5 cm', '19 cm', '19.5 cm', '20 cm', '20.5 cm', '21 cm', '21.5 cm', '22 cm']),
    ('arrow-bracelet', array['11 cm', '11.5 cm', '12 cm', '12.5 cm', '13 cm', '13.5 cm', '14 cm', '14.5 cm', '15 cm', '15.5 cm', '16–17 cm', '17.5 cm', '18 cm', '18.5 cm', '19 cm', '19.5 cm', '20 cm', '20.5 cm', '21 cm', '21.5 cm', '22 cm']),
    ('arrow-open-ring', array['EU 44', 'EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59', 'EU 61', 'EU 62', 'EU 63', 'EU 65', 'EU 66', 'EU 67', 'EU 69', 'EU 70']),
    ('arrow-ring', array['EU 44', 'EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59', 'EU 61', 'EU 62', 'EU 63', 'EU 65', 'EU 66', 'EU 67', 'EU 69', 'EU 70'])
  ) as v(slug, sizes)
 where p.slug = v.slug;
-- product sizes end

-- Lebanon only. South Lebanon does not accept orders.
create table if not exists public.delivery_areas (
  governorate     text primary key,
  accepts_orders  boolean not null default true,
  delivery_fee    numeric(10,2) check (delivery_fee >= 0),  -- empty = confirmed after ordering
  sort            int not null default 0
);

insert into public.delivery_areas (governorate, accepts_orders, sort) values
  ('Beirut', true, 1), ('Mount Lebanon', true, 2), ('North', true, 3), ('Akkar', true, 4),
  ('Bekaa', true, 5), ('Baalbek-Hermel', true, 6), ('Nabatieh', true, 7), ('South', false, 8)
on conflict (governorate) do nothing;

create table if not exists public.store_settings (
  id                    int primary key default 1 check (id = 1),
  whish_number          text,
  whish_name            text,
  voucher_valid_months  int not null default 6
);
insert into public.store_settings (id) values (1) on conflict (id) do nothing;

-- Order numbers carry on from the finance workbook's invoice numbers (last sale S016, in person); gift vouchers start at GV0001.
-- Taken inside the same transaction as the order or voucher, so a failed order never skips a number.
alter table public.store_settings add column if not exists next_order_number int not null default 16;
alter table public.store_settings add column if not exists next_voucher_number int not null default 1;
-- S016 went to an in-person sale on 29 October 2026, so website orders start at S017. Never moves the number back.
update public.store_settings set next_order_number = 17 where id = 1 and next_order_number < 17;

-- ---------------------------------------------------------------- customers
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  first_name              text not null,
  last_name               text not null,
  phone                   text not null,
  date_of_birth           date,                       -- optional, for birthday offers
  age_confirmed           boolean not null default false,
  marketing_email         boolean not null default false,
  marketing_whatsapp      boolean not null default false,
  marketing_updated_at    timestamptz,
  created_at              timestamptz not null default now(),
  last_active_at          timestamptz not null default now(),
  inactivity_reminder_at  timestamptz,
  deletion_notice_at      timestamptz
);
-- Earlier versions of this file required a date of birth; the birthday is now optional.
alter table public.profiles alter column date_of_birth drop not null;
alter table public.profiles add column if not exists age_confirmed boolean not null default false;
alter table public.profiles add column if not exists marketing_email boolean not null default false;
alter table public.profiles add column if not exists marketing_whatsapp boolean not null default false;
alter table public.profiles add column if not exists marketing_updated_at timestamptz;

-- A birthday, when given, must be at least 18 years ago.
create or replace function public.assert_adult(dob date) returns void
language plpgsql stable as $$
begin
  if dob is not null and dob > (current_date - interval '18 years')::date then
    raise exception 'You must be 18 or older to create an account.' using errcode = 'P0001';
  end if;
end $$;

-- A profile is created with every new login. Sign-up fails unless the person confirms
-- they are 18 or older (and any birthday they give agrees).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  dob  date;
begin
  begin
    dob := nullif(meta->>'date_of_birth', '')::date;
  exception when others then
    dob := null;
  end;
  if coalesce((meta->>'age_confirmed')::boolean, false) is not true then
    raise exception 'You must be 18 or older to create an account.' using errcode = 'P0001';
  end if;
  perform public.assert_adult(dob);
  insert into public.profiles (id, first_name, last_name, phone, date_of_birth, age_confirmed,
                               marketing_email, marketing_whatsapp, marketing_updated_at)
  values (new.id,
          coalesce(nullif(trim(meta->>'first_name'), ''), ''),
          coalesce(nullif(trim(meta->>'last_name'), ''), ''),
          coalesce(nullif(trim(meta->>'phone'), ''), ''),
          dob, true,
          coalesce((meta->>'marketing_email')::boolean, false),
          coalesce((meta->>'marketing_whatsapp')::boolean, false),
          now());
  return new;
end $$;

-- Customers may add or change their birthday later (still 18+), and every change to their
-- marketing choices is time-stamped as a record of consent.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_adult(new.date_of_birth);
  if new.marketing_email is distinct from old.marketing_email
     or new.marketing_whatsapp is distinct from old.marketing_whatsapp then
    new.marketing_updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.addresses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label           text,
  recipient_name  text not null,
  phone           text not null,
  governorate     text not null references public.delivery_areas (governorate),
  city            text not null,
  street          text not null,
  building        text,
  floor           text,
  notes           text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);
create unique index if not exists addresses_one_default on public.addresses (user_id) where is_default;

-- Only one default ("preferred") address per customer.
create or replace function public.addresses_single_default() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then
    update public.addresses set is_default = false
     where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end $$;

drop trigger if exists addresses_single_default on public.addresses;
create trigger addresses_single_default before insert or update of is_default on public.addresses
  for each row execute function public.addresses_single_default();

create table if not exists public.wishlist (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_slug  text not null references public.products (slug) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, product_slug)
);

-- ---------------------------------------------------------------- orders
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  user_id         uuid references auth.users (id) on delete set null,
  customer_name   text not null,
  email           text not null,
  phone           text not null,
  fulfilment      text not null default 'delivery' check (fulfilment in ('delivery', 'collection')),
  governorate     text,            -- empty for collection by appointment
  city            text,
  street          text,
  building        text,
  floor           text,
  notes           text,
  subtotal        numeric(10,2) not null,
  delivery_fee    numeric(10,2),   -- paid to the courier in cash; not part of total
  voucher_code    text,
  voucher_amount  numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  payment_method  text not null default 'whish',
  status          text not null default 'awaiting_payment'
                  check (status in ('awaiting_payment','paid','preparing','dispatched','delivered','cancelled')),
  age_confirmed   boolean not null,
  created_at      timestamptz not null default now()
);

alter table public.orders add column if not exists fulfilment text not null default 'delivery';
-- When the customer ticked "I agree to the delivery and returns terms" at checkout.
alter table public.orders add column if not exists terms_accepted_at timestamptz;
-- How the customer pays: 'whish' before production, or 'cash' to the courier on delivery. Older orders may be collections.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('whish', 'cash', 'card', 'bank', 'voucher'));  -- card, bank, voucher: sales recorded by the owner
-- Website orders are cash only (Whish stays allowed for older orders). A new order starts as 'received':
-- submitted by the customer and waiting for us to confirm it.
alter table public.orders alter column payment_method set default 'cash';
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('received','awaiting_payment','paid','preparing','dispatched','delivered','cancelled'));
-- One order per checkout submission: a repeated or double-clicked submission returns the first order.
alter table public.orders add column if not exists submission_id text unique;
alter table public.orders alter column governorate drop not null;
-- For the "on its way" email (see order_dispatched below): the courier's tracking number, and when it was sent.
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists dispatched_email_at timestamptz;
alter table public.orders alter column city drop not null;
alter table public.orders alter column street drop not null;

create table if not exists public.order_items (
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_slug  text not null,
  name          text not null,
  unit_price    numeric(10,2) not null,
  quantity      int not null check (quantity between 1 and 10),
  primary key (order_id, product_slug)
);
alter table public.order_items add column if not exists sku text;
-- The same piece can be ordered in more than one metal or size, so each combination is its own line.
alter table public.order_items add column if not exists metal text not null default 'yellow'
  check (metal in ('yellow', 'rose', 'white'));
alter table public.order_items add column if not exists size text not null default '';
alter table public.order_items drop constraint if exists order_items_pkey;
alter table public.order_items add constraint order_items_pkey primary key (order_id, product_slug, metal, size);
-- True when the piece was not in stock when ordered: made to order (3-4 weeks, paid by Whish, final sale).
alter table public.order_items add column if not exists made_to_order boolean not null default false;

-- ---------------------------------------------------------------- stock
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Pieces ready to ship, per piece, metal and size ('' for pieces without sizes). Edit quantities in the
-- Table Editor. Anything not listed here (or at 0) is made to order. Website orders take pieces off
-- automatically, and cancelling an order puts them back.
create table if not exists public.stock (
  product_slug text not null references public.products (slug) on update cascade on delete cascade,
  metal        text not null default 'yellow' check (metal in ('yellow', 'rose', 'white')),
  size         text not null default '',
  quantity     int  not null default 0 check (quantity >= 0),
  updated_at   timestamptz not null default now(),
  primary key (product_slug, metal, size)
);
alter table public.stock enable row level security;

-- Stock on 2 November 2026 (finance workbook, Production Batches): all 18k yellow gold; rings in the
-- sizes made, bracelets in their standard length. Only added once, so later edits are kept.
insert into public.stock (product_slug, metal, size, quantity) values
  ('fatima-anklet', 'yellow', '', 1),
  ('seahorse-pearl-bracelet', 'yellow', '15–16 cm', 1),
  ('moon-star-handchain', 'yellow', '16–18 cm', 1),
  ('arrow-bracelet', 'yellow', '16–17 cm', 1),
  ('wave-bracelet', 'yellow', '15–16.5 cm', 1),
  ('curved-marquise-bracelet', 'yellow', '15–17 cm', 1),
  ('horse-eye-bracelet', 'yellow', '16–17.5 cm', 1),
  ('fatima-pearl-earrings', 'yellow', '', 1),
  ('horseshoe-chain-earrings', 'yellow', '', 1),
  ('moon-star-pendant-earring', 'yellow', '', 1),
  ('arrow-earrings', 'yellow', '', 1),
  ('crescent-moon-earrings', 'yellow', '', 1),
  ('horse-eye-stud', 'yellow', '', 1),
  ('sun-stud-earrings', 'yellow', '', 1),
  ('curved-marquise-earrings', 'yellow', '', 1),
  ('horseshoe-necklace', 'yellow', '', 1),
  ('eye-necklace', 'yellow', '', 1),
  ('star-moon-necklace', 'yellow', '', 1),
  ('arrow-necklace', 'yellow', '', 1),
  ('horseshoe-necklace-black-stone', 'yellow', '', 1),
  ('fatima-necklace', 'yellow', '', 1),
  ('v-bird-necklace', 'yellow', '', 1),
  ('horse-eye-necklace', 'yellow', '', 1),
  ('sun-necklace', 'yellow', '', 1),
  ('curved-marquise-necklace', 'yellow', '', 1),
  ('qamar-ring', 'yellow', 'EU 55', 1),
  ('fatima-ring', 'yellow', 'EU 54', 1),
  ('horseshoe-ring', 'yellow', 'EU 54', 1),
  ('arrow-open-ring', 'yellow', 'EU 55', 1),
  ('arrow-ring', 'yellow', 'EU 55', 1),
  ('horse-eye-ring', 'yellow', 'EU 54', 1),
  ('sun-ring', 'yellow', 'EU 54', 1)
on conflict (product_slug, metal, size) do nothing;

-- Stock missing from the 2 November list (added once): the V Pendant and the Crescent Moon Ring were in stock;
-- the Midnight Horseshoe Bracelet (sold as S016) and the Triangle Necklace are listed at 0 so every piece shows.
insert into public.stock (product_slug, metal, size, quantity) values
  ('v-pendant-necklace', 'yellow', '', 1),
  ('crescent-moon-ring', 'yellow', 'EU 54', 1),
  ('horseshoe-bracelet', 'yellow', '15–17 cm', 0),
  ('triangle-necklace', 'yellow', '', 0)
on conflict (product_slug, metal, size) do nothing;

-- For reading the table: each row's piece name and SKU, and the chain length of pieces that have no size to
-- choose (necklaces, earrings, the anklet). Information only; the website uses product_slug, metal and size.
alter table public.stock add column if not exists piece text;
alter table public.stock add column if not exists length text;
update public.stock s set piece = p.name || coalesce(' (' || p.sku || ')', '')
  from public.products p where p.slug = s.product_slug and s.piece is distinct from p.name || coalesce(' (' || p.sku || ')', '');
update public.stock s set length = v.length
  from (values
  ('arrow-earrings', 'Drop chain: 4 cm'),
  ('arrow-necklace', '41 cm chain + 5.5 cm drop chain'),
  ('curved-marquise-earrings', 'Drop chain: 2 cm'),
  ('curved-marquise-necklace', '50–52 cm chain (adjustable)'),
  ('eye-necklace', '40–52.5 cm chain (adjustable)'),
  ('fatima-anklet', 'Chain: 21–22 cm (adjustable)'),
  ('fatima-necklace', '38–40 cm chain (adjustable) + 5.5 cm drop chain (blue pearls to white pearl)'),
  ('fatima-pearl-earrings', 'Drop chain: 3 cm'),
  ('horse-eye-necklace', '37–40 cm chain (adjustable)'),
  ('horse-eye-stud', 'Stud earrings'),
  ('horseshoe-necklace', '40 cm chain + 6 cm drop chain'),
  ('horseshoe-necklace-black-stone', '39.5–41.5 cm chain (adjustable) + 5 cm drop chain'),
  ('moon-star-handchain', 'Moon to star: 2.5 cm; Finger chain: 7 cm'),
  ('moon-star-pendant-earring', 'Star chain: 2.5 cm; Moon chain: 3.5 cm'),
  ('star-moon-necklace', '43 cm chain + 3 cm drop chain'),
  ('sun-necklace', '35–38 cm chain (adjustable)'),
  ('sun-stud-earrings', 'Stud earrings'),
  ('triangle-necklace', '50–52 cm chain (adjustable)'),
  ('v-bird-necklace', '39–41.5 cm chain (adjustable)'),
  ('v-pendant-necklace', '50–52 cm chain (adjustable)')
  ) as v(slug, length)
 where s.product_slug = v.slug and s.length is distinct from v.length;

-- What the website may show: which piece, metal and size combinations are ready to ship, and how many, so the
-- cart and checkout can say "made to order" before an order asks for more than there is in stock.
drop function if exists public.available_stock();
create function public.available_stock() returns table (product_slug text, metal text, size text, quantity int)
language sql stable security definer set search_path = public as $$
  select s.product_slug, s.metal, s.size, s.quantity from public.stock s where s.quantity > 0;
$$;

-- Cancelling an order puts its in-stock pieces back.
create or replace function private.order_cancelled() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.stock (product_slug, metal, size, quantity)
  select i.product_slug, i.metal, i.size, i.quantity from public.order_items i
   where i.order_id = new.id and not i.made_to_order
  on conflict (product_slug, metal, size)
    do update set quantity = stock.quantity + excluded.quantity, updated_at = now();
  return new;
end;
$$;

drop trigger if exists order_cancelled on public.orders;
create trigger order_cancelled after update of status on public.orders
  for each row when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function private.order_cancelled();

-- ---------------------------------------------------------------- gift vouchers
create table if not exists public.gift_vouchers (
  code            text primary key,
  recipient_name  text not null,
  purchaser_name  text not null,
  amount          numeric(10,2) not null check (amount > 0),
  balance         numeric(10,2) not null check (balance >= 0),
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null,
  status          text not null default 'active' check (status in ('active','void')),
  notes           text
);
-- Only the named recipient may redeem a voucher: checkout asks for their email or phone number.
alter table public.gift_vouchers add column if not exists recipient_email text;
alter table public.gift_vouchers add column if not exists recipient_phone text;

create table if not exists public.voucher_redemptions (
  id            uuid primary key default gen_random_uuid(),
  voucher_code  text not null references public.gift_vouchers (code),
  order_id      uuid not null references public.orders (id) on delete cascade,
  amount        numeric(10,2) not null,
  created_at    timestamptz not null default now()
);

-- Run from the SQL Editor, with the recipient's email and/or phone number from the purchaser:
--   select issue_gift_voucher('Recipient Name', 'Purchaser Name', 150, 'recipient@email.com', '+961 70 000 000');
-- Codes look like GV0001-K7QM4X: the GV number for the finance workbook, plus a random part so that
-- nobody can spend a voucher by guessing the next number.
drop function if exists public.issue_gift_voucher(text, text, numeric);
create or replace function public.issue_gift_voucher(p_recipient text, p_purchaser text, p_amount numeric,
                                                     p_recipient_email text default null,
                                                     p_recipient_phone text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  -- No I or O, which are easily mistaken for 1 and 0.
  c_letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_number int;
  v_months int;
  v_random bytea;
  v_code   text;
begin
  if p_amount is null or p_amount < 100 then
    raise exception 'Gift vouchers start at $100.';
  end if;
  if coalesce(trim(p_recipient_email), '') = '' and coalesce(trim(p_recipient_phone), '') = '' then
    raise exception 'Add the recipient''s email or phone number, so that only they can use the voucher.';
  end if;
  update public.store_settings set next_voucher_number = next_voucher_number + 1 where id = 1
  returning next_voucher_number - 1, voucher_valid_months into v_number, v_months;
  v_random := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_code := 'GV' || lpad(v_number::text, greatest(4, length(v_number::text)), '0') || '-';
  for i in 0..5 loop
    v_code := v_code || substr(c_letters, get_byte(v_random, i) % 32 + 1, 1);
  end loop;
  insert into public.gift_vouchers (code, recipient_name, purchaser_name, amount, balance, expires_at,
                                    recipient_email, recipient_phone)
  values (v_code, p_recipient, p_purchaser, p_amount, p_amount,
          now() + make_interval(months => coalesce(v_months, 6)),
          nullif(lower(trim(p_recipient_email)), ''), nullif(trim(p_recipient_phone), ''));
  return v_code;
end $$;

-- Returns the usable voucher, or raises a customer-facing error.
create or replace function public.usable_voucher(p_code text, p_lock boolean default false)
returns public.gift_vouchers language plpgsql security definer set search_path = public as $$
declare
  v      public.gift_vouchers;
  -- Customers may type the code in lower case, or with spaces or without the dash.
  v_code text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
begin
  if p_lock then
    select * into v from public.gift_vouchers where replace(code, '-', '') = v_code for update;
  else
    select * into v from public.gift_vouchers where replace(code, '-', '') = v_code;
  end if;
  if not found or v.status <> 'active' then
    raise exception 'This gift voucher code is not valid.' using errcode = 'P0001';
  end if;
  if v.expires_at <= now() then
    raise exception 'This gift voucher expired on %.', to_char(v.expires_at, 'DD Mon YYYY') using errcode = 'P0001';
  end if;
  if v.balance <= 0 then
    raise exception 'This gift voucher has already been fully used.' using errcode = 'P0001';
  end if;
  return v;
end $$;

-- True when the email or phone given at checkout is the recipient's. Phone numbers are compared on
-- their last 8 digits, so "+961 70 123 456" and "70123456" match.
create or replace function public.is_voucher_recipient(v public.gift_vouchers, p_email text, p_phone text)
returns boolean language sql immutable set search_path = public as $$
  select (v.recipient_email is null and v.recipient_phone is null)
      or lower(trim(coalesce(p_email, ''))) = v.recipient_email
      or (length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 7
          and right(regexp_replace(p_phone, '\D', '', 'g'), 8) = right(regexp_replace(coalesce(v.recipient_phone, ''), '\D', '', 'g'), 8));
$$;

create or replace function public.voucher_for_recipient(p_code text, p_email text, p_phone text, p_lock boolean default false)
returns public.gift_vouchers language plpgsql security definer set search_path = public as $$
declare
  v public.gift_vouchers := public.usable_voucher(p_code, p_lock);
begin
  if not public.is_voucher_recipient(v, p_email, p_phone) then
    raise exception 'This gift voucher can only be used by its recipient. Please enter the email or phone number it was sent to in your details above.'
      using errcode = 'P0001';
  end if;
  return v;
end $$;

drop function if exists public.check_voucher(text);
create or replace function public.check_voucher(p_code text, p_email text default null, p_phone text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.gift_vouchers := public.voucher_for_recipient(p_code, p_email, p_phone);
begin
  return jsonb_build_object('code', v.code, 'balance', v.balance, 'expires_at', v.expires_at,
                            'recipient_name', v.recipient_name);
end $$;

-- ---------------------------------------------------------------- place an order
-- Called only by the website's server (Netlify function) with the service key.
-- Prices, delivery rules and vouchers are all checked here, never trusted from the browser.
-- What the website and the order emails get back about an order.
create or replace function public.order_summary(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
      'reference', o.reference, 'customer_name', o.customer_name, 'email', o.email, 'phone', o.phone,
      'fulfilment', o.fulfilment, 'payment_method', o.payment_method, 'status', o.status,
      'governorate', o.governorate, 'city', o.city, 'street', o.street, 'building', o.building,
      'floor', o.floor, 'notes', o.notes, 'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee,
      'voucher_code', o.voucher_code, 'voucher_amount', o.voucher_amount, 'total', o.total,
      'tracking_number', o.tracking_number,
      'items', (select jsonb_agg(jsonb_build_object('sku', i.sku, 'name', i.name, 'unit_price', i.unit_price,
                                                    'quantity', i.quantity, 'metal', i.metal, 'size', i.size,
                                                    'made_to_order', i.made_to_order)
                                                    order by i.name)
                  from public.order_items i where i.order_id = o.id))
      from public.orders o cross join public.store_settings s
     where o.id = p_order_id and s.id = 1;
$$;
revoke all on function public.order_summary(uuid) from public, anon, authenticated;

create or replace function public.place_order(p jsonb, p_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_area      public.delivery_areas;
  v_voucher   public.gift_vouchers;
  v_item      jsonb;
  v_product   public.products;
  v_qty       int;
  v_metal     text;
  v_size      text;
  v_subtotal  numeric(10,2) := 0;
  v_discount  numeric(10,2) := 0;
  v_total     numeric(10,2);
  v_ref       text;
  v_order_id  uuid;
  v_field     text;
  v_collect   boolean := coalesce(p->>'fulfilment', 'delivery') = 'collection';
  v_existing  uuid;
  v_in_stock  boolean;
begin
  -- A repeated submission (double click, retry after a dropped connection) returns the order already placed.
  if coalesce(p->>'submission_id', '') <> '' then
    perform pg_advisory_xact_lock(hashtext('order:' || (p->>'submission_id')));
    select id into v_existing from public.orders where submission_id = p->>'submission_id';
    if found then
      return public.order_summary(v_existing) || jsonb_build_object('duplicate', true);
    end if;
  end if;

  if coalesce((p->>'age_confirmed')::boolean, false) is not true then
    raise exception 'You must confirm you are 18 or older to order.' using errcode = 'P0001';
  end if;

  if coalesce((p->>'terms_accepted')::boolean, false) is not true then
    raise exception 'Please agree to the delivery and returns terms to place your order.' using errcode = 'P0001';
  end if;

  -- Collection was withdrawn on 30 October 2026: website orders are delivered by courier.
  if coalesce(p->>'fulfilment', 'delivery') <> 'delivery' then
    raise exception 'Collection is no longer available. We deliver within Lebanon by courier.' using errcode = 'P0001';
  end if;
  if coalesce(p->>'payment_method', 'cash') <> 'cash' then
    raise exception 'Website orders are paid in cash.' using errcode = 'P0001';
  end if;
  foreach v_field in array (case when v_collect then array['customer_name','email','phone']
                                 else array['customer_name','email','phone','governorate','city','street'] end) loop
    if coalesce(trim(p->>v_field), '') = '' then
      raise exception 'Please fill in your %.', replace(v_field, '_', ' ') using errcode = 'P0001';
    end if;
  end loop;
  if (p->>'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;

  -- Collection by appointment is free and needs no address.
  if not v_collect then
    select * into v_area from public.delivery_areas where governorate = p->>'governorate';
    if not found then
      raise exception 'We only deliver within Lebanon. Please choose your governorate.' using errcode = 'P0001';
    end if;
    if not v_area.accepts_orders then
      raise exception 'Sorry, we do not currently deliver to %.', v_area.governorate using errcode = 'P0001';
    end if;
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  update public.store_settings set next_order_number = next_order_number + 1 where id = 1
  returning 'S' || lpad((next_order_number - 1)::text, 3, '0') into v_ref;
  insert into public.orders (reference, user_id, customer_name, email, phone, fulfilment, governorate, city, street,
                             building, floor, notes, subtotal, delivery_fee, total, age_confirmed,
                             payment_method, status, terms_accepted_at, submission_id)
  values (v_ref, p_user_id, trim(p->>'customer_name'), lower(trim(p->>'email')), trim(p->>'phone'),
          case when v_collect then 'collection' else 'delivery' end,
          v_area.governorate, nullif(trim(p->>'city'), ''), nullif(trim(p->>'street'), ''),
          nullif(trim(p->>'building'), ''), nullif(trim(p->>'floor'), ''), nullif(trim(p->>'notes'), ''),
          0, v_area.delivery_fee, 0, true,
          -- Cash orders are paid on delivery or collection, so they go straight to preparation.
          'cash', 'received', now(), nullif(p->>'submission_id', ''))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_product := null;
    select * into v_product from public.products where slug = v_item->>'slug';
    if not found or not v_product.available or v_product.price is null then
      raise exception 'Sorry, "%" is not available to order online right now.',
        coalesce(v_product.name, v_item->>'slug') using errcode = 'P0001';
    end if;
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty < 1 or v_qty > 10 then
      raise exception 'Please choose a quantity between 1 and 10.' using errcode = 'P0001';
    end if;
    v_metal := coalesce(nullif(v_item->>'metal', ''), 'yellow');
    if v_metal not in ('yellow', 'rose', 'white') then
      raise exception 'Please choose yellow, rose or white gold.' using errcode = 'P0001';
    end if;
    v_size := coalesce(trim(v_item->>'size'), '');
    if v_product.sizes is null then
      v_size := '';
    elsif not (v_size = any(v_product.sizes)) then
      raise exception 'Please choose a size for the %.', v_product.name using errcode = 'P0001';
    end if;
    -- Ready to ship if enough are in stock (taken off now, row-locked, so two orders cannot take the
    -- same piece); otherwise the line is made to order.
    update public.stock set quantity = quantity - v_qty, updated_at = now()
     where product_slug = v_product.slug and metal = v_metal and size = v_size and quantity >= v_qty;
    v_in_stock := found;
    insert into public.order_items (order_id, product_slug, sku, name, unit_price, quantity, metal, size, made_to_order)
    values (v_order_id, v_product.slug, v_product.sku, v_product.name, v_product.price, v_qty, v_metal, v_size, not v_in_stock)
    on conflict (order_id, product_slug, metal, size)
      do update set quantity = least(order_items.quantity + excluded.quantity, 10),
                    made_to_order = order_items.made_to_order or excluded.made_to_order;
    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  -- The total is the price of the jewellery, paid by Whish or in cash on delivery. The delivery
  -- fee is paid to the courier in cash, so it is not included, and a gift voucher cannot cover it.
  v_total := v_subtotal;

  if coalesce(trim(p->>'voucher_code'), '') <> '' then
    v_voucher := public.voucher_for_recipient(p->>'voucher_code', p->>'email', p->>'phone', true);
    v_discount := least(v_voucher.balance, v_total);
    update public.gift_vouchers set balance = balance - v_discount where code = v_voucher.code;
    insert into public.voucher_redemptions (voucher_code, order_id, amount)
    values (v_voucher.code, v_order_id, v_discount);
    v_total := v_total - v_discount;
  end if;

  update public.orders
     set subtotal = v_subtotal, voucher_code = v_voucher.code, voucher_amount = v_discount, total = v_total
   where id = v_order_id;

  if p_user_id is not null then
    update public.profiles set last_active_at = now(), inactivity_reminder_at = null, deletion_notice_at = null
     where id = p_user_id;
  end if;

  return public.order_summary(v_order_id);
end $$;

-- ---------------------------------------------------------------- sales recorded by the owner
-- In-person, Instagram, WhatsApp and event sales, recorded on the account page (Record a Sale tab). They are
-- orders like website ones (same S numbers, so the workbook invoice numbers stay in one sequence), with the
-- sales channel, the agreed price per piece and how it was paid. Pieces taken from stock come off it.
alter table public.orders add column if not exists channel text not null default 'Website';
alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel in ('Website', 'In person', 'Instagram', 'WhatsApp', 'Event', 'Other'));
create or replace function public.record_sale(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_item      jsonb;
  v_product   public.products;
  v_voucher   public.gift_vouchers;
  v_qty       int;
  v_metal     text;
  v_size      text;
  v_price     numeric(10,2);
  v_subtotal  numeric(10,2) := 0;
  v_discount  numeric(10,2) := 0;
  v_ref       text;
  v_order_id  uuid;
  v_made      boolean := false;
  v_date      date := coalesce(nullif(p->>'sale_date', '')::date, (now() at time zone 'Asia/Beirut')::date);
begin
  if coalesce(trim(p->>'customer_name'), '') = '' then
    raise exception 'Please enter the customer''s name.' using errcode = 'P0001';
  end if;
  if coalesce(p->>'channel', '') not in ('In person', 'Instagram', 'WhatsApp', 'Event', 'Other') then
    raise exception 'Please choose where the sale was made.' using errcode = 'P0001';
  end if;
  if coalesce(p->>'payment_method', '') not in ('cash', 'whish', 'card', 'bank', 'voucher') then
    raise exception 'Please choose how it was paid.' using errcode = 'P0001';
  end if;
  if v_date > (now() at time zone 'Asia/Beirut')::date then
    raise exception 'The sale date cannot be in the future.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Please add at least one piece.' using errcode = 'P0001';
  end if;

  update public.store_settings set next_order_number = next_order_number + 1 where id = 1
  returning 'S' || lpad((next_order_number - 1)::text, 3, '0') into v_ref;
  insert into public.orders (reference, customer_name, email, phone, fulfilment, notes, subtotal, total, age_confirmed,
                             payment_method, status, channel, created_at)
  values (v_ref, trim(p->>'customer_name'), lower(trim(coalesce(p->>'email', ''))), trim(coalesce(p->>'phone', '')),
          'collection', nullif(trim(p->>'notes'), ''), 0, 0, true, p->>'payment_method', 'delivered', p->>'channel',
          (v_date + time '12:00') at time zone 'Asia/Beirut')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    select * into v_product from public.products where slug = v_item->>'slug';
    if not found then
      raise exception 'Please choose the piece for every line.' using errcode = 'P0001';
    end if;
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty < 1 or v_qty > 10 then
      raise exception 'Please enter a quantity between 1 and 10.' using errcode = 'P0001';
    end if;
    v_metal := coalesce(nullif(v_item->>'metal', ''), 'yellow');
    if v_metal not in ('yellow', 'rose', 'white') then
      raise exception 'Please choose yellow, rose or white gold.' using errcode = 'P0001';
    end if;
    v_size := coalesce(trim(v_item->>'size'), '');
    if v_product.sizes is null then
      v_size := '';
    elsif not (v_size = any(v_product.sizes)) then
      raise exception 'Please choose a size for the %.', v_product.name using errcode = 'P0001';
    end if;
    v_price := coalesce(nullif(v_item->>'unit_price', '')::numeric, v_product.price);
    if v_price is null or v_price < 0 then
      raise exception 'Please enter the price of the %.', v_product.name using errcode = 'P0001';
    end if;
    if coalesce((v_item->>'from_stock')::boolean, true) then
      update public.stock set quantity = quantity - v_qty, updated_at = now()
       where product_slug = v_product.slug and metal = v_metal and size = v_size and quantity >= v_qty;
      if not found then
        raise exception 'The % (% gold%) is not in stock. Untick "Taken from stock" if it is being made to order.',
          v_product.name, v_metal, case when v_size <> '' then ', size ' || v_size else '' end using errcode = 'P0001';
      end if;
    else
      v_made := true;
    end if;
    insert into public.order_items (order_id, product_slug, sku, name, unit_price, quantity, metal, size, made_to_order)
    values (v_order_id, v_product.slug, v_product.sku, v_product.name, v_price, v_qty, v_metal, v_size,
            not coalesce((v_item->>'from_stock')::boolean, true))
    on conflict (order_id, product_slug, metal, size)
      do update set quantity = least(order_items.quantity + excluded.quantity, 10);
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  -- A gift voucher used in person: its balance pays as much of the sale as it can.
  if coalesce(trim(p->>'voucher_code'), '') <> '' then
    v_voucher := public.usable_voucher(p->>'voucher_code', true);
    v_discount := least(v_voucher.balance, v_subtotal);
    update public.gift_vouchers set balance = balance - v_discount where code = v_voucher.code;
    insert into public.voucher_redemptions (voucher_code, order_id, amount) values (v_voucher.code, v_order_id, v_discount);
  elsif p->>'payment_method' = 'voucher' then
    raise exception 'Please enter the gift voucher code.' using errcode = 'P0001';
  end if;

  update public.orders
     set subtotal = v_subtotal, voucher_code = v_voucher.code, voucher_amount = v_discount, total = v_subtotal - v_discount,
         status = case when v_made then 'preparing' else 'delivered' end
   where id = v_order_id;
  return public.order_summary(v_order_id);
end $$;

-- ---------------------------------------------------------------- custom-piece requests
-- From the form on the Custom page. Sketches and photos are attached to the email the shop receives;
-- only their file names are kept here. Status is for the owner: new, quoted, approved, in production, done, declined.
create table if not exists public.custom_requests (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique,
  name         text not null,
  email        text not null,
  phone        text not null,
  piece        text not null,
  gold         text not null,
  stones       text[] not null default '{}',
  cut          text,
  setting      text,
  size         text,
  description  text not null,
  occasion     date,
  budget       text,
  files        text[] not null default '{}',
  status       text not null default 'new'
               check (status in ('new', 'quoted', 'approved', 'in production', 'done', 'declined')),
  created_at   timestamptz not null default now()
);
alter table public.custom_requests enable row level security;
alter table public.custom_requests add column if not exists setting text;
alter table public.store_settings add column if not exists next_custom_number int not null default 1;

create or replace function public.save_custom_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
  v_field text;
begin
  foreach v_field in array array['name', 'email', 'phone', 'piece', 'gold', 'description'] loop
    if coalesce(trim(p->>v_field), '') = '' then
      raise exception 'Please fill in the % field.', v_field using errcode = 'P0001';
    end if;
  end loop;
  if (p->>'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;
  update public.store_settings set next_custom_number = next_custom_number + 1 where id = 1
  returning 'CR' || lpad((next_custom_number - 1)::text, 3, '0') into v_ref;
  insert into public.custom_requests (reference, name, email, phone, piece, gold, stones, cut, setting, size, description,
                                      occasion, budget, files)
  values (v_ref, trim(p->>'name'), lower(trim(p->>'email')), trim(p->>'phone'), p->>'piece', p->>'gold',
          coalesce((select array_agg(x) from jsonb_array_elements_text(p->'stones') x), '{}'),
          nullif(p->>'cut', ''), nullif(p->>'setting', ''), nullif(trim(p->>'size'), ''), trim(p->>'description'),
          nullif(p->>'occasion', '')::date, nullif(p->>'budget', ''),
          coalesce((select array_agg(x) from jsonb_array_elements_text(p->'files') x), '{}'));
  return jsonb_build_object('reference', v_ref);
end $$;

-- ---------------------------------------------------------------- return and repair requests
-- From the form on return-repair.html. Photos are attached to the email the shop receives; only their file names are
-- kept here. Status is for the owner: new, instructions sent, received, in repair, done, declined.
create table if not exists public.service_requests (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique,
  kind         text not null check (kind in ('Return', 'Exchange', 'Repair')),
  order_ref    text not null,
  piece        text not null,
  problem      text not null,
  cause        text not null,
  name         text not null,
  email        text not null,
  phone        text not null,
  files        text[] not null default '{}',
  status       text not null default 'new'
               check (status in ('new', 'instructions sent', 'received', 'in repair', 'done', 'declined')),
  created_at   timestamptz not null default now()
);
alter table public.service_requests enable row level security;
alter table public.store_settings add column if not exists next_service_number int not null default 1;

create or replace function public.save_service_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
  v_field text;
begin
  foreach v_field in array array['kind', 'order_ref', 'piece', 'problem', 'cause', 'name', 'email', 'phone'] loop
    if coalesce(trim(p->>v_field), '') = '' then
      raise exception 'Please fill in the % field.', v_field using errcode = 'P0001';
    end if;
  end loop;
  if (p->>'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;
  update public.store_settings set next_service_number = next_service_number + 1 where id = 1
  returning 'RR' || lpad((next_service_number - 1)::text, 3, '0') into v_ref;
  insert into public.service_requests (reference, kind, order_ref, piece, problem, cause, name, email, phone, files)
  values (v_ref, p->>'kind', upper(trim(p->>'order_ref')), trim(p->>'piece'), trim(p->>'problem'), trim(p->>'cause'),
          trim(p->>'name'), lower(trim(p->>'email')), trim(p->>'phone'),
          coalesce((select array_agg(x) from jsonb_array_elements_text(p->'files') x), '{}'));
  return jsonb_build_object('reference', v_ref);
end $$;

-- ---------------------------------------------------------------- gift voucher orders
-- From the form on gift-voucher.html. Payment is arranged by WhatsApp; once paid, the owner issues the voucher with
-- issue_gift_voucher (the shop email contains the exact line to run). Status: new, paid, issued, cancelled.
create table if not exists public.voucher_requests (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  amount           numeric(10,2) not null check (amount >= 100),
  recipient_name   text not null,
  recipient_email  text,
  recipient_phone  text,
  send_to          text not null check (send_to in ('recipient', 'purchaser')),
  send_on          date,
  name             text not null,
  email            text not null,
  phone            text not null,
  voucher_code     text references public.gift_vouchers (code),
  status           text not null default 'new' check (status in ('new', 'paid', 'issued', 'cancelled')),
  created_at       timestamptz not null default now(),
  check (recipient_email is not null or recipient_phone is not null)
);
alter table public.voucher_requests enable row level security;
alter table public.store_settings add column if not exists next_voucher_request_number int not null default 1;

create or replace function public.save_voucher_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
  v_field text;
begin
  foreach v_field in array array['recipient_name', 'send_to', 'name', 'email', 'phone'] loop
    if coalesce(trim(p->>v_field), '') = '' then
      raise exception 'Please fill in the % field.', v_field using errcode = 'P0001';
    end if;
  end loop;
  if coalesce((p->>'amount')::numeric, 0) < 100 then
    raise exception 'Gift vouchers start at $100.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p->>'recipient_email'), '') = '' and coalesce(trim(p->>'recipient_phone'), '') = '' then
    raise exception 'Please add the recipient''s email or WhatsApp number.' using errcode = 'P0001';
  end if;
  if (p->>'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or (coalesce(trim(p->>'recipient_email'), '') <> '' and trim(p->>'recipient_email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;
  update public.store_settings set next_voucher_request_number = next_voucher_request_number + 1 where id = 1
  returning 'VR' || lpad((next_voucher_request_number - 1)::text, 3, '0') into v_ref;
  insert into public.voucher_requests (reference, amount, recipient_name, recipient_email, recipient_phone, send_to, send_on,
                                       name, email, phone)
  values (v_ref, (p->>'amount')::numeric, trim(p->>'recipient_name'), nullif(lower(trim(p->>'recipient_email')), ''),
          nullif(trim(p->>'recipient_phone'), ''), p->>'send_to', nullif(p->>'send_on', '')::date,
          trim(p->>'name'), lower(trim(p->>'email')), trim(p->>'phone'));
  return jsonb_build_object('reference', v_ref);
end $$;

-- Paying for a voucher order: in the Table Editor, set its status to 'paid'. The voucher is then created
-- (issue_gift_voucher) and the voucher-send function emails it, straight away or on the chosen send date
-- (a daily job sends those). Status becomes 'issued' once the email has gone.
alter table public.voucher_requests add column if not exists emailed_at timestamptz;

create or replace function private.voucher_request_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.voucher_code is null then
    new.voucher_code := public.issue_gift_voucher(new.recipient_name, new.name, new.amount,
                                                  new.recipient_email, new.recipient_phone);
  end if;
  return new;
end;
$$;

drop trigger if exists voucher_request_paid on public.voucher_requests;
create trigger voucher_request_paid before update of status on public.voucher_requests
  for each row when (new.status = 'paid' and old.status = 'new')
  execute function private.voucher_request_paid();

-- Claims the right to email a paid voucher that is due (true once); release lets a failed send be retried.
create or replace function public.claim_voucher_email(p_id uuid, p_release boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  if p_release then
    update public.voucher_requests set emailed_at = null, status = 'paid' where id = p_id;
    return null;
  end if;
  update public.voucher_requests set emailed_at = now(), status = 'issued'
   where id = p_id and status = 'paid' and emailed_at is null and voucher_code is not null
     and (send_on is null or send_on <= (now() at time zone 'Asia/Beirut')::date);
  if not found then
    return null;
  end if;
  select to_jsonb(q) || jsonb_build_object('expires_at', v.expires_at) into r
    from public.voucher_requests q join public.gift_vouchers v on v.code = q.voucher_code where q.id = p_id;
  return r;
end;
$$;

-- Paid vouchers whose send date has come (for the daily job).
create or replace function public.vouchers_due() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.voucher_requests
   where status = 'paid' and emailed_at is null and voucher_code is not null
     and (send_on is null or send_on <= (now() at time zone 'Asia/Beirut')::date);
$$;

-- ---------------------------------------------------------------- newsletter
-- Sign-ups from the footer form, with the consent wording shown, when and where. Nobody is added by buying,
-- creating an account or using a voucher. To unsubscribe someone, set status to 'unsubscribed' (they stay
-- on the list so they are never emailed again). Every change is kept in newsletter_events.
create table if not exists public.newsletter_subscribers (
  email           text primary key check (email = lower(email)),
  status          text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source          text,
  consent_wording text not null,
  consented_at    timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now()
);
create table if not exists public.newsletter_events (
  id              bigserial primary key,
  email           text not null,
  action          text not null check (action in ('subscribed', 'unsubscribed')),
  source          text,
  consent_wording text,
  at              timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_events enable row level security;

create or replace function public.subscribe_newsletter(p_email text, p_source text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_source  text := left(coalesce(p_source, ''), 80);
  v_wording constant text := 'By subscribing, you agree to receive marketing emails from Siaram Jewelry. '
                             'Unsubscribe at any time. Read our Privacy Policy. (website footer, November 2026)';
  v_status  text;
begin
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;
  select status into v_status from public.newsletter_subscribers where email = v_email for update;
  if v_status = 'subscribed' then
    return 'already';
  end if;
  insert into public.newsletter_subscribers (email, source, consent_wording) values (v_email, v_source, v_wording)
  on conflict (email) do update
    set status = 'subscribed', source = excluded.source, consent_wording = excluded.consent_wording,
        consented_at = now(), unsubscribed_at = null;
  insert into public.newsletter_events (email, action, source, consent_wording)
  values (v_email, 'subscribed', v_source, v_wording);
  return 'subscribed';
end $$;

-- Setting status to 'unsubscribed' in the Table Editor records the date and the event.
create or replace function private.newsletter_unsubscribed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.unsubscribed_at := now();
  insert into public.newsletter_events (email, action, source) values (new.email, 'unsubscribed', 'table editor');
  return new;
end;
$$;
drop trigger if exists newsletter_unsubscribed on public.newsletter_subscribers;
create trigger newsletter_unsubscribed before update of status on public.newsletter_subscribers
  for each row when (new.status = 'unsubscribed' and old.status = 'subscribed')
  execute function private.newsletter_unsubscribed();

-- ---------------------------------------------------------------- account activity
-- The website calls this when a signed-in customer visits; it resets the inactivity clock.
create or replace function public.touch_activity() returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set last_active_at = now(), inactivity_reminder_at = null, deletion_notice_at = null
   where id = auth.uid();
$$;

-- Accounts due an inactivity email or deletion. Used by the daily job.
--   reminder         no activity for 12 months
--   deletion_notice  no activity for 24 months (account deleted 30 days later)
--   delete           deletion notice sent over 30 days ago and still no activity
create or replace function public.inactivity_due() returns table (user_id uuid, email text, first_name text, action text)
language sql security definer set search_path = public as $$
  with activity as (
    select p.id, u.email, p.first_name, p.inactivity_reminder_at, p.deletion_notice_at,
           greatest(p.last_active_at, coalesce(u.last_sign_in_at, p.last_active_at)) as last_active
      from public.profiles p join auth.users u on u.id = p.id
  )
  select id, email, first_name,
         case
           when deletion_notice_at is not null and deletion_notice_at < now() - interval '30 days' then 'delete'
           when deletion_notice_at is null and last_active < now() - interval '24 months' then 'deletion_notice'
           when inactivity_reminder_at is null and deletion_notice_at is null
                and last_active < now() - interval '12 months' then 'reminder'
         end as action
    from activity
   where (deletion_notice_at is not null and deletion_notice_at < now() - interval '30 days')
      or (deletion_notice_at is null and last_active < now() - interval '24 months')
      or (inactivity_reminder_at is null and deletion_notice_at is null and last_active < now() - interval '12 months');
$$;

create or replace function public.mark_inactivity_email(p_user_id uuid, p_action text) returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set inactivity_reminder_at = case when p_action = 'reminder' then now() else inactivity_reminder_at end,
         deletion_notice_at     = case when p_action = 'deletion_notice' then now() else deletion_notice_at end
   where id = p_user_id;
$$;

-- ---------------------------------------------------------------- access rules (row level security)
alter table public.products            enable row level security;
alter table public.delivery_areas      enable row level security;
alter table public.store_settings      enable row level security;
alter table public.profiles            enable row level security;
alter table public.addresses           enable row level security;
alter table public.wishlist            enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.gift_vouchers       enable row level security;
alter table public.voucher_redemptions enable row level security;

drop policy if exists "Catalogue is public" on public.products;
create policy "Catalogue is public" on public.products for select using (true);
drop policy if exists "Delivery areas are public" on public.delivery_areas;
create policy "Delivery areas are public" on public.delivery_areas for select using (true);
drop policy if exists "Store settings are public" on public.store_settings;
create policy "Store settings are public" on public.store_settings for select using (true);

drop policy if exists "Own profile" on public.profiles;
create policy "Own profile" on public.profiles for select using (id = auth.uid());
drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Own addresses" on public.addresses;
create policy "Own addresses" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Own wishlist" on public.wishlist;
create policy "Own wishlist" on public.wishlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Own orders" on public.orders;
create policy "Own orders" on public.orders for select using (user_id = auth.uid());
drop policy if exists "Own order items" on public.order_items;
create policy "Own order items" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Customers may edit their name and phone, never their date of birth or activity dates.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, date_of_birth, marketing_email, marketing_whatsapp) on public.profiles to authenticated;

-- Browsers can only read orders; orders are created by the server.
revoke insert, update, delete on public.orders, public.order_items from anon, authenticated;
revoke all on public.gift_vouchers, public.voucher_redemptions from anon, authenticated;
revoke insert, update, delete on public.products, public.delivery_areas, public.store_settings from anon, authenticated;
revoke all on public.stock from anon, authenticated;
revoke all on public.newsletter_subscribers, public.newsletter_events from anon, authenticated;
revoke all on public.custom_requests from anon, authenticated;
revoke execute on function public.save_custom_request(jsonb) from public, anon, authenticated;
grant execute on function public.save_custom_request(jsonb) to service_role;
revoke all on public.service_requests from anon, authenticated;
revoke execute on function public.save_service_request(jsonb) from public, anon, authenticated;
grant execute on function public.save_service_request(jsonb) to service_role;
revoke all on public.voucher_requests from anon, authenticated;
revoke execute on function public.save_voucher_request(jsonb) from public, anon, authenticated;
grant execute on function public.save_voucher_request(jsonb) to service_role;
revoke execute on function public.record_sale(jsonb) from public, anon, authenticated;
grant execute on function public.record_sale(jsonb) to service_role;
revoke execute on function public.claim_voucher_email(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.vouchers_due() from public, anon, authenticated;
grant execute on function public.claim_voucher_email(uuid, boolean), public.vouchers_due() to service_role;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;
grant execute on function public.available_stock() to anon, authenticated;

-- Sales for the finance workbook backup download (website orders and sales recorded by the owner), one entry
-- per order (cancelled orders left out).
-- Dates are Beirut dates; either bound may be null.
create or replace function public.sales_export(p_from date, p_to date) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.reference), '[]'::json) from (
    select o.reference, (o.created_at at time zone 'Asia/Beirut')::date as sale_date,
           o.customer_name, o.email, o.phone,
           concat_ws(', ', nullif(o.street, ''), 'Building ' || nullif(o.building, ''), 'Floor ' || nullif(o.floor, ''),
                     nullif(o.city, ''), nullif(o.governorate, '')) as address,
           o.status, o.payment_method, o.channel, o.voucher_code, o.voucher_amount,
           (select json_agg(json_build_object('sku', i.sku, 'unit_price', i.unit_price, 'quantity', i.quantity,
                                              'made_to_order', i.made_to_order)
                            order by i.product_slug, i.metal, i.size)
              from public.order_items i where i.order_id = o.id) as items
      from public.orders o
     where o.status <> 'cancelled'
       and (p_from is null or (o.created_at at time zone 'Asia/Beirut')::date >= p_from)
       and (p_to is null or (o.created_at at time zone 'Asia/Beirut')::date <= p_to)
  ) x;
$$;

-- The daily account job is started by the database's scheduler (see supabase/cron.sql). It sends this
-- random secret, which never leaves the database, and the job checks it here before doing anything.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.cron (
  id     int primary key default 1 check (id = 1),
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into private.cron (id) values (1) on conflict (id) do nothing;

create or replace function public.cron_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from private.cron where id = 1 and secret = p_secret);
$$;

-- "On its way" email. Setting an order's status to 'dispatched' (in the Table Editor) asks the order-status
-- function to email the customer, once. Optional: type the courier's tracking number in tracking_number first.
-- Where the database reaches the store's functions; set in supabase/cron.sql (empty in the local tests).
alter table private.cron add column if not exists functions_url text;

-- Claims the right to send the email (true once per order); release lets a failed send be retried.
create or replace function public.claim_dispatch_email(p_order_id uuid, p_release boolean default false) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_release then
    update public.orders set dispatched_email_at = null where id = p_order_id;
    return false;
  end if;
  update public.orders set dispatched_email_at = now()
   where id = p_order_id and status = 'dispatched' and dispatched_email_at is null;
  return found;
end;
$$;

create or replace function private.order_dispatched() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_url    text;
  v_secret text;
begin
  select functions_url, secret into v_url, v_secret from private.cron where id = 1;
  if v_url is not null and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := v_url || '/order-status',
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object('order_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists order_dispatched on public.orders;
create trigger order_dispatched after update of status on public.orders
  for each row when (new.status = 'dispatched' and old.status is distinct from 'dispatched'
                     and new.dispatched_email_at is null)
  execute function private.order_dispatched();

-- Gift vouchers: once a voucher order is marked paid, ask voucher-send to email it (it waits for the send date).
create or replace function private.voucher_paid_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_url    text;
  v_secret text;
begin
  select functions_url, secret into v_url, v_secret from private.cron where id = 1;
  if v_url is not null and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := v_url || '/voucher-send',
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object('request_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists voucher_paid_email on public.voucher_requests;
create trigger voucher_paid_email after update of status on public.voucher_requests
  for each row when (new.status = 'paid' and old.status = 'new')
  execute function private.voucher_paid_email();

-- Server-only functions.
revoke execute on function public.place_order(jsonb, uuid)            from public, anon, authenticated;
revoke execute on function public.check_voucher(text, text, text)    from public, anon, authenticated;
revoke execute on function public.voucher_for_recipient(text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.usable_voucher(text, boolean)       from public, anon, authenticated;
revoke execute on function public.issue_gift_voucher(text, text, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.inactivity_due()                    from public, anon, authenticated;
revoke execute on function public.mark_inactivity_email(uuid, text)   from public, anon, authenticated;
revoke execute on function public.sales_export(date, date)            from public, anon, authenticated;
revoke execute on function public.cron_secret_ok(text)                from public, anon, authenticated;
revoke execute on function public.claim_dispatch_email(uuid, boolean) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, uuid), public.check_voucher(text, text, text),
  public.inactivity_due(), public.mark_inactivity_email(uuid, text), public.sales_export(date, date), public.cron_secret_ok(text),
  public.claim_dispatch_email(uuid, boolean) to service_role;
revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;
