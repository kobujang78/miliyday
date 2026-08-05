# 슬기로운 병영생활 (miliyday)

군 복무 중인 용사와 그 지인(여자친구·가족·친구)을 위한 모바일 웹/앱 서비스.
전역일·진급일 계산, 휴가 관리, 월급·적금 계산, 커뮤니티, 밀포인트를 제공한다.

## 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, **`output: 'export'` 정적 내보내기**) |
| UI | React 19, Tailwind CSS v4 (일부 화면은 인라인 스타일) |
| 백엔드 | Supabase (Auth + Postgres). **서버 코드 없음 — 브라우저가 직접 접속** |
| 모바일 | Capacitor 8 (iOS / Android 셸) |
| 호스팅 | Vercel (정적) |
| 테스트 | Playwright (단위 + E2E 겸용 러너) |

> **중요**: 정적 내보내기이므로 API Route·Server Action·미들웨어가 동작하지 않는다.
> 모든 보안 경계는 **Postgres RLS와 함수 권한 한 겹**이다.
> 클라이언트에 있는 검사(관리자 판정, 포인트 일일 한도, 닉네임 금지어, 소유권 확인)는
> 보안이 아니라 UI 편의일 뿐이므로, 신뢰가 필요한 로직은 DB 함수나 Edge Function으로 옮긴다.

## 시작하기

```bash
npm ci
cp .env.example .env.local   # Supabase URL / anon key 입력
npm run dev                  # http://localhost:3000
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 정적 빌드 (`out/` 생성) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | 순수 함수 단위 테스트 (`tests/unit`, 브라우저 미기동) |
| `npm run test:e2e` | E2E (`tests/dday.spec.ts`) — dev 서버가 떠 있어야 함 |
| `npm run mobile:sync` | `npx cap sync` — 웹 빌드를 네이티브 프로젝트에 반영 |
| `npm run mobile:open:ios` / `:android` | 네이티브 IDE 열기 |

## 디렉터리

```
src/app/(tabs)/     홈 하단 탭 화면 (복무현황·월급·휴가·커뮤니티·혜택·생활공유·마이페이지·포인트)
src/app/onboarding/ 로그인 / 가입 / 프로필 설정
src/components/     AuthProvider, AppShell, BottomNav, RankIcon 등
src/lib/            Supabase 클라이언트 + 순수 계산 로직 (rank/salary/vacation/point/share/connection)
src/constants/      약관·개인정보 처리방침 텍스트
tests/unit/         브라우저 없이 도는 계산 로직 테스트
android/ ios/       Capacitor 네이티브 셸
```

## 배포

Vercel이 `main` 푸시를 자동 배포한다. 보안 응답 헤더는 `vercel.json`에서 관리한다
(정적 내보내기에서는 `next.config.ts`의 `headers()`가 적용되지 않는다).

CSP는 현재 `Content-Security-Policy-Report-Only`로 되어 있다.
콘솔에 위반이 없는 것을 확인한 뒤 `Content-Security-Policy`로 바꾼다.

## 알려진 제약

- **이메일 가입은 인증 메일 확인이 필수**다(Supabase `mailer_autoconfirm=false`).
  인증 전에는 세션이 없으므로 온보딩을 진행시키지 않는다.
- 카카오·애플·GitHub 로그인은 Supabase에서 아직 비활성 상태다.
- 이미지가 base64로 DB에 저장된다. Supabase Storage로 이전 예정.
- 포인트 적립 로직 일부가 클라이언트에 남아 있다. DB 함수로 이전 예정.
