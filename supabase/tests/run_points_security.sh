#!/usr/bin/env bash
set -euo pipefail

# Usage: bash supabase/tests/run_points_security.sh [baseline|hardened]
mode="${1:-hardened}"
if [[ "$mode" != baseline && "$mode" != invite-baseline && "$mode" != hardened && "$mode" != content-preflight && "$mode" != invite-preflight ]]; then
  echo 'usage: run_points_security.sh [baseline|invite-baseline|hardened|content-preflight|invite-preflight]' >&2
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
if [[ "$mode" == content-preflight || "$mode" == invite-preflight ]]; then
  "${psql_test[@]}" -c "insert into public.profiles (id) values
    ('00000000-0000-0000-0000-000000000071'),
    ('00000000-0000-0000-0000-000000000072')" >/dev/null
  if [[ "$mode" == content-preflight ]]; then
    "${psql_test[@]}" -c "insert into public.point_transactions (user_id, amount, type, reference_id) values
      ('00000000-0000-0000-0000-000000000071', 50, 'post_reward', '10000000-0000-0000-0000-000000000071'),
      ('00000000-0000-0000-0000-000000000071', 50, 'post_reward', '10000000-0000-0000-0000-000000000071')" >/dev/null
  else
    "${psql_test[@]}" -c "insert into public.invite_records (inviter_id, invitee_id) values
      ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000072'),
      ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000072')" >/dev/null
  fi
  migration="$(find "$root_dir/supabase/migrations" -maxdepth 1 -name '*_harden_points.sql' -print -quit)"
  if "${psql_test[@]}" -f "$migration" >/dev/null 2>&1; then
    echo 'migration unexpectedly accepted duplicate history' >&2
    exit 1
  fi
  "${psql_test[@]}" -c "do \$\$ begin
    if to_regclass('public.point_transactions_content_reward_once') is not null
       or exists (select 1 from pg_constraint where conname = 'invite_records_invitee_id_key') then
      raise exception 'failed migration left partial constraints';
    end if;
    if (select count(*) from public.point_transactions) + (select count(*) from public.invite_records) <> 2 then
      raise exception 'duplicate history was modified';
    end if;
  end \$\$" >/dev/null
  echo "$mode: migration refused duplicates without changing history"
  exit 0
fi
if [[ "$mode" == hardened ]]; then
  migration="$(find "$root_dir/supabase/migrations" -maxdepth 1 -name '*_harden_points.sql' -print -quit)"
  if [[ -z "$migration" ]]; then
    echo 'harden_points migration not found' >&2
    exit 2
  fi
  "${psql_test[@]}" -f "$migration" >/dev/null
fi
if [[ "$mode" == invite-baseline ]]; then
  "${psql_test[@]}" -v run_content=false -f "$root_dir/supabase/tests/points_security.sql"
else
  "${psql_test[@]}" -v run_content=true -f "$root_dir/supabase/tests/points_security.sql"
fi

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

if [[ "$mode" == invite-baseline || "$mode" == hardened ]]; then
  "${psql_test[@]}" -c "insert into public.profiles (id, invite_code) values
    ('00000000-0000-0000-0000-000000000021', 'INVITE21'),
    ('00000000-0000-0000-0000-000000000022', 'INVITE22'),
    ('00000000-0000-0000-0000-000000000023', null)" >/dev/null
  "${psql_test[@]}" -c "create function public.delay_invite_insert() returns trigger language plpgsql as \$\$ begin
    if new.invitee_id = '00000000-0000-0000-0000-000000000023' then perform pg_sleep(0.5); end if;
    return new;
  end \$\$;
  create trigger test_delay_invite before insert on public.invite_records
  for each row execute function public.delay_invite_insert()" >/dev/null
  invite_sql_1="set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000023'; select public.redeem_invite_code('INVITE21')"
  invite_sql_2="set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000023'; select public.redeem_invite_code('INVITE22')"
  "${psql_test[@]}" -c "$invite_sql_1" >/dev/null &
  first_pid=$!
  "${psql_test[@]}" -c "$invite_sql_2" >/dev/null &
  second_pid=$!
  wait "$first_pid"
  wait "$second_pid"
  "${psql_test[@]}" -c "do \$\$ begin
    if (select count(*) from public.invite_records where invitee_id = '00000000-0000-0000-0000-000000000023') <> 1 then
      raise exception 'concurrent invite record mismatch';
    end if;
    if (select points from public.profiles where id = '00000000-0000-0000-0000-000000000023') <> 2000 then
      raise exception 'concurrent invitee balance mismatch';
    end if;
    if (select coalesce(sum(points), 0) from public.profiles where id in
      ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000022')) <> 1000 then
      raise exception 'concurrent inviter balances mismatch';
    end if;
    if (select count(*) from public.point_transactions where user_id = '00000000-0000-0000-0000-000000000023' and type = 'signup_bonus') <> 1 then
      raise exception 'concurrent invite ledger mismatch';
    end if;
  end \$\$" >/dev/null
  echo 'concurrent invite: one record, one pair of rewards'
fi
