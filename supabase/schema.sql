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
--   gift_vouchers   issue vouchers with:  select issue_gift_voucher('Recipient', 'Purchaser', 150);
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

insert into public.products (slug, name, category, image) values
  ('snake-curve-necklace', 'Snake Curve Necklace', 'Necklaces', 'images/product-layered-necklace.jpeg'),
  ('pave-chevron-necklace', 'Pavé Chevron Necklace', 'Necklaces', 'images/product-layered-necklace.jpeg'),
  ('zircon-drop-necklace', 'Zircon Drop Necklace', 'Necklaces', 'images/product-layered-necklace.jpeg'),
  ('crescent-moon-ring', 'Crescent Moon Ring', 'Rings', 'images/product-moon-ring.jpeg'),
  ('horseshoe-chain-earrings', 'Horseshoe Chain Earrings', 'Earrings', 'images/product-horseshoe-earrings.jpeg'),
  ('horseshoe-ring', 'Horseshoe Ring', 'Rings', 'images/product-horseshoe-ring.jpeg'),
  ('seahorse-pearl-bracelet', 'Seahorse Pearl Bracelet', 'Bracelets', 'images/product-seahorse-bracelet.jpeg')
on conflict (slug) do nothing;

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

-- ---------------------------------------------------------------- customers
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  first_name              text not null,
  last_name               text not null,
  phone                   text not null,
  date_of_birth           date not null,
  created_at              timestamptz not null default now(),
  last_active_at          timestamptz not null default now(),
  inactivity_reminder_at  timestamptz,
  deletion_notice_at      timestamptz
);

create or replace function public.assert_adult(dob date) returns void
language plpgsql stable as $$
begin
  if dob is null or dob > (current_date - interval '18 years')::date then
    raise exception 'You must be 18 or older to create an account.' using errcode = 'P0001';
  end if;
end $$;

-- A profile is created with every new login; sign-up fails if the person is under 18.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  dob  date;
begin
  begin
    dob := (meta->>'date_of_birth')::date;
  exception when others then
    dob := null;
  end;
  perform public.assert_adult(dob);
  insert into public.profiles (id, first_name, last_name, phone, date_of_birth)
  values (new.id,
          coalesce(nullif(trim(meta->>'first_name'), ''), ''),
          coalesce(nullif(trim(meta->>'last_name'), ''), ''),
          coalesce(nullif(trim(meta->>'phone'), ''), ''),
          dob);
  return new;
end $$;

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
  governorate     text not null,
  city            text not null,
  street          text not null,
  building        text,
  floor           text,
  notes           text,
  subtotal        numeric(10,2) not null,
  delivery_fee    numeric(10,2),
  voucher_code    text,
  voucher_amount  numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  payment_method  text not null default 'whish',
  status          text not null default 'awaiting_payment'
                  check (status in ('awaiting_payment','paid','preparing','dispatched','delivered','cancelled')),
  age_confirmed   boolean not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.order_items (
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_slug  text not null,
  name          text not null,
  unit_price    numeric(10,2) not null,
  quantity      int not null check (quantity between 1 and 10),
  primary key (order_id, product_slug)
);

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

create table if not exists public.voucher_redemptions (
  id            uuid primary key default gen_random_uuid(),
  voucher_code  text not null references public.gift_vouchers (code),
  order_id      uuid not null references public.orders (id) on delete cascade,
  amount        numeric(10,2) not null,
  created_at    timestamptz not null default now()
);

-- Run from the SQL Editor: select issue_gift_voucher('Recipient Name', 'Purchaser Name', 150);
create or replace function public.issue_gift_voucher(p_recipient text, p_purchaser text, p_amount numeric)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code   text;
  v_months int;
begin
  select voucher_valid_months into v_months from public.store_settings where id = 1;
  loop
    v_code := 'SIARAM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
                  || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (select 1 from public.gift_vouchers where code = v_code);
  end loop;
  insert into public.gift_vouchers (code, recipient_name, purchaser_name, amount, balance, expires_at)
  values (v_code, p_recipient, p_purchaser, p_amount, p_amount,
          now() + make_interval(months => coalesce(v_months, 6)));
  return v_code;
end $$;

-- Returns the usable voucher, or raises a customer-facing error.
create or replace function public.usable_voucher(p_code text, p_lock boolean default false)
returns public.gift_vouchers language plpgsql security definer set search_path = public as $$
declare
  v public.gift_vouchers;
begin
  if p_lock then
    select * into v from public.gift_vouchers where code = upper(trim(p_code)) for update;
  else
    select * into v from public.gift_vouchers where code = upper(trim(p_code));
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

create or replace function public.check_voucher(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v public.gift_vouchers := public.usable_voucher(p_code);
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
  v_subtotal  numeric(10,2) := 0;
  v_discount  numeric(10,2) := 0;
  v_total     numeric(10,2);
  v_ref       text;
  v_order_id  uuid;
  v_field     text;
begin
  if coalesce((p->>'age_confirmed')::boolean, false) is not true then
    raise exception 'You must confirm you are 18 or older to order.' using errcode = 'P0001';
  end if;

  foreach v_field in array array['customer_name','email','phone','governorate','city','street'] loop
    if coalesce(trim(p->>v_field), '') = '' then
      raise exception 'Please fill in your %.', replace(v_field, '_', ' ') using errcode = 'P0001';
    end if;
  end loop;
  if (p->>'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;

  select * into v_area from public.delivery_areas where governorate = p->>'governorate';
  if not found then
    raise exception 'We only deliver within Lebanon. Please choose your governorate.' using errcode = 'P0001';
  end if;
  if not v_area.accepts_orders then
    raise exception 'Sorry, we do not currently deliver to %.', v_area.governorate using errcode = 'P0001';
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  v_ref := 'SJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.orders (reference, user_id, customer_name, email, phone, governorate, city, street,
                             building, floor, notes, subtotal, delivery_fee, total, age_confirmed)
  values (v_ref, p_user_id, trim(p->>'customer_name'), lower(trim(p->>'email')), trim(p->>'phone'),
          v_area.governorate, trim(p->>'city'), trim(p->>'street'), nullif(trim(p->>'building'), ''),
          nullif(trim(p->>'floor'), ''), nullif(trim(p->>'notes'), ''), 0, v_area.delivery_fee, 0, true)
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
    insert into public.order_items (order_id, product_slug, name, unit_price, quantity)
    values (v_order_id, v_product.slug, v_product.name, v_product.price, v_qty)
    on conflict (order_id, product_slug) do update set quantity = least(order_items.quantity + excluded.quantity, 10);
    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  v_total := v_subtotal + coalesce(v_area.delivery_fee, 0);

  if coalesce(trim(p->>'voucher_code'), '') <> '' then
    v_voucher := public.usable_voucher(p->>'voucher_code', true);
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
      'governorate', o.governorate, 'city', o.city, 'street', o.street, 'building', o.building,
      'floor', o.floor, 'notes', o.notes, 'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee,
      'voucher_code', o.voucher_code, 'voucher_amount', o.voucher_amount, 'total', o.total,
      'whish_number', s.whish_number, 'whish_name', s.whish_name,
      'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'unit_price', i.unit_price,
                                                    'quantity', i.quantity) order by i.name)
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
grant update (first_name, last_name, phone) on public.profiles to authenticated;

-- Browsers can only read orders; orders are created by the server.
revoke insert, update, delete on public.orders, public.order_items from anon, authenticated;
revoke all on public.gift_vouchers, public.voucher_redemptions from anon, authenticated;
revoke insert, update, delete on public.products, public.delivery_areas, public.store_settings from anon, authenticated;

-- Server-only functions.
revoke execute on function public.place_order(jsonb, uuid)            from public, anon, authenticated;
revoke execute on function public.check_voucher(text)                 from public, anon, authenticated;
revoke execute on function public.usable_voucher(text, boolean)       from public, anon, authenticated;
revoke execute on function public.issue_gift_voucher(text, text, numeric) from public, anon, authenticated;
revoke execute on function public.inactivity_due()                    from public, anon, authenticated;
revoke execute on function public.mark_inactivity_email(uuid, text)   from public, anon, authenticated;
grant execute on function public.place_order(jsonb, uuid), public.check_voucher(text),
  public.inactivity_due(), public.mark_inactivity_email(uuid, text) to service_role;
revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;
