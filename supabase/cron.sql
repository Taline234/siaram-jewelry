-- Runs only on the real Supabase project (the local tests have no scheduler or pg_net). Safe to run more than once.
-- Every day at 03:15 (UTC) the database calls the inactive-accounts function, sending the secret kept in
-- private.cron. The call also keeps the free project active.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The "on its way" email trigger (in schema.sql) calls the functions here.
update private.cron set functions_url = 'https://vdfxyjusmakqnpptniiy.supabase.co/functions/v1' where id = 1;

select cron.schedule(
  'siaram-inactive-accounts',
  '15 3 * * *',
  $$
  select net.http_post(
    url := 'https://vdfxyjusmakqnpptniiy.supabase.co/functions/v1/inactive-accounts',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-cron-secret', (select secret from private.cron where id = 1)),
    body := '{}'::jsonb
  );
  $$
);
