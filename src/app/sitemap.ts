import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/constants/site'

// output: 'export' 에서 메타데이터 라우트는 정적 생성으로 고정해야 한다.
export const dynamic = 'force-static'

// 로그인 게이트 뒤의 화면은 색인해도 내용이 보이지 않으므로 공개 진입점만 싣는다.
const PUBLIC_PATHS = ['/', '/onboarding']

export default function sitemap(): MetadataRoute.Sitemap {
    return PUBLIC_PATHS.map(path => ({
        url: `${SITE_URL}${path}`,
        changeFrequency: 'weekly' as const,
        priority: path === '/' ? 1 : 0.8,
    }))
}
