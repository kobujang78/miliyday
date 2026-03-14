"use client"
import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { earnContentReward } from '@/lib/pointUtils'

interface Post { id: string; title: string; body: string; category?: string; likes?: number; comments_count?: number }

const CATEGORIES = ['전체', '훈련소', '자대생활', '자기계발', '전역준비']

const categoryColors: Record<string, string> = {
  '훈련소': '#ef4444',
  '자대생활': '#0b6efd',
  '자기계발': '#8b5cf6',
  '전역준비': '#10b981',
  '일반': '#6b7280',
}

export default function TipsPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('전체')
  const [pointToast, setPointToast] = useState('')

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) setPosts(data)
      setLoading(false)
    }
    fetchPosts()
  }, [])

  const filtered = activeCategory === '전체' ? posts : posts.filter(p => p.category === activeCategory)

  const handleCreatePost = async () => {
    const title = prompt('제목')
    const body = prompt('내용')
    const category = prompt('카테고리 (훈련소/자대생활/자기계발/전역준비)') || '일반'
    if (!title || !body) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user?.id || null,
        title,
        body,
        category,
        likes: 0,
        comments_count: 0,
      })
      .select()
      .single()

    if (!error && data) {
      setPosts(prev => [data, ...prev])

      // 포인트 적립
      if (user?.id) {
        const result = await earnContentReward(user.id, 'post_reward', data.id)
        if (result.earned) {
          setPointToast(`💰 ${result.points}P 적립! (오늘 ${result.remaining}회 남음)`)
          setTimeout(() => setPointToast(''), 3000)
        }
      }
    }
  }

  const handleDeletePost = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)

    if (!error) {
      setPosts(prev => prev.filter(x => x.id !== id))
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>병영꿀팁</h2>
        <button onClick={handleCreatePost} style={{
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
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>💬 {p.comments_count ?? 0}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <button onClick={() => handleDeletePost(p.id)} style={{
                    border: 'none', background: 'none', fontSize: '11px',
                    color: '#ef4444', cursor: 'pointer', padding: '4px 8px',
                  }}>삭제</button>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 포인트 토스트 */}
      {pointToast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '12px',
          fontSize: '13px', fontWeight: 700, zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          animation: 'fadeIn 0.3s ease',
        }}>
          {pointToast}
        </div>
      )}
    </div>
  )
}
