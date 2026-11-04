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
update products set price = null where slug = 'horseshoe-ring';
update store_settings set whish_number = '+961 76 052 068', whish_name = 'Siaram Jewelry';

create or replace function pg_temp.order_json(p_gov text, p_items jsonb, p_extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('customer_name','Rana Haddad','email','Rana@Example.com','phone','+961 70 000 000',
    'governorate',p_gov,'city','Jounieh','street','Main St','building','B2','floor','3',
    'age_confirmed',true,'terms_accepted',true,'items',p_items) || p_extra $$;

select pg_temp.expect_error($$select place_order(pg_temp.order_json('South','[{"slug":"v-bird-necklace","quantity":1}]'))$$,
  'do not currently deliver to South');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Paris','[{"slug":"v-bird-necklace","quantity":1}]'))$$,
  'only deliver within Lebanon');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"horseshoe-ring","quantity":1}]'))$$,
  'Horse Shoe Ring.*not available');
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
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"v-bird-necklace","quantity":1}]','{"terms_accepted":false}'))$$,
  'agree to the delivery and returns terms');
select pg_temp.check((select count(*) = 0 from orders), 'rejected orders leave nothing behind');

-- Prices come from the database, not from the browser.
select pg_temp.check((
  select (r->>'total')::numeric = 325 and (r->>'subtotal')::numeric = 325
         and r->>'email' = 'rana@example.com'
    from (select place_order(pg_temp.order_json('Bekaa',
      '[{"slug":"v-bird-necklace","quantity":2,"price":1},{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]'))) t(r)),
  'order total uses database prices (2 x 120 + 85 = 325); Bekaa accepted');
select pg_temp.check((select reference = 'S017' from orders),
  'order numbers carry on from the workbook (S017), and rejected orders do not use up a number');
select pg_temp.check((select array_agg(sku order by sku) = array['NK-07', 'RG-01'] from order_items),
  'order items keep the SKU from the workbook');
select pg_temp.check((select count(*) = 0 from products where sku is null), 'every product has a SKU');
select pg_temp.check((select terms_accepted_at is not null from orders limit 1), 'the order records when the delivery and returns terms were accepted');
select pg_temp.check((select sku = 'EA-03' from products where slug = 'moon-star-pendant-earring'), 'earring SKUs follow the workbook renumbering');

-- Metal and size
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1}]'))$$,
  'choose a size for the Crescent Moon Ring');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 99"}]'))$$,
  'choose a size for the Crescent Moon Ring');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"v-bird-necklace","quantity":1,"metal":"silver"}]'))$$,
  'yellow, rose or white gold');
select pg_temp.check((
  select jsonb_array_length(r->'items') = 3 and (r->>'subtotal')::numeric = 290
    from (select place_order(pg_temp.order_json('Beirut',
      '[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"},
        {"slug":"crescent-moon-ring","quantity":1,"size":"EU 50","metal":"rose"},
        {"slug":"v-bird-necklace","quantity":1,"metal":"white","size":"ignored"}]'))) t(r)),
  'the same piece in two metals or sizes is two lines; prices do not change with the metal');
select pg_temp.check((select array_agg(metal || '/' || size order by metal, size) =
    array['rose/EU 50', 'white/', 'yellow/EU 54']
    from order_items i join orders o on o.id = i.order_id
   where o.reference = (select max(reference) from orders)),
  'each line records its metal and size, and necklaces have no size');
-- Undo that order so the numbering checks below are unaffected.
delete from orders where reference = (select max(reference) from orders);
update store_settings set next_order_number = next_order_number - 1 where id = 1;

update delivery_areas set delivery_fee = 5 where governorate = 'Beirut';
select pg_temp.check((select (r->>'total')::numeric = 85 and (r->>'delivery_fee')::numeric = 5
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]'),
                             '00000000-0000-0000-0000-00000000000a')) t(r)),
  'delivery fee is recorded but paid to the courier, not added to the jewellery total');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]',
      '{"fulfilment":"collection"}'))$$, 'Collection is no longer available');
select pg_temp.check((select r->>'payment_method' = 'cash' and r->>'status' = 'received'
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]'))) t(r)),
  'website orders are cash and start as received, waiting for us to confirm them');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]',
  '{"payment_method":"whish"}'))$$, 'paid in cash');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]',
  '{"payment_method":"card"}'))$$, 'paid in cash');

-- A repeated submission returns the first order instead of creating a second one.
create temp table dup as select count(*) as n from orders;
select pg_temp.check((
  select (a->>'reference') = (b->>'reference') and (b->>'duplicate')::boolean and not coalesce((a->>'duplicate')::boolean, false)
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]','{"submission_id":"sub-1"}'))) x(a),
         lateral (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]','{"submission_id":"sub-1"}'))) y(b)),
  'the same submission twice gives the same order, marked as a duplicate');
select pg_temp.check((select count(*) = (select n from dup) + 1 from orders), 'and only one order is stored');

-- ---------------------------------------------------------------- gift vouchers
insert into gift_vouchers (code, recipient_name, purchaser_name, amount, balance, expires_at) values
  ('SIARAM-OLD1-0000', 'Rana', 'Maya', 100, 100, now() - interval '1 day'),
  ('SIARAM-GOOD-0000', 'Rana', 'Maya', 100, 100, now() + interval '3 months'),
  ('SIARAM-VOID-0000', 'Rana', 'Maya', 100, 100, now() + interval '3 months');
update gift_vouchers set status = 'void' where code = 'SIARAM-VOID-0000';

select pg_temp.expect_error($$select check_voucher('SIARAM-OLD1-0000')$$, 'expired on');
select pg_temp.expect_error($$select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]','{"voucher_code":"SIARAM-OLD1-0000"}'))$$,
  'expired on');
select pg_temp.expect_error($$select check_voucher('SIARAM-VOID-0000')$$, 'not valid');
select pg_temp.expect_error($$select check_voucher('NOPE')$$, 'not valid');
select pg_temp.check((select (check_voucher(' siaram-good-0000 ')->>'balance')::numeric = 100),
  'voucher lookup ignores case and spaces');

select pg_temp.check((select (r->>'total')::numeric = 0 and (r->>'voucher_amount')::numeric = 85
                             and (r->>'delivery_fee')::numeric = 5
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]',
                                                '{"voucher_code":"siaram-good-0000"}'))) t(r)),
  'voucher covers the jewellery (85 of 100 used) but not the courier fee');
select pg_temp.check((select balance = 15 from gift_vouchers where code = 'SIARAM-GOOD-0000'),
  'voucher keeps the 15 left as balance');
select pg_temp.check((select (r->>'total')::numeric = 70 and (r->>'voucher_amount')::numeric = 15
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]',
                                                '{"voucher_code":"SIARAM-GOOD-0000"}'))) t(r)),
  'remaining balance is used on the next order');
select pg_temp.expect_error($$select check_voucher('SIARAM-GOOD-0000')$$, 'fully used');

select pg_temp.check((select array_agg(reference order by reference) = array['S017','S018','S019','S020','S021','S022']
                        from orders),
  'each order takes the next SO number');

select issue_gift_voucher('Lea', 'Nour', 150, ' Lea@Example.com ', '+961 71 234 567') as new_code \gset
select pg_temp.check((select code ~ '^GV0001-[A-HJ-NP-Z2-9]{6}$' and balance = 150
                             and recipient_email = 'lea@example.com' and recipient_phone = '+961 71 234 567'
                             and expires_at::date = (now() + interval '6 months')::date
                        from gift_vouchers where code = :'new_code'),
  'issue_gift_voucher creates a 6-month voucher for a named recipient, starting at GV0001-XXXXXX');
select pg_temp.expect_error($$select issue_gift_voucher('Lea', 'Nour', 50, 'lea@example.com')$$, 'start at \$100');
select pg_temp.expect_error($$select issue_gift_voucher('Lea', 'Nour', 150)$$, 'email or phone number');
select pg_temp.check((select (check_voucher(lower(replace(:'new_code', '-', ' ')), 'LEA@example.com')->>'balance')::numeric = 150),
  'voucher lookup works without the dash, for the recipient''s email');
select pg_temp.check((select (check_voucher(:'new_code', 'someone@else.com', '71234567')->>'balance')::numeric = 150),
  'the recipient''s phone number also works, written differently');
select pg_temp.expect_error(format('select check_voucher(%L, %L, %L)', :'new_code', 'someone@else.com', '70 000 000'),
  'only be used by its recipient');
select pg_temp.expect_error(format('select check_voucher(%L)', :'new_code'), 'only be used by its recipient');
select pg_temp.expect_error(format($$select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]',
  jsonb_build_object('voucher_code', %L)))$$, :'new_code'), 'only be used by its recipient');
select pg_temp.check((select (r->>'voucher_amount')::numeric = 85
    from (select place_order(pg_temp.order_json('Beirut','[{"slug":"crescent-moon-ring","quantity":1,"size":"EU 54"}]',
      jsonb_build_object('voucher_code', :'new_code', 'email', 'lea@example.com', 'customer_name', 'Lea')))) t(r)),
  'the recipient can pay with the voucher');
select pg_temp.check((select issue_gift_voucher('Lea', 'Nour', 100, null, '70000000') like 'GV0002-%'), 'the next voucher is GV0002');
select pg_temp.expect_error($$select check_voucher('GV0001')$$, 'not valid');

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
select pg_temp.check((select count(*) = 36 from products), 'visitors can read the catalogue');
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

-- Backup download for the finance workbook.
select pg_temp.check((select json_array_length(sales_export(null, null)) = (select count(*) from orders where status <> 'cancelled')),
  'the workbook download lists every order that is not cancelled');
select pg_temp.check((select json_array_length(sales_export((now() at time zone 'Asia/Beirut')::date + 1, null)) = 0
                         and json_array_length((sales_export(null, null))->0->'items') >= 1),
  'the workbook download respects the date range and includes the pieces');
select pg_temp.check(not has_function_privilege('anon', 'public.sales_export(date, date)', 'execute')
                     and not has_function_privilege('authenticated', 'public.sales_export(date, date)', 'execute'),
  'only the server can read the workbook download');

-- "On its way" email: the trigger is quiet locally (no functions_url, no pg_net); the claim works once.
update orders set status = 'dispatched', tracking_number = 'WAK-1' where reference = 'S017';
select pg_temp.check((select status = 'dispatched' and dispatched_email_at is null from orders where reference = 'S017'),
  'marking an order dispatched works even where the email cannot be sent');
select pg_temp.check((select claim_dispatch_email(id) from orders where reference = 'S017')
                     and not (select claim_dispatch_email(id) from orders where reference = 'S017')
                     and not (select claim_dispatch_email(id) from orders where reference = 'S018'),
  'the "on its way" email is claimed once, and only for dispatched orders');
select pg_temp.check((select order_summary(id)->>'tracking_number' = 'WAK-1' from orders where reference = 'S017'),
  'the order summary includes the tracking number');
update private.cron set functions_url = 'https://example.invalid/functions/v1' where id = 1;
update orders set status = 'dispatched' where reference = 'S018';
update private.cron set functions_url = null where id = 1;
select pg_temp.check((select status = 'dispatched' from orders where reference = 'S018'),
  'the trigger does not get in the way when the network add-on is missing');
select pg_temp.check(not has_function_privilege('anon', 'public.claim_dispatch_email(uuid, boolean)', 'execute'),
  'only the server can claim the email');

-- Deleting an account keeps the order record without the link to the account.
delete from auth.users where email = 'rana@example.com';
select pg_temp.check((select count(*) = 0 from profiles where first_name = 'Rana')
                     and (select count(*) = 0 from addresses) and (select count(*) = 0 from wishlist)
                     and (select count(*) = 7 from orders) and (select count(*) = 0 from orders where user_id is not null),
  'deleting an account removes profile, addresses and wishlist but keeps orders');

-- Stock: an in-stock piece is taken off; once gone, the next one is made to order; cancelling puts it back.
update stock set quantity = 1 where product_slug = 'sun-necklace' and metal = 'yellow' and size = '';
select place_order(pg_temp.order_json('Beirut','[{"slug":"sun-necklace","quantity":1}]')) ->> 'reference' as stock_ref1 \gset
select place_order(pg_temp.order_json('Beirut','[{"slug":"sun-necklace","quantity":1}]')) ->> 'reference' as stock_ref2 \gset
select pg_temp.check((select bool_and(not made_to_order) from order_items i join orders o on o.id = i.order_id where o.reference = :'stock_ref1')
                     and (select bool_and(made_to_order) from order_items i join orders o on o.id = i.order_id where o.reference = :'stock_ref2')
                     and (select quantity = 0 from stock where product_slug = 'sun-necklace' and metal = 'yellow' and size = ''),
  'an order takes the piece in stock; the next order of it is made to order');
select pg_temp.check((select (order_summary(id)->'items'->0->>'made_to_order')::boolean from orders where reference = :'stock_ref2'),
  'the order summary says which pieces are made to order');
select pg_temp.check(not exists (select 1 from available_stock() where product_slug = 'sun-necklace'),
  'a sold-out piece is not shown as in stock');
update orders set status = 'cancelled' where reference = :'stock_ref2';
select pg_temp.check((select quantity = 0 from stock where product_slug = 'sun-necklace' and size = ''),
  'cancelling a made-to-order line does not add stock');
update orders set status = 'cancelled' where reference = :'stock_ref1';
select pg_temp.check((select quantity = 1 from stock where product_slug = 'sun-necklace' and size = '')
                     and exists (select 1 from available_stock() where product_slug = 'sun-necklace' and metal = 'yellow'),
  'cancelling an order puts its in-stock piece back');
select pg_temp.check((select count(*) = 0 from available_stock() where metal <> 'yellow')
                     and exists (select 1 from available_stock() where product_slug = 'qamar-ring' and size = 'EU 55'),
  'the starting stock is yellow gold, with rings in the sizes made');
select pg_temp.check((select quantity = 1 from available_stock() where product_slug = 'qamar-ring' and size = 'EU 55'),
  'the website is told how many are in stock, so it can say made to order before an order asks for more');
select pg_temp.check(has_function_privilege('anon', 'public.available_stock()', 'execute')
                     and not has_table_privilege('anon', 'public.stock', 'select'),
  'visitors can see what is in stock, but not the stock table itself');

-- Newsletter: sign-up with consent, no duplicates, unsubscribed people can sign up again themselves.
select subscribe_newsletter(' Nour@Example.com ', 'index.html') as nl_first \gset
select subscribe_newsletter('nour@example.com', 'shop.html') as nl_second \gset
select pg_temp.check(:'nl_first' = 'subscribed' and :'nl_second' = 'already'
                     and (select count(*) = 1 from newsletter_subscribers where email = 'nour@example.com')
                     and (select consent_wording like 'By subscribing, you agree%' and source = 'index.html'
                            from newsletter_subscribers where email = 'nour@example.com'),
  'a footer sign-up is saved once, with the consent wording and where it came from');
select pg_temp.expect_error($$select subscribe_newsletter('not-an-email')$$, 'valid email address');
update newsletter_subscribers set status = 'unsubscribed' where email = 'nour@example.com';
select pg_temp.check((select unsubscribed_at is not null from newsletter_subscribers where email = 'nour@example.com')
                     and (select count(*) = 2 from newsletter_events where email = 'nour@example.com'),
  'unsubscribing is dated and recorded');
select subscribe_newsletter('nour@example.com', 'about.html') as nl_again \gset
select pg_temp.check(:'nl_again' = 'subscribed'
                     and (select status = 'subscribed' and unsubscribed_at is null from newsletter_subscribers where email = 'nour@example.com'),
  'someone who unsubscribed can sign up again themselves');
select pg_temp.check(has_function_privilege('anon', 'public.subscribe_newsletter(text, text)', 'execute')
                     and not has_table_privilege('anon', 'public.newsletter_subscribers', 'select'),
  'visitors can sign up but cannot read the list');
select pg_temp.check(not exists (select 1 from newsletter_subscribers where email in (select email from orders)),
  'placing an order does not subscribe anyone');

-- Custom-piece requests get CR numbers and keep their choices.
select save_custom_request('{"name":"Rana","email":"Rana@Example.com","phone":"70","piece":"Ring",
    "gold":"Rose gold","stones":["Emerald","Diamond"],"description":"An emerald ring","occasion":"2026-12-24"}'::jsonb)->>'reference' as cr_ref \gset
select pg_temp.check(:'cr_ref' = 'CR001'
                     and (select stones = array['Emerald','Diamond'] and email = 'rana@example.com' and occasion = '2026-12-24'
                            from custom_requests where reference = 'CR001'),
  'a custom request is saved with its choices and a CR number');
select pg_temp.expect_error($$select save_custom_request('{"name":"Rana","email":"x","phone":"70","piece":"Ring","gold":"Rose gold","description":"x"}')$$,
  'valid email address');
select pg_temp.check(not has_function_privilege('anon', 'public.save_custom_request(jsonb)', 'execute')
                     and not has_table_privilege('anon', 'public.custom_requests', 'select'),
  'only the server can save or read custom requests');

-- Return and repair requests get RR numbers.
select save_service_request('{"kind":"Repair","order_ref":" s017 ","piece":"Horse Shoe Ring","problem":"A stone fell out",
    "cause":"Noticed it after washing my hands","name":"Rana","email":"Rana@Example.com","phone":"70",
    "files":["ring.jpg"]}'::jsonb)->>'reference' as rr_ref \gset
select pg_temp.check(:'rr_ref' = 'RR001'
                     and (select order_ref = 'S017' and kind = 'Repair' and files = array['ring.jpg'] and email = 'rana@example.com'
                            from service_requests where reference = 'RR001'),
  'a return or repair request is saved with an RR number');
select pg_temp.expect_error($$select save_service_request('{"kind":"Repair","order_ref":"S017","piece":"Ring","problem":"x","name":"Rana","email":"rana@example.com","phone":"70"}')$$,
  'cause field');
select pg_temp.expect_error($$select save_service_request('{"kind":"Melt it","order_ref":"S017","piece":"Ring","problem":"x","cause":"y","name":"Rana","email":"rana@example.com","phone":"70"}')$$,
  'service_requests_kind_check');
select pg_temp.check(not has_function_privilege('anon', 'public.save_service_request(jsonb)', 'execute')
                     and not has_table_privilege('anon', 'public.service_requests', 'select'),
  'only the server can save or read return and repair requests');

-- Gift voucher orders get VR numbers.
select save_voucher_request('{"amount":150,"recipient_name":"Maya","recipient_phone":"+961 71 000 000","send_to":"recipient",
    "name":"Rana","email":"Rana@Example.com","phone":"70"}'::jsonb)->>'reference' as vr_ref \gset
select pg_temp.check(:'vr_ref' = 'VR001'
                     and (select amount = 150 and recipient_email is null and email = 'rana@example.com' and status = 'new'
                            from voucher_requests where reference = 'VR001'),
  'a gift voucher order is saved with a VR number');
select pg_temp.expect_error($$select save_voucher_request('{"amount":50,"recipient_name":"Maya","recipient_phone":"1","send_to":"recipient","name":"Rana","email":"r@example.com","phone":"70"}')$$,
  'start at');
select pg_temp.expect_error($$select save_voucher_request('{"amount":150,"recipient_name":"Maya","send_to":"recipient","name":"Rana","email":"r@example.com","phone":"70"}')$$,
  'recipient''s email or WhatsApp');
select pg_temp.check(not has_function_privilege('anon', 'public.save_voucher_request(jsonb)', 'execute')
                     and not has_table_privilege('anon', 'public.voucher_requests', 'select'),
  'only the server can save or read gift voucher orders');

-- Marking a voucher order paid creates the voucher; it is emailed once, and not before its send date.
update voucher_requests set status = 'paid' where reference = 'VR001';
select pg_temp.check((select q.voucher_code like 'GV%' and v.amount = 150 and v.recipient_name = 'Maya' and v.purchaser_name = 'Rana'
                             and v.recipient_phone = '+961 71 000 000'
                        from voucher_requests q join gift_vouchers v on v.code = q.voucher_code where q.reference = 'VR001'),
  'marking a voucher order paid creates the voucher');
select id as vr_id from voucher_requests where reference = 'VR001' \gset
select pg_temp.check(array(select vouchers_due()) = array[:'vr_id'::uuid], 'the paid voucher is due to be sent');
select claim_voucher_email(:'vr_id')->>'voucher_code' as claimed_code \gset
select claim_voucher_email(:'vr_id') is null as second_claim_empty \gset
select pg_temp.check(:'claimed_code' like 'GV%' and :'second_claim_empty'::boolean
                     and (select status from voucher_requests where id = :'vr_id') = 'issued',
  'a paid voucher is claimed for emailing once, then marked issued');
select save_voucher_request('{"amount":200,"recipient_name":"Lea","recipient_email":"lea@example.com","send_to":"recipient",
    "send_on":"2099-01-01","name":"Rana","email":"rana@example.com","phone":"70"}'::jsonb)->>'reference' as vr2 \gset
update voucher_requests set status = 'paid' where reference = :'vr2';
select id as vr2_id from voucher_requests where reference = :'vr2' \gset
select pg_temp.check(claim_voucher_email(:'vr2_id') is null and not exists (select 1 from vouchers_due() d where d = :'vr2_id'::uuid),
  'a voucher with a later send date waits until that day');
select pg_temp.check(not has_function_privilege('anon', 'public.claim_voucher_email(uuid, boolean)', 'execute'),
  'only the server can send vouchers');

-- Sales recorded by the owner: next S number, sales channel, agreed price, stock taken off.
insert into stock (product_slug, metal, size, quantity) values ('horseshoe-necklace', 'rose', '', 1)
  on conflict (product_slug, metal, size) do update set quantity = 1;
select record_sale('{"channel":"Instagram","customer_name":"Nour","payment_method":"card","sale_date":"2026-10-30",
    "items":[{"slug":"horseshoe-necklace","metal":"rose","quantity":1,"unit_price":450,"from_stock":true}]}'::jsonb)->>'reference' as rs_ref \gset
select pg_temp.check((select channel = 'Instagram' and payment_method = 'card' and status = 'delivered' and total = 450
                             and (created_at at time zone 'Asia/Beirut')::date = '2026-10-30'
                        from orders where reference = :'rs_ref')
                     and (select quantity = 0 from stock where product_slug = 'horseshoe-necklace' and metal = 'rose' and size = ''),
  'a recorded sale gets an order number, its channel and agreed price, and comes off stock');
select pg_temp.expect_error($$select record_sale('{"channel":"In person","customer_name":"Lea","payment_method":"cash",
    "items":[{"slug":"horseshoe-necklace","metal":"rose","quantity":1,"from_stock":true}]}')$$, 'not in stock');
select record_sale('{"channel":"In person","customer_name":"Lea","payment_method":"whish",
    "items":[{"slug":"horseshoe-necklace","metal":"rose","quantity":1,"from_stock":false}]}'::jsonb)->>'status' as rs_status \gset
select pg_temp.check(:'rs_status' = 'preparing', 'a piece sold to be made is marked as being prepared, at the listed price');
select pg_temp.expect_error($$select record_sale('{"channel":"Website","customer_name":"Lea","payment_method":"cash","items":[{"slug":"horseshoe-necklace"}]}')$$,
  'where the sale was made');
select pg_temp.expect_error($$select record_sale('{"channel":"In person","customer_name":"Lea","payment_method":"cash","sale_date":"2999-01-01","items":[{"slug":"horseshoe-necklace"}]}')$$,
  'future');
select pg_temp.check((select (sales_export(null, null)::jsonb @> jsonb_build_array(jsonb_build_object('reference', :'rs_ref', 'channel', 'Instagram')))),
  'recorded sales appear in the workbook download with their channel');
select pg_temp.check(not has_function_privilege('anon', 'public.record_sale(jsonb)', 'execute')
                     and not has_function_privilege('authenticated', 'public.record_sale(jsonb)', 'execute'),
  'only the server can record sales');

-- The stock table shows each piece's name and code, and the length of pieces without a size.
select pg_temp.check((select piece = 'Horse Shoe Necklace (NK-01)' and length = '40 cm chain + 6 cm drop chain'
                        from stock where product_slug = 'horseshoe-necklace' and metal = 'yellow' and size = '')
                     and (select piece like 'Midnight Horse Shoe Bracelet%' from stock where product_slug = 'horseshoe-bracelet' and size = '15–17 cm')
                     and exists (select 1 from stock where product_slug = 'v-pendant-necklace')
                     and exists (select 1 from stock where product_slug = 'crescent-moon-ring' and size = 'EU 54'),
  'every piece is listed in the stock table with its name, code and length');

\o
\echo 'ALL STORE DATABASE TESTS PASSED'
