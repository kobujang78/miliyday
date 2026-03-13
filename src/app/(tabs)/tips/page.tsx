"use client"
import React, { useEffect, useState } from 'react'

interface Post { id: number; title: string; body: string; category?: string; likes?: number; comments?: number }

const CATEGORIES = ['전체', '훈련소', '자대생활', '자기계발', '전역준비']

const categoryColors: Record<string, string> = {
  '훈련소': '#ef4444',
  '자대생활': '#0b6efd',
  '자기계발': '#8b5cf6',
  '전역준비': '#10b981',
  '일반': '#6b7280',
}

export default function TipsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('전체')

  useEffect(() => {
    setLoading(true)
    fetch('/api/posts')
      .then(r => r.json())
      .then(data => setPosts(data.posts || []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const filtered = activeCategory === '전체' ? posts : posts.filter(p => p.category === activeCategory)

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>병영꿀팁</h2>
        <button onClick={async () => {
          const title = prompt('제목')
          const body = prompt('내용')
          const category = prompt('카테고리 (훈련소/자대생활/자기계발/전역준비)') || '일반'
          if (!title || !body) return
          const res = await fetch('/api/posts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, category, likes: 0, comments: 0 })
          })
          const j = await res.json()
          setPosts(prev => [j, ...prev])
        }} style={{
          padding: '8px 16px', borderRadius: '20px', border: 'none',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
        }}>✏️ 글쓰기</button>
      </div>

      {/* 카테고리 필터 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{
            padding: '6px 14px', borderRadius: '16px', border: 'none',
            background: activeCategory === cat ? '#0f172a' : '#f1f5f9',
            color: activeCategory === cat ? '#fff' : '#64748b',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.2s',
          }}>{cat}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
          아직 작성된 글이 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(p => (
            <article key={p.id} style={{
              padding: '16px', background: '#fff', borderRadius: '16px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {p.category && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '8px',
                    background: `${categoryColors[p.category] || '#6b7280'}15`,
                    color: categoryColors[p.category] || '#6b7280',
                  }}>{p.category}</span>
                )}
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{p.title}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{p.body}</p>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px',
                paddingTop: '10px', borderTop: '1px solid #f1f5f9',
              }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>❤️ {p.likes ?? 0}</span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>💬 {p.comments ?? 0}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <button onClick={async () => {
                    await fetch(`/api/posts/${p.id}`, { method: 'DELETE' })
                    setPosts(prev => prev.filter(x => x.id !== p.id))
                  }} style={{
                    border: 'none', background: 'none', fontSize: '11px',
                    color: '#ef4444', cursor: 'pointer', padding: '4px 8px',
                  }}>삭제</button>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
