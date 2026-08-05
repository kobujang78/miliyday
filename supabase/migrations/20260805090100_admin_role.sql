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

-- 기존에 닉네임으로 관리자 노릇을 하던 계정이 있으면 승격시킨다.
-- 적용 전에 아래 select 로 대상을 눈으로 확인할 것:
--   select id, email, nickname, display_name from public.profiles
--   where nickname = '관리자' or display_name = '관리자';
update public.profiles
   set role = 'admin'
 where (nickname = '관리자' or display_name = '관리자')
   and role <> 'admin';

-- ── 2. 예약 닉네임은 DB 에서 막는다 ─────────────────────────────────────
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

-- ── 3. 관리자 판별 헬퍼 ────────────────────────────────────────────────
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

-- ── 4. 사용자가 자기 권한·잔액을 못 바꾸게 한다 ─────────────────────────
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
