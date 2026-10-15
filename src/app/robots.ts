import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/constants/site'

// output: 'export' 에서 메타데이터 라우트는 정적 생성으로 고정해야 한다.
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            // 로그인 콜백은 색인 대상이 아니다.
            disallow: ['/auth/'],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    }
}
