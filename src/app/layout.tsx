import './globals.css'
import React from 'react'
import MockProvider from './providers/MockProvider'

export const metadata = {
  title: 'MiliConnect',
  description: 'MiliConnect frontend prototype',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen bg-zinc-50">
          <header className="bg-white shadow-sm">
            <nav className="max-w-md mx-auto p-4 flex items-center justify-between">
              <h1 className="text-lg font-semibold">MiliConnect</h1>
              <div className="text-sm text-gray-600">v0.1</div>
            </nav>
          </header>

          <main className="p-4">
            <MockProvider>{children}</MockProvider>
          </main>
        </div>
      </body>
    </html>
  )
}
