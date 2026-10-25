import './globals.css'
import React from 'react'
import type { Metadata, Viewport } from 'next'
import AuthProvider from '@/components/AuthProvider'
import AppShell from '@/components/AppShell'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/constants/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['군대', '전역일', '전역 디데이', '진급', '휴가', '병사 월급', '장병내일준비적금', '군인 커뮤니티'],
  // 초대 링크를 카카오톡·문자로 공유하는 것이 주요 유입 경로다.
  // OG 태그가 없으면 미리보기 없이 맨 URL만 보인다.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'ko_KR',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/og.jpg'],
  },
  appleWebApp: {
    capable: true,
    title: '슬병생',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 웹뷰에서 입력창 포커스 시 확대되는 것을 막되, 사용자가 확대하는 것은 허용한다(접근성).
  maximumScale: 5,
  themeColor: '#2d5016',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
