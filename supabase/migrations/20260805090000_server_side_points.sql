-- ============================================================================
-- 포인트 적립을 서버(DB)로 이관하고 add_points 익명 실행을 차단한다.
-- ============================================================================
-- 배경
--   이 앱은 output: 'export' 라 서버가 없다. 브라우저가 anon key 로 Postgres 에
--   직접 붙으므로 클라이언트 코드의 검사는 전부 위조 가능하다.
--
--   기존 add_points(uuid, integer) 는
--     · anon 롤에 EXECUTE 가 열려 있었고
--     · SECURITY DEFINER 라 RLS 를 우회했으며
--     · 대상 사용자를 인자 p_user_id 로 받아 그대로 신뢰했다
--   실측 결과 로그인 없이 임의 사용자의 포인트를 발행할 수 있었고,
--   반환값이 잔액이라 타인의 잔액 조회 오라클로도 동작했다.
--
--   일일 3회 한도도 클라이언트에서 "조회 → 적립 → 카운터 증가" 순서로 처리해
--   동시 요청으로 우회할 수 있었다(TOCTOU).
--
-- 적용 순서 (중요)
--   1. 백업을 뜬다. Free 플랜은 자동 백업이 없다.
--   2. 이 마이그레이션을 적용한다.
--   3. 같은 PR 의 클라이언트 코드를 배포한다.
--   순서가 뒤바뀌면 그 사이에 포인트 적립이 실패한다.
-- ============================================================================

-- ── 1. 일일 한도를 원자적으로 처리하기 위한 UNIQUE 제약 ──────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.daily_point_limits'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%user_id%action_type%action_date%'
  ) then
    -- 제약 생성 전에 중복 행을 정리한다(가장 큰 count 만 남긴다).
    delete from public.daily_point_limits a
    using public.daily_point_limits b
    where a.ctid <> b.ctid
      and a.user_id = b.user_id
      and a.action_type = b.action_type
      and a.action_date = b.action_date
      and (a.count < b.count or (a.count = b.count and a.ctid < b.ctid));

    alter table public.daily_point_limits
      add constraint daily_point_limits_user_action_date_key
      unique (user_id, action_type, action_date);
  end if;
end $$;

-- ── 2. 콘텐츠 작성 보상 ─────────────────────────────────────────────────
create or replace function public.earn_content_reward(
  p_action_type text,
  p_reference_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public          -- SECURITY DEFINER 함수는 search_path 고정이 필수다
as $$
declare
  v_uid    uuid := auth.uid();    -- 인자가 아니라 JWT 에서 신원을 얻는다
  v_amount int;
  v_limit  constant int := 3;
  v_count  int;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_amount := case p_action_type
                when 'post_reward' then 50
                when 'feed_reward' then 30
              end;
  if v_amount is null then
    raise exception 'invalid action_type: %', p_action_type using errcode = '22023';
  end if;

  -- 한도 검사와 카운터 증가를 한 문장으로 처리한다.
  -- 한도를 넘으면 WHERE 절이 거짓이 되어 갱신되지 않고 v_count 가 NULL 로 남는다.
  insert into daily_point_limits (user_id, action_type, action_date, count)
  values (v_uid, p_action_type, current_date, 1)
  on conflict (user_id, action_type, action_date)
  do update set count = daily_point_limits.count + 1
  where daily_point_limits.count < v_limit
  returning count into v_count;

  if v_count is null then
    return jsonb_build_object('earned', false, 'points', 0, 'remaining', 0);
  end if;

  insert into point_transactions (user_id, amount, type, description, reference_id)
  values (v_uid, v_amount, p_action_type,
          case p_action_type when 'post_reward' then '병영꿀팁 작성 보상'
                             else '생활공유 작성 보상' end,
          p_reference_id);

  update profiles set points = points + v_amount where id = v_uid;

  return jsonb_build_object('earned', true, 'points', v_amount,
                            'remaining', v_limit - v_count);
end $$;

-- ── 3. 초대코드 사용 ────────────────────────────────────────────────────
create or replace function public.redeem_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_inviter uuid;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select id into v_inviter from profiles where invite_code = upper(btrim(p_code));

  if v_inviter is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;
  if v_inviter = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self_invite');
  end if;
  if exists (select 1 from invite_records where invitee_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  insert into invite_records (inviter_id, invitee_id) values (v_inviter, v_uid);
  update profiles set invited_by = v_inviter where id = v_uid;

  insert into point_transactions (user_id, amount, type, description)
  values (v_uid,     2000, 'signup_bonus',  '초대코드 가입 보너스'),
         (v_inviter, 1000, 'invite_reward', '지인 초대 보상');

  update profiles set points = points + 2000 where id = v_uid;
  update profiles set points = points + 1000 where id = v_inviter;

  return jsonb_build_object('ok', true, 'points', 2000);
end $$;

-- ── 4. 권한 정리 ────────────────────────────────────────────────────────
-- 취약했던 함수의 공개 실행 권한을 회수한다.
-- 시그니처가 다르면 아래 조회로 확인 후 맞춰서 수정할 것:
--   select proname, pg_get_function_identity_arguments(oid) from pg_proc
--   where proname = 'add_points' and pronamespace = 'public'::regnamespace;
do $$
declare r record;
begin
  for r in
    select oid::regprocedure::text as sig
    from pg_proc
    where proname = 'add_points' and pronamespace = 'public'::regnamespace
  loop
    execute format('revoke execute on function %s from anon, authenticated, public', r.sig);
  end loop;
end $$;

-- 새 함수는 로그인 사용자만 실행할 수 있다.
revoke execute on function public.earn_content_reward(text, uuid) from public, anon;
revoke execute on function public.redeem_invite_code(text)        from public, anon;
grant  execute on function public.earn_content_reward(text, uuid) to authenticated;
grant  execute on function public.redeem_invite_code(text)        to authenticated;

-- 클라이언트가 원장을 직접 조작하지 못하게 한다.
revoke insert, update, delete on public.point_transactions from anon, authenticated;
revoke insert, update, delete on public.daily_point_limits  from anon, authenticated;
revoke insert, update, delete on public.invite_records      from anon, authenticated;
