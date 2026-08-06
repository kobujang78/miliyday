# Supabase 적용 절차

> **이 PR 은 DB 변경이 선행되어야 동작한다.** 코드만 머지하면 포인트 적립과 회원 탈퇴가 실패한다.
> 아래 순서를 그대로 따를 것.

## 0. 사전 준비

**백업을 먼저 뜬다.** Free 플랜은 자동 백업이 없다(대시보드 `LAST BACKUP: No backups`).

```bash
# Project Settings > Database > Connection string 에서 얻은 값 사용
pg_dump "$DATABASE_URL" -Fc -f miliyday-$(date +%Y%m%d).dump
```

현재 상태를 눈으로 확인한다. SQL Editor 에서:

```sql
-- add_points 의 현재 권한과 시그니처
select proname, pg_get_function_identity_arguments(oid) as args,
       prosecdef as security_definer, proacl::text as acl
from pg_proc where proname = 'add_points' and pronamespace = 'public'::regnamespace;

-- 닉네임으로 관리자 노릇을 하던 계정 (마이그레이션이 role='admin' 으로 승격시킨다)
select id, email, nickname, display_name from public.profiles
where nickname = '관리자' or display_name = '관리자';
```

두 번째 쿼리 결과가 **의도한 계정인지 반드시 확인**하라. 아니라면 마이그레이션의 해당
`update ... set role = 'admin'` 블록을 지우고, 적용 후 직접 승격시킨다.

## 0-1. 이 프로젝트에서 확인된 사항 (2026-08-05 실측)

STEP 0 사전 점검 결과 **예약 닉네임 3건**이 있어 그대로는 CHECK 제약 생성이 실패한다.

| id | nickname | 처리 |
|---|---|---|
| `31dfbc87-…4523f` | 관리자 | display_name 으로 대체 |
| `5ad159e8-…9a1d4` | 관리자 | display_name 으로 대체 + **role='admin' 승격** |
| `7b6634c4-…54df6` | 관리자1 | display_name 으로 대체 |

마이그레이션 `20260805090100_admin_role.sql` 의 2번 블록이 이 정리를 자동으로 수행한다.
**승격은 마이그레이션이 하지 않는다.** 닉네임으로 대상을 고르면 그 닉네임을 지우는 순간
기준이 사라지고, 무엇보다 "표시 이름으로 권한을 정한다"는 원래 문제를 반복하게 된다.
적용 후 id 로 명시 승격할 것:

```sql
update public.profiles set role = 'admin'
where id = '5ad159e8-a0b9-43c6-b80b-fd0555a9a1d4';
```

> 닉네임에 유니크 제약이 없어 '관리자'가 2개 존재했다. 앱의 용사 검색·연동이 닉네임 기반이므로
> 별도로 다룰 문제다. 후속 작업으로 남긴다.

## 1. 마이그레이션 적용

순서대로 실행한다. 각각을 SQL Editor 에 붙여넣거나 CLI 를 쓴다.

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `migrations/20260805090000_server_side_points.sql` | 포인트 적립을 DB 함수로 이관, `add_points` 실행 권한 회수 |
| 2 | `migrations/20260805090100_admin_role.sql` | `profiles.role` 도입, 예약 닉네임 제약, 컬럼 단위 UPDATE 권한 |

```bash
# CLI 를 쓰는 경우
supabase link --project-ref nxcleinpamivgbpydzoq
supabase db push
```

## 2. Edge Function 배포

```bash
supabase functions deploy delete-account
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 는 플랫폼이 자동 주입한다.
`index.ts` 의 `ALLOWED_ORIGINS` 에 실제 배포 도메인이 들어 있는지 확인할 것.

## 3. 코드 배포

이 PR 을 머지한다. Vercel 이 자동 배포한다.

## 4. 검증

### 4-1. 취약점이 닫혔는지 (가장 중요)

```bash
# <ANON_KEY> 는 배포 번들에 있는 공개 키. <USER_ID> 는 임의의 실제 사용자 id.
curl -s -X POST 'https://nxcleinpamivgbpydzoq.supabase.co/rest/v1/rpc/add_points' \
  -H 'apikey: <ANON_KEY>' -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"p_user_id":"<USER_ID>","p_amount":0}'
```

- **적용 전**: `200` 과 함께 해당 사용자의 포인트 잔액이 반환된다 ← 취약
- **적용 후**: `401` 또는 `{"code":"42501", ...}` ← 정상

이 응답이 바뀌는 것이 이 작업의 완료 판정 기준이다.

```bash
# 새 함수도 익명으로는 막혀야 한다
curl -s -X POST 'https://nxcleinpamivgbpydzoq.supabase.co/rest/v1/rpc/earn_content_reward' \
  -H 'apikey: <ANON_KEY>' -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' -d '{"p_action_type":"post_reward"}'
# 기대: 401 / 42501
```

### 4-2. 기능이 살아 있는지

로그인한 상태로 확인한다.

- [ ] 커뮤니티에 글 작성 → `+50P 적립` 토스트, 마이페이지 잔액 증가
- [ ] 같은 날 4번째 글 작성 → 적립 토스트가 뜨지 않음 (일일 3회 한도)
- [ ] 생활공유 작성 → `+30P`
- [ ] 초대코드로 가입 → 양쪽 적립 (`2,000P` / `1,000P`)
- [ ] 자기 초대코드 입력 → "자신의 초대코드는 사용할 수 없습니다"
- [ ] 이미 사용한 계정이 다시 입력 → "이미 초대코드 보상을 받았습니다"
- [ ] 닉네임을 '관리자'로 변경 시도 → DB 제약으로 거부
- [ ] 관리자 계정에서만 공지사항 카테고리가 보임
- [ ] 회원 탈퇴 → 같은 이메일로 재가입 시 **신규 가입**으로 동작 (기존 데이터 없음)

### 4-3. 원장과 잔액이 맞는지

```sql
select p.id, p.points as balance,
       coalesce(sum(t.amount), 0) as ledger,
       p.points - coalesce(sum(t.amount), 0) as diff
from profiles p
left join point_transactions t on t.user_id = p.id
group by p.id, p.points
having p.points <> coalesce(sum(t.amount), 0);
```

기존 클라이언트 구현은 원장 INSERT 와 잔액 UPDATE 가 **별개 요청 2개**였으므로
한쪽만 성공해 어긋난 행이 있을 수 있다. 위 쿼리로 확인하고 필요하면 잔액을 원장 기준으로 맞춘다.

## 롤백

```sql
-- 함수 권한 원복
do $$ declare r record; begin
  for r in select oid::regprocedure::text as sig from pg_proc
           where proname = 'add_points' and pronamespace = 'public'::regnamespace
  loop execute format('grant execute on function %s to anon, authenticated', r.sig); end loop;
end $$;

drop function if exists public.earn_content_reward(text, uuid);
drop function if exists public.redeem_invite_code(text);
grant update on public.profiles to authenticated;
grant insert, update, delete on public.point_transactions to authenticated;
```

**되돌릴 수 없는 것**: `daily_point_limits` 의 UNIQUE 제약을 만들면서 중복 행을 삭제한다.
`profiles.role` 컬럼 추가와 닉네임 제약은 되돌릴 수 있지만, 제약 위반 행이 있으면
제약 생성 자체가 실패하므로 적용 전에 위 사전 조회로 확인할 것.

## 남은 후속 작업

- `acceptConnectionRequest` 가 클라이언트에서 **타인(신청자)의 profiles 행을 UPDATE** 한다.
  `profiles` UPDATE 정책이 본인 행으로 제한되어 있다면 연동 수락이 조용히 실패한다.
  `accept_connection_request` RPC 로 옮겨야 한다.
- 좋아요/댓글 카운터를 클라이언트가 계산해 UPDATE 한다. DB 트리거로 옮길 것.
- 이미지가 base64 로 DB 에 저장된다. Storage 로 이전할 것.
