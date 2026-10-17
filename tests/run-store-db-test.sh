#!/usr/bin/env bash
# Runs tests/store-db-test.sql against a throwaway local Postgres database.
# Needs a Postgres server you can connect to, e.g.:
#   PGHOST=localhost PGUSER=postgres tests/run-store-db-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="siaram_store_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

psql -q -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
-- Minimal stand-in for what Supabase provides.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb,
  last_sign_in_at timestamptz, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/schema.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/schema.sql   # re-running must be safe
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/store-db-test.sql
