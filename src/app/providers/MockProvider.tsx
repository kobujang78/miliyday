"use client"
import React, { useEffect } from 'react'

// Lightweight in-memory fetch mock for dev: intercepts /api/* calls without MSW
export default function MockProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const posts = [
      { id: 1, title: '훈련소에서 생존하는 법', body: '물 많이 챙기고, 양말 여분을 꼭 가져가세요. 발 관리가 정말 중요합니다.', category: '훈련소', likes: 24, comments: 8 },
      { id: 2, title: '자대 배치 후 첫 1주일', body: '선임들한테 인사 잘 하고, 질문 많이 하세요. 모르는 게 당연합니다.', category: '자대생활', likes: 18, comments: 5 },
      { id: 3, title: '군대에서 자격증 따기', body: 'MOS 맞는 자격증 위주로 준비하면 전역 후 도움됩니다. 한국사나 컴활 추천!', category: '자기계발', likes: 31, comments: 12 },
      { id: 4, title: '전역 3개월 전 체크리스트', body: '전역신고서, 건강검진, 취업 서류 등 미리 준비해야 할 것 정리.', category: '전역준비', likes: 42, comments: 15 },
    ]
    const market = [
      { id: 1, title: '군용 침낭 (상태 좋음)', price: 25000, status: 'selling', seller: '상병 김', desc: '6개월 사용, 겨울용 침낭입니다.' },
      { id: 2, title: '보조배터리 20000mAh', price: 15000, status: 'reserved', seller: '일병 이', desc: '거의 새것, 직거래 선호' },
      { id: 3, title: '운동화 260mm', price: 10000, status: 'sold', seller: '병장 박', desc: '나이키 운동화, 사이즈 안 맞아서 판매' },
    ]
    const feed = [
      { id: 1, owner: '상병 김철수', caption: '오늘 체력단련 완료! 3km 달리기 기록 단축 성공 💪', images: [], visibility: 'connections', time: '2시간 전', likes: 12, comments: 3 },
      { id: 2, owner: '일병 이민호', caption: '주말 외출 나와서 먹은 치킨.. 맛있다 🍗', images: [], visibility: 'public', time: '5시간 전', likes: 28, comments: 7 },
      { id: 3, owner: '이등병 박준영', caption: '자대 배치 첫날! 다들 잘 부탁드립니다 🫡', images: [], visibility: 'connections', time: '1일 전', likes: 45, comments: 11 },
    ]

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
            const next = { id: Date.now(), likes: 0, comments: 0, ...body }
            posts.unshift(next)
            return new Response(JSON.stringify(next), { status: 201 })
          }
        }
        if (path.startsWith('/api/posts/') && init?.method === 'DELETE') {
          const id = Number(path.split('/').pop())
          const idx = posts.findIndex(p => p.id === id)
          if (idx >= 0) posts.splice(idx, 1)
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

        // dday
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
