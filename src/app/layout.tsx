import './globals.css'
import React from 'react'
import MockProvider from './providers/MockProvider'
import AuthProvider from '@/components/AuthProvider'
import AppShell from '@/components/AppShell'

export const metadata = {
  title: '슬기로운 병영생활',
  description: '슬기로운 병영생활 - 군 생활의 든든한 동반자',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <MockProvider>
            <AppShell>{children}</AppShell>
          </MockProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
