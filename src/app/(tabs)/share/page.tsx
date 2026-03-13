"use client"
import React, { useEffect, useState } from 'react'

interface FeedItem { id: number; owner: string; caption: string; visibility: string; time?: string; likes?: number; comments?: number }

const VISIBILITY_MAP: Record<string, { label: string; icon: string }> = {
  public: { label: '전체공개', icon: '🌐' },
  connections: { label: '지인만', icon: '🔗' },
  private: { label: '나만보기', icon: '🔒' },
}

export default function SharePage() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/feed')
      .then(r => r.json())
      .then(data => setFeed(data.feed || []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>생활공유</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>불러오는 중...</div>
      ) : feed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
          아직 공유된 피드가 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {feed.map(f => {
            const vis = VISIBILITY_MAP[f.visibility] || VISIBILITY_MAP.connections
            return (
              <div key={f.id} style={{
                background: '#fff', borderRadius: '16px', overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px',
                    }}>👤</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{f.owner}</div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>{f.time || '방금 전'}</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '3px 8px',
                    borderRadius: '8px', background: '#f1f5f9', color: '#64748b',
                  }}>{vis.icon} {vis.label}</span>
                </div>

                {/* Image placeholder */}
                <div style={{
                  width: '100%', height: '180px',
                  background: 'linear-gradient(135deg, #f0f4ff, #e0e7ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#a5b4fc', fontSize: '32px',
                }}>📷</div>

                {/* Content */}
                <div style={{ padding: '12px 16px 14px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>{f.caption}</p>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    paddingTop: '10px', borderTop: '1px solid #f1f5f9',
                  }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }}>❤️ {f.likes ?? 0}</span>
                    <span style={{ fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }}>💬 {f.comments ?? 0}</span>
                    <span style={{ fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }}>📤 공유</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 플로팅 작성 버튼 */}
      <button onClick={async () => {
        const caption = prompt('내용을 입력하세요') || ''
        const visibility = prompt('공개 범위 (public/connections/private)') || 'connections'
        if (!caption) return
        const res = await fetch('/api/feed', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner: '나', caption, visibility, images: [], time: '방금 전', likes: 0, comments: 0 })
        })
        const j = await res.json()
        setFeed(prev => [j, ...prev])
      }} style={{
        position: 'fixed', bottom: '80px', right: '20px', zIndex: 40,
        width: '52px', height: '52px', borderRadius: '50%', border: 'none',
        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
        color: '#fff', fontSize: '20px', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>📷</button>
    </div>
  )
}
