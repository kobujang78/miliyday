"use client"
import React, { useEffect } from 'react'

// Lightweight in-memory fetch mock for dev: intercepts /api/* calls without MSW
export default function MockProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const posts = [ { id: 1, title: '훈련소 팁', body: '물 잘 챙겨라.', category: '훈련소' } ]
    const market = [ { id: 1, title: '군용 침낭', price: 20000, status: 'selling', images: [] } ]
    const feed = [ { id: 1, owner: 'soldier01', caption: '첫 사진', images: [], visibility: 'connections' } ]

    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input: RequestInfo, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : (input as Request).url
        const path = new URL(url, location.href).pathname
        // posts
        if (path === '/api/posts') {
          if (!init || init.method === 'GET') {
            return new Response(JSON.stringify({ posts }), { status: 200 })
          }
          if (init.method === 'POST') {
            const body = init.body ? JSON.parse(init.body.toString()) : {}
            const next = { id: Date.now(), ...body }
            posts.unshift(next)
            return new Response(JSON.stringify(next), { status: 201 })
          }
        }
        // delete patch
        if (path.startsWith('/api/posts/') && init?.method === 'DELETE') {
          const id = Number(path.split('/').pop())
          const idx = posts.findIndex(p=>p.id===id)
          if (idx>=0) posts.splice(idx,1)
          return new Response(null, { status: 204 })
        }

        // market
        if (path === '/api/market') {
          if (!init || init.method === 'GET') return new Response(JSON.stringify({ items: market }), { status: 200 })
          if (init.method === 'POST') {
            const body = init.body ? JSON.parse(init.body.toString()) : {}
            const next = { id: Date.now(), ...body }
            market.unshift(next)
            return new Response(JSON.stringify(next), { status: 201 })
          }
        }

        // feed
        if (path === '/api/feed') {
          if (!init || init.method === 'GET') return new Response(JSON.stringify({ feed }), { status: 200 })
          if (init.method === 'POST') {
            const body = init.body ? JSON.parse(init.body.toString()) : {}
            const next = { id: Date.now(), ...body }
            feed.unshift(next)
            return new Response(JSON.stringify(next), { status: 201 })
          }
        }

        // dday simple echo
        if (path === '/api/dday') {
          const u = new URL(url, location.href)
          const enlist = u.searchParams.get('enlistmentDate') || ''
          const branch = u.searchParams.get('branch') || 'army'
          return new Response(JSON.stringify({ enlistmentDate: enlist, branch }), { status: 200 })
        }

        return originalFetch(input, init)
      } catch (e) {
        return originalFetch(input, init)
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return <>{children}</>
}
