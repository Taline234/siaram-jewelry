#!/usr/bin/env bash
# Browser test of the online store: real pages + Netlify functions + real database rules.
# Supabase is replaced by server.mjs, which runs every query on a local Postgres.
# Needs Node 20+, a local Postgres you can reach as "postgres" (PGHOST/PGPORT), and Chromium:
#   PGHOST=localhost tests/e2e/run.sh
set -euo pipefail
cd "$(dirname "$0")"
export E2E_DB="${E2E_DB:-siaram_e2e}"

[ -d node_modules ] || npm install --silent
npx esbuild --bundle --format=esm --platform=browser --log-level=warning \
  node_modules/@supabase/supabase-js/dist/module/index.js --outfile=supabase.esm.js

dropdb -U postgres --if-exists "$E2E_DB"
createdb -U postgres "$E2E_DB"
sed -n "/^psql -q -v ON_ERROR_STOP=1 -d \"\$DB\" <<'SQL'/,/^SQL$/p" ../run-store-db-test.sh | sed '1d;$d' \
  | psql -U postgres -q -v ON_ERROR_STOP=1 -d "$E2E_DB"
psql -U postgres -q -v ON_ERROR_STOP=1 -d "$E2E_DB" -f ../../supabase/schema.sql 2>&1 | grep -v skipping || true
psql -U postgres -q -v ON_ERROR_STOP=1 -d "$E2E_DB" <<'SQL'
update products set price = 120 where slug = 'pave-chevron-necklace';
update products set price = 85 where slug = 'crescent-moon-ring';
update store_settings set whish_number = '+961 76 052 068', whish_name = 'Siaram Jewelry';
update delivery_areas set delivery_fee = 5 where governorate = 'Beirut';
insert into gift_vouchers (code, recipient_name, purchaser_name, amount, balance, expires_at) values
  ('SIARAM-GOOD-0001', 'Lea', 'Nour', 50, 50, now() + interval '3 months'),
  ('SIARAM-OLD0-0000', 'Lea', 'Nour', 50, 50, now() - interval '2 days');
SQL

node server.mjs > server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER' EXIT
sleep 2
node e2e.mjs "$@"
