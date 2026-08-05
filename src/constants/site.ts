/**
 * 배포 주소. OG 태그·sitemap·초대 링크가 절대 URL 을 필요로 한다.
 * 커스텀 도메인이 생기면 이 값만 바꾸면 된다.
 *
 * 주의: output: 'export' 이므로 빌드 시점에 번들로 인라인된다.
 */
export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://miliyday.vercel.app'

export const SITE_NAME = '슬기로운 병영생활'
export const SITE_DESCRIPTION = '군 생활의 든든한 동반자 — 전역일·진급·휴가·월급·커뮤니티를 한 곳에서'
