-- Database rule tests for supabase/schema.sql.
-- Runs against a local Postgres with a minimal stand-in for Supabase's auth schema;
-- see tests/run-store-db-test.sh. Any failed check raises an error and stops the run.

\set ON_ERROR_STOP 1
\o /dev/null
set client_min_messages = warning;

create or replace function pg_temp.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL: expected error matching "%" from: %', p_pattern, p_sql;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm !~* p_pattern then
    raise exception 'FAIL: wrong error "%" (wanted "%") from: %', sqlerrm, p_pattern, p_sql;
  end if;
end $$;

create or replace function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'ok - %', p_label;
end $$;
set client_min_messages = notice;

-- ---------------------------------------------------------------- 18+ sign-up
select pg_temp.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('kid@example.com',
  jsonb_build_object('first_name','Kid','last_name','A','phone','1','age_confirmed',true,
                     'date_of_birth', (current_date - interval '17 years')::date))$$,
  '18 or older');
select pg_temp.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('noconfirm@example.com',
  '{"first_name":"No","last_name":"Confirm","phone":"1"}')$$,
  '18 or older');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'rana@example.com',
   '{"first_name":"Rana","last_name":"Haddad","phone":"+961 70 000 000","date_of_birth":"1995-04-02","age_confirmed":true,"marketing_email":true}'),
  ('00000000-0000-0000-0000-00000000000b', 'maya@example.com',
   '{"first_name":"Maya","last_name":"Khoury","phone":"+961 71 000 000","age_confirmed":true}');
select pg_temp.check((select first_name = 'Rana' from profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'adult sign-up creates a profile');
select pg_temp.check((select count(*) = 0 from profiles where first_name = 'Kid'), 'under-18 sign-up creates nothing');
select pg_temp.check((select date_of_birth is null and age_confirmed from profiles where first_name = 'Maya'),
  'birthday is optional when the customer confirms they are 18+');
select pg_temp.check((select marketing_email and not marketing_whatsapp and marketing_updated_at is not null
                        from profiles where first_name = 'Rana'),
  'marketing choices from sign-up are stored with a time stamp');

-- ---------------------------------------------------------------- orders
update products set price = 120 where slug = 'v-bird-necklace';
update products set price = 85  where slug = 'crescent-moon-ring';
update store_settings set whish_number = '+961 76 052 068', whish_name = 'Siaram Jewelry';

create or replace function pg_temp.order_json(p_gov text, p_items jsonb, p_extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('customer_name','Rana Haddad','email','Rana@Example.com','phone','+961 70 000 000',
    'governorate',p_gov,'city','Jounieh','street','Main St','building','B2','floor','3',
    'age_confirmed',true,'items',p_items) || p_extra $$;

select pg_temp.expect_error($$select place_order(pg_temp.order_json('South','[{"slug":"v-bird-necklace","quantity":1}]'))$$,
  'do not currently deliver to South');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Paris','[{"slug":"v-bird-necklace","quantity":1}]'))$$,
  'only deliver within Lebanon');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"horseshoe-ring","quantity":1}]'))$$,
  'Horseshoe Ring.*not available');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"v-bird-necklace","quantity":1},{"slug":"nope","quantity":1}]'))$$,
  '"nope" is not available');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"v-bird-necklace","quantity":11}]'))$$,
  'between 1 and 10');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[]'))$$, 'cart is empty');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"v-bird-necklace","quantity":1}]','{"age_confirmed":false}'))$$,
  '18 or older');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"v-bird-necklace","quantity":1}]','{"email":"not-an-email"}'))$$,
  'valid email');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"v-bird-necklace","quantity":1}]','{"city":" "}'))$$,
  'fill in your city');
select pg_temp.check((select count(*) = 0 from orders), 'rejected orders leave nothing behind');

-- Prices come from the database, not from the browser.
select pg_temp.check((
  select (r->>'total')::numeric = 325 and (r->>'subtotal')::numeric = 325 and r->>'reference' ~ '^SJ-[0-9A-F]{6}$'
         and r->>'email' = 'rana@example.com' and r->>'whish_number' = '+961 76 052 068'
    from (select place_order(pg_temp.order_json('Nabatieh',
      '[{"slug":"v-bird-necklace","quantity":2,"price":1},{"slug":"crescent-moon-ring","quantity":1}]'))) t(r)),
  'order total uses database prices (2 x 120 + 85 = 325); Nabatieh accepted');

update delivery_areas set delivery_fee = 5 where governorate = 'Beirut';
select pg_temp.check((select (r->>'total')::numeric = 85 and (r->>'delivery_fee')::numeric = 5
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1}]'),
                             '00000000-0000-0000-0000-00000000000a')) t(r)),
  'delivery fee is recorded but paid to the courier, not added to the Whish total');
select pg_temp.check((select (r->>'total')::numeric = 85 and r->>'fulfilment' = 'collection' and r->>'governorate' is null
    from (select place_order(pg_temp.order_json('South','[{"slug":"crescent-moon-ring","quantity":1}]',
      '{"fulfilment":"collection","city":"","street":""}'))) t(r)),
  'collection by appointment needs no address and has no delivery fee');

-- ---------------------------------------------------------------- gift vouchers
insert into gift_vouchers (code, recipient_name, purchaser_name, amount, balance, expires_at) values
  ('SIARAM-OLD1-0000', 'Rana', 'Maya', 100, 100, now() - interval '1 day'),
  ('SIARAM-GOOD-0000', 'Rana', 'Maya', 100, 100, now() + interval '3 months'),
  ('SIARAM-VOID-0000', 'Rana', 'Maya', 100, 100, now() + interval '3 months');
update gift_vouchers set status = 'void' where code = 'SIARAM-VOID-0000';

select pg_temp.expect_error($$select check_voucher('SIARAM-OLD1-0000')$$, 'expired on');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1}]','{"voucher_code":"SIARAM-OLD1-0000"}'))$$,
  'expired on');
select pg_temp.expect_error($$select check_voucher('SIARAM-VOID-0000')$$, 'not valid');
select pg_temp.expect_error($$select check_voucher('NOPE')$$, 'not valid');
select pg_temp.check((select (check_voucher(' siaram-good-0000 ')->>'balance')::numeric = 100),
  'voucher lookup ignores case and spaces');

select pg_temp.check((select (r->>'total')::numeric = 0 and (r->>'voucher_amount')::numeric = 85
                             and (r->>'delivery_fee')::numeric = 5
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1}]',
                                                '{"voucher_code":"siaram-good-0000"}'))) t(r)),
  'voucher covers the jewellery (85 of 100 used) but not the courier fee');
select pg_temp.check((select balance = 15 from gift_vouchers where code = 'SIARAM-GOOD-0000'),
  'voucher keeps the 15 left as balance');
select pg_temp.check((select (r->>'total')::numeric = 70 and (r->>'voucher_amount')::numeric = 15
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1}]',
                                                '{"voucher_code":"SIARAM-GOOD-0000"}'))) t(r)),
  'remaining balance is used on the next order');
select pg_temp.expect_error($$select check_voucher('SIARAM-GOOD-0000')$$, 'fully used');

select issue_gift_voucher('Lea', 'Nour', 150) as new_code \gset
select pg_temp.check((select code ~ '^SIARAM-[0-9A-F]{4}-[0-9A-F]{4}$' and balance = 150
                             and expires_at::date = (now() + interval '6 months')::date
                        from gift_vouchers where code = :'new_code'),
  'issue_gift_voucher creates a 6-month voucher');

-- ---------------------------------------------------------------- addresses
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into addresses (recipient_name, phone, governorate, city, street, is_default)
  values ('Rana', '1', 'Beirut', 'Achrafieh', 'St 1', true);
insert into addresses (recipient_name, phone, governorate, city, street, is_default)
  values ('Rana', '1', 'Mount Lebanon', 'Jounieh', 'St 2', true);
select pg_temp.check((select count(*) = 1 and min(city) = 'Jounieh' from addresses where is_default),
  'only one preferred address at a time');
insert into wishlist (product_slug) values ('v-bird-necklace'), ('horseshoe-ring');
select pg_temp.check((select count(*) = 2 from wishlist), 'customer can add to their wishlist');
select pg_temp.check((select count(*) = 1 from orders), 'customer sees only their own orders');
update profiles set phone = '+961 70 111 111';
select pg_temp.expect_error($$update profiles set date_of_birth = '2015-01-01'$$, '18 or older');
update profiles set date_of_birth = '1994-06-01';
select pg_temp.expect_error($$update profiles set age_confirmed = false$$, 'permission denied');
select pg_temp.expect_error($$select place_order('{}'::jsonb)$$, 'permission denied');
select pg_temp.expect_error($$select * from gift_vouchers$$, 'permission denied');
select pg_temp.expect_error($$update products set price = 1$$, 'permission denied');
select pg_temp.expect_error($$insert into orders (reference, customer_name, email, phone, governorate, city, street, subtotal, total, age_confirmed)
  values ('X','a','b','c','Beirut','d','e',0,0,true)$$, 'permission denied');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) = 0 from addresses) and (select count(*) = 0 from wishlist)
                     and (select count(*) = 0 from orders) and (select count(*) = 1 from profiles),
  'another customer cannot see Rana''s addresses, wishlist or orders');
select pg_temp.expect_error($$insert into wishlist (user_id, product_slug) values ('00000000-0000-0000-0000-00000000000a', 'v-bird-necklace')$$,
  'row-level security');
reset role;

set role anon;
reset request.jwt.claim.sub;
select pg_temp.check((select count(*) = 7 from products), 'visitors can read the catalogue');
select pg_temp.check((select count(*) = 0 from profiles), 'visitors cannot read profiles');
select pg_temp.expect_error($$select touch_activity()$$, 'permission denied');
reset role;

-- ---------------------------------------------------------------- inactivity
update auth.users set last_sign_in_at = null;
update profiles set last_active_at = now() - interval '13 months' where first_name = 'Rana';
update profiles set last_active_at = now() - interval '25 months' where first_name = 'Maya';
select pg_temp.check((select array_agg(action order by first_name) = '{deletion_notice,reminder}' from inactivity_due()),
  '12 months inactive -> reminder; 24 months -> deletion notice');
select mark_inactivity_email(user_id, action) from inactivity_due();
select pg_temp.check((select count(*) = 0 from inactivity_due()), 'each email is sent only once');

update profiles set deletion_notice_at = now() - interval '31 days' where first_name = 'Maya';
select pg_temp.check((select action = 'delete' and first_name = 'Maya' from inactivity_due()),
  'account is due for deletion 30 days after the notice');

update auth.users set last_sign_in_at = now() where email = 'maya@example.com';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select touch_activity();
reset role;
select pg_temp.check((select count(*) = 0 from inactivity_due()), 'activity cancels the deletion');

update profiles set last_active_at = now() - interval '13 months' where first_name = 'Maya';
update auth.users set last_sign_in_at = now() - interval '13 months' where email = 'maya@example.com';
select pg_temp.check((select action = 'reminder' from inactivity_due() where first_name = 'Maya'),
  'reminders start again after the customer comes back and goes quiet');

-- Deleting an account keeps the order record without the link to the account.
delete from auth.users where email = 'rana@example.com';
select pg_temp.check((select count(*) = 0 from profiles where first_name = 'Rana')
                     and (select count(*) = 0 from addresses) and (select count(*) = 0 from wishlist)
                     and (select count(*) = 5 from orders) and (select count(*) = 0 from orders where user_id is not null),
  'deleting an account removes profile, addresses and wishlist but keeps orders');

\o
\echo 'ALL STORE DATABASE TESTS PASSED'
