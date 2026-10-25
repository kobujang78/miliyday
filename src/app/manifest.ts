import type { MetadataRoute } from 'next'

// output: 'export' 에서 메타데이터 라우트는 정적 생성으로 고정해야 한다.
export const dynamic = 'force-static'

/**
 * PWA 매니페스트. 병영 환경은 앱스토어 설치가 제한되는 경우가 있어
 * 홈 화면 추가 경로를 열어두는 것이 실질적으로 유용하다.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: '슬기로운 병영생활',
        short_name: '슬병생',
        description: '군 생활의 든든한 동반자 — 전역일·진급·휴가·월급·커뮤니티',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#2d5016',
        lang: 'ko',
        icons: [
            { src: '/favicon.ico', sizes: '256x256', type: 'image/x-icon' },
        ],
    }
}
