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
--   store_settings  also holds the next order number (SO16, SO17, ...) and the next voucher number (GV0001, ...)
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
  ('horseshoe-necklace-black-stone', 'Horse Shoe Necklace – Black Stone', 'Necklaces', 'images/products/horseshoe-necklace-black-stone-1.jpg', 525),
  ('horseshoe-bracelet', 'Horse Shoe Bracelet', 'Bracelets', 'images/products/horseshoe-bracelet-1.jpg', 450),
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
  ('arrow-open-ring', 'Arrow Open Ring', 'Rings', 'images/products/arrow-open-ring-1.jpg', 589),
  ('arrow-ring', 'Arrow Ring', 'Rings', 'images/products/arrow-ring-1.jpg', 679)
on conflict (slug) do nothing;

-- The product code from the finance workbook. Shown on orders so they match the spreadsheet.
-- Pieces sold as an asymmetric pair list both codes.
alter table public.products add column if not exists sku text;
update public.products p set sku = v.sku
  from (values
    ('horseshoe-necklace', 'NK-01'), ('horseshoe-necklace-black-stone', 'NK-05'), ('horseshoe-bracelet', 'BR-02'),
    ('horseshoe-ring', 'RG-04'), ('horseshoe-chain-earrings', 'EA-03'), ('horse-eye-ring', 'RG-07'),
    ('horse-eye-stud', 'EA-08'), ('horse-eye-bracelet', 'BR-08'), ('horse-eye-necklace', 'NK-10'),
    ('curved-marquise-necklace', 'NK-12'), ('curved-marquise-bracelet', 'BR-07'), ('curved-marquise-earrings', 'EA-10'),
    ('eye-necklace', 'NK-02'), ('fatima-pearl-earrings', 'EA-01/EA-02'), ('fatima-necklace', 'NK-06'),
    ('fatima-ring', 'RG-03'), ('fatima-anklet', 'AK-01'), ('v-pendant-necklace', 'NK-08'),
    ('triangle-necklace', 'NK-09'), ('v-bird-necklace', 'NK-07'), ('moon-star-handchain', 'BR-04'),
    ('moon-star-pendant-earring', 'EA-04/EA-05'), ('crescent-moon-earrings', 'EA-07'), ('star-moon-necklace', 'NK-03'),
    ('qamar-ring', 'RG-02'), ('crescent-moon-ring', 'RG-01'), ('sun-necklace', 'NK-11'),
    ('sun-ring', 'RG-08'), ('sun-stud-earrings', 'EA-09'), ('seahorse-pearl-bracelet', 'BR-01'),
    ('wave-bracelet', 'BR-06'), ('arrow-necklace', 'NK-04'), ('arrow-bracelet', 'BR-05'),
    ('arrow-earrings', 'EA-06'), ('arrow-open-ring', 'RG-05'), ('arrow-ring', 'RG-06')
  ) as v(slug, sku)
 where p.slug = v.slug and p.sku is null;

-- Sizes a piece can be ordered in (rings and bracelets; empty = no size to choose).
-- Every piece is made to order. Filled in by tools/build_products.py.
alter table public.products add column if not exists sizes text[];
-- product sizes start
update public.products p set sizes = v.sizes
  from (values
    ('horseshoe-bracelet', array['15–17 cm', '14 cm', '18 cm', '19 cm', '20 cm']),
    ('horseshoe-ring', array['EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59']),
    ('horse-eye-ring', array['EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59']),
    ('horse-eye-bracelet', array['16–17.5 cm', '14 cm', '15 cm', '18 cm', '19 cm', '20 cm']),
    ('curved-marquise-bracelet', array['15–17 cm', '14 cm', '18 cm', '19 cm', '20 cm']),
    ('fatima-ring', array['EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59']),
    ('moon-star-handchain', array['16–18 cm', '14 cm', '15 cm', '19 cm', '20 cm']),
    ('qamar-ring', array['EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59']),
    ('crescent-moon-ring', array['EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59']),
    ('sun-ring', array['EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59']),
    ('seahorse-pearl-bracelet', array['15–16 cm', '14 cm', '17 cm', '18 cm', '19 cm', '20 cm']),
    ('wave-bracelet', array['15–16.5 cm', '14 cm', '17 cm', '18 cm', '19 cm', '20 cm']),
    ('arrow-bracelet', array['16–17 cm', '14 cm', '15 cm', '18 cm', '19 cm', '20 cm']),
    ('arrow-open-ring', array['EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59']),
    ('arrow-ring', array['EU 45', 'EU 47', 'EU 48', 'EU 49', 'EU 50', 'EU 51', 'EU 52', 'EU 54', 'EU 55', 'EU 56', 'EU 58', 'EU 59'])
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

-- Order numbers carry on from the finance workbook (last order SO15); gift vouchers start at GV0001.
-- Taken inside the same transaction as the order or voucher, so a failed order never skips a number.
alter table public.store_settings add column if not exists next_order_number int not null default 16;
alter table public.store_settings add column if not exists next_voucher_number int not null default 1;

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
-- How the customer pays: 'whish' before dispatch, or 'cash' to the courier on delivery (or at collection).
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('whish', 'cash'));
alter table public.orders alter column governorate drop not null;
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
  v_cash      boolean := coalesce(p->>'payment_method', 'whish') = 'cash';
begin
  if coalesce((p->>'age_confirmed')::boolean, false) is not true then
    raise exception 'You must confirm you are 18 or older to order.' using errcode = 'P0001';
  end if;

  if coalesce(p->>'fulfilment', 'delivery') not in ('delivery', 'collection') then
    raise exception 'Please choose delivery or collection.' using errcode = 'P0001';
  end if;
  if coalesce(p->>'payment_method', 'whish') not in ('whish', 'cash') then
    raise exception 'Please choose Whish or cash on delivery.' using errcode = 'P0001';
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
  returning 'SO' || (next_order_number - 1) into v_ref;
  insert into public.orders (reference, user_id, customer_name, email, phone, fulfilment, governorate, city, street,
                             building, floor, notes, subtotal, delivery_fee, total, age_confirmed,
                             payment_method, status)
  values (v_ref, p_user_id, trim(p->>'customer_name'), lower(trim(p->>'email')), trim(p->>'phone'),
          case when v_collect then 'collection' else 'delivery' end,
          v_area.governorate, nullif(trim(p->>'city'), ''), nullif(trim(p->>'street'), ''),
          nullif(trim(p->>'building'), ''), nullif(trim(p->>'floor'), ''), nullif(trim(p->>'notes'), ''),
          0, v_area.delivery_fee, 0, true,
          -- Cash orders are paid on delivery or collection, so they go straight to preparation.
          case when v_cash then 'cash' else 'whish' end,
          case when v_cash then 'preparing' else 'awaiting_payment' end)
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
    insert into public.order_items (order_id, product_slug, sku, name, unit_price, quantity, metal, size)
    values (v_order_id, v_product.slug, v_product.sku, v_product.name, v_product.price, v_qty, v_metal, v_size)
    on conflict (order_id, product_slug, metal, size)
      do update set quantity = least(order_items.quantity + excluded.quantity, 10);
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

  return (
    select jsonb_build_object(
      'reference', o.reference, 'customer_name', o.customer_name, 'email', o.email, 'phone', o.phone,
      'fulfilment', o.fulfilment, 'payment_method', o.payment_method, 'status', o.status,
      'governorate', o.governorate, 'city', o.city, 'street', o.street, 'building', o.building,
      'floor', o.floor, 'notes', o.notes, 'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee,
      'voucher_code', o.voucher_code, 'voucher_amount', o.voucher_amount, 'total', o.total,
      'whish_number', s.whish_number, 'whish_name', s.whish_name,
      'items', (select jsonb_agg(jsonb_build_object('sku', i.sku, 'name', i.name, 'unit_price', i.unit_price,
                                                    'quantity', i.quantity, 'metal', i.metal, 'size', i.size)
                                                    order by i.name)
                  from public.order_items i where i.order_id = o.id))
      from public.orders o cross join public.store_settings s
     where o.id = v_order_id and s.id = 1);
end $$;

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

-- Server-only functions.
revoke execute on function public.place_order(jsonb, uuid)            from public, anon, authenticated;
revoke execute on function public.check_voucher(text, text, text)    from public, anon, authenticated;
revoke execute on function public.voucher_for_recipient(text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.usable_voucher(text, boolean)       from public, anon, authenticated;
revoke execute on function public.issue_gift_voucher(text, text, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.inactivity_due()                    from public, anon, authenticated;
revoke execute on function public.mark_inactivity_email(uuid, text)   from public, anon, authenticated;
grant execute on function public.place_order(jsonb, uuid), public.check_voucher(text, text, text),
  public.inactivity_due(), public.mark_inactivity_email(uuid, text) to service_role;
revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;
