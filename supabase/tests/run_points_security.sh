#!/usr/bin/env bash
set -euo pipefail

# Usage: bash supabase/tests/run_points_security.sh [baseline|hardened]
mode="${1:-hardened}"
if [[ "$mode" != baseline && "$mode" != hardened ]]; then
  echo 'usage: run_points_security.sh [baseline|hardened]' >&2
  exit 2
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
db_dir="$(mktemp -d "${TMPDIR:-/tmp}/miliyday-points-test.XXXXXX")"
db_port=55478
cleanup() {
  pg_ctl -D "$db_dir/data" stop -m immediate >/dev/null 2>&1 || true
}
trap cleanup EXIT

initdb -D "$db_dir/data" -A trust --no-instructions >/dev/null
pg_ctl -D "$db_dir/data" -o "-k $db_dir -p $db_port -h ''" -l "$db_dir/postgres.log" start >/dev/null
psql_test=(psql -X -v ON_ERROR_STOP=1 -h "$db_dir" -p "$db_port" -d postgres)
"${psql_test[@]}" -f "$root_dir/supabase/tests/fixtures/points_base.sql" >/dev/null
"${psql_test[@]}" -f "$root_dir/supabase/migrations/20260805090000_server_side_points.sql" >/dev/null
"${psql_test[@]}" -f "$root_dir/supabase/migrations/20260805090100_admin_role.sql" >/dev/null
if [[ "$mode" == hardened ]]; then
  migration="$(find "$root_dir/supabase/migrations" -maxdepth 1 -name '*_harden_points.sql' -print -quit)"
  if [[ -z "$migration" ]]; then
    echo 'harden_points migration not found' >&2
    exit 2
  fi
  "${psql_test[@]}" -f "$migration" >/dev/null
fi
"${psql_test[@]}" -f "$root_dir/supabase/tests/points_security.sql"

if [[ "$mode" == hardened ]]; then
  # Hold the profile row while two independent callers queue on the same reward.
  "${psql_test[@]}" -c "insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000003'); insert into public.posts (id, user_id, board_type) values ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'military_board')" >/dev/null
  "${psql_test[@]}" -c "begin; select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000003' for update; select pg_sleep(1); commit" >/dev/null &
  lock_pid=$!
  sleep 0.2
  reward_sql="set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003'; select public.earn_content_reward('post_reward', '10000000-0000-0000-0000-000000000006')"
  "${psql_test[@]}" -c "$reward_sql" >/dev/null &
  first_pid=$!
  "${psql_test[@]}" -c "$reward_sql" >/dev/null &
  second_pid=$!
  wait "$lock_pid"
  wait "$first_pid"
  wait "$second_pid"
  "${psql_test[@]}" -c "do \$\$ begin
    if (select points from public.profiles where id = '00000000-0000-0000-0000-000000000003') <> 50 then
      raise exception 'concurrent reward balance mismatch';
    end if;
    if (select count(*) from public.point_transactions where user_id = '00000000-0000-0000-0000-000000000003') <> 1 then
      raise exception 'concurrent reward ledger mismatch';
    end if;
    if (select count from public.daily_point_limits where user_id = '00000000-0000-0000-0000-000000000003') <> 1 then
      raise exception 'concurrent reward daily count mismatch';
    end if;
  end \$\$" >/dev/null
  echo 'concurrent content reward: one ledger entry, one daily count, 50 points'
fi
