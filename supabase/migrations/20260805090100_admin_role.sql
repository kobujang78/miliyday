-- ============================================================================
-- 관리자 권한을 닉네임 문자열에서 profiles.role 컬럼으로 옮긴다.
-- ============================================================================
-- 배경
--   지금까지 관리자 판정이 `profile.nickname === '관리자'` 였다.
--   닉네임 금지어 검사는 클라이언트에만 있었고 사용자는 자기 profiles 행을
--   UPDATE 할 수 있으므로, REST 를 직접 호출해 닉네임을 '관리자'로 바꾸면
--   공지사항 작성·타인 글 삭제 UI 가 열렸다.
--   표시 이름에 권한을 묶은 설계 자체가 결함이다.
-- ============================================================================

-- ── 1. role 컬럼 ────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin'));
  end if;
end $$;

-- 관리자 승격은 이 마이그레이션에서 하지 않는다.
-- 닉네임으로 대상을 고르면 아래 3번에서 그 닉네임을 정리하는 순간 기준이 사라지고,
-- 무엇보다 "표시 이름으로 권한을 정한다"는 원래 문제를 그대로 반복하게 된다.
-- 운영자 계정은 id 로 명시 승격한다. 환경마다 다르므로 supabase/README.md 참고.
--   update public.profiles set role = 'admin' where id = '<운영자 uuid>';

-- ── 2. 예약 닉네임 정리 (제약 생성 전에 반드시 선행) ────────────────────
-- 기존 데이터에 '관리자', '관리자1' 같은 닉네임이 남아 있으면 아래 CHECK 제약 생성이 실패한다.
-- display_name 이 쓸 만하면 그것으로 대체하고, 그것도 예약어면 id 기반 이름을 준다.
-- 닉네임에는 유니크 제약이 없어 중복이 가능하므로 여기서도 중복을 굳이 피하지 않는다.
update public.profiles p
   set nickname = case
         when p.display_name is not null
          and btrim(p.display_name) <> ''
          and lower(replace(p.display_name, ' ', '')) !~ '(관리자|운영자|admin|administrator|공식|official)'
         then p.display_name
         else '용사' || left(replace(p.id::text, '-', ''), 4)
       end
 where p.nickname is not null
   and lower(replace(p.nickname, ' ', '')) ~ '(관리자|운영자|admin|administrator|공식|official)';

-- ── 3. 예약 닉네임은 DB 에서 막는다 ─────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_nickname_not_reserved'
  ) then
    alter table public.profiles
      add constraint profiles_nickname_not_reserved
      check (
        nickname is null
        or lower(replace(nickname, ' ', '')) !~ '(관리자|운영자|admin|administrator|공식|official)'
      );
  end if;
end $$;

-- ── 4. 관리자 판별 헬퍼 ────────────────────────────────────────────────
-- RLS 정책 안에서 profiles 를 다시 조회하면 재귀가 생길 수 있으므로
-- SECURITY DEFINER 함수로 감싼다.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- ── 5. 사용자가 자기 권한·잔액을 못 바꾸게 한다 ─────────────────────────
-- RLS 는 컬럼을 보호하지 못한다. 컬럼 단위 GRANT 로 막는다.
revoke update on public.profiles from anon, authenticated;
grant  update (
  display_name, nickname, nickname_updated_at,
  branch, rank_level, enlist_date, avatar_url,
  marketing_agreed, marketing_agreed_at,
  user_type, relationship, connected_soldier_id,
  privacy_policy_agreed, privacy_policy_agreed_at, terms_agreed
) on public.profiles to authenticated;

-- 주의: connected_soldier_id 는 연동 수락 시 "신청자의 행"을 수정해야 한다.
--       현재 acceptConnectionRequest 가 클라이언트에서 타인 행을 UPDATE 하므로,
--       profiles UPDATE 정책이 본인 행으로 제한되어 있다면 그 기능이 동작하지 않는다.
--       별도 RPC(accept_connection_request)로 옮기는 것이 옳다. 후속 작업으로 남긴다.
