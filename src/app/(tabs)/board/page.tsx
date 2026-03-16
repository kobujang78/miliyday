"use client"
import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { earnContentReward } from '@/lib/pointUtils'
import RankIcon, { type Branch, type RankLevel } from '@/components/RankIcon'

interface Comment {
  id: string
  user_id: string
  body: string
  created_at: string
  profiles?: any
}

interface Post { 
  id: string
  title: string
  body: string
  category: string
  image_url?: string
  likes_count: number
  comments_count: number
  created_at: string
  user_id: string
  board_type: string
  profiles?: any
  isLiked?: boolean
  isBookmarked?: boolean
  showComments?: boolean
  commentsList?: Comment[]
}

const CATEGORIES = ['전체', '공지사항', '자유', '질문', '꿀팁', '군사특기', '고민상담']

const categoryColors: Record<string, string> = {
  '공지사항': '#ef4444',
  '자유': '#3b82f6',
  '질문': '#10b981',
  '꿀팁': '#f59e0b',
  '군사특기': '#8b5cf6',
  '고민상담': '#ef4444',
}

export default function MilitaryBoardPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('전체')
  const [pointToast, setPointToast] = useState('')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newCategory, setNewCategory] = useState('자유')
  const [newImage, setNewImage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Comment Input State
  const [commentInput, setCommentInput] = useState<{ [key: string]: string }>({})

  const fetchPosts = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*, profiles:user_id(nickname, display_name, avatar_url, rank_level, branch)')
      .eq('board_type', 'military_board')
      .order('created_at', { ascending: false })

    if (!error && postsData) {
      let likesData: any[] = []
      let bookmarksData: any[] = []
      
      if (user?.id) {
        const [{ data: l }, { data: b }] = await Promise.all([
          supabase.from('post_likes').select('post_id').eq('user_id', user.id),
          supabase.from('post_bookmarks').select('post_id').eq('user_id', user.id)
        ])
        if (l) likesData = l
        if (b) bookmarksData = b
      }

      const likeSet = new Set(likesData.map(l => l.post_id))
      const bookmarkSet = new Set(bookmarksData.map(b => b.post_id))

      const finalPosts = postsData.map(p => ({
        ...p,
        isLiked: likeSet.has(p.id),
        isBookmarked: bookmarkSet.has(p.id),
        showComments: false,
        commentsList: []
      }))
      setPosts(finalPosts)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts()
  }, [user])

  const filtered = activeCategory === '전체' ? posts : posts.filter(p => p.category === activeCategory)

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const MAX_WIDTH = 800
          let w = img.width
          let h = img.height
          if (w > MAX_WIDTH) {
            h = Math.floor((h * MAX_WIDTH) / w)
            w = MAX_WIDTH
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/webp', 0.8))
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await compressImage(file)
      setNewImage(base64)
    } catch {
      alert('이미지 처리 중 오류가 발생했습니다.')
    }
  }

  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newBody.trim()) { alert('제목과 내용을 입력해주세요.'); return }
    if (!user) { alert('로그인이 필요합니다.'); return }
    
    setIsSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title: newTitle,
        body: newBody,
        category: newCategory,
        image_url: newImage || null,
        board_type: 'military_board',
        likes_count: 0,
        comments_count: 0,
      })
      .select('*, profiles:user_id(nickname, display_name, avatar_url, rank_level, branch)')
      .single()

    if (!error && data) {
      setPosts(prev => [{ ...data, isLiked: false, isBookmarked: false, showComments: false, commentsList: [] }, ...prev])
      const result = await earnContentReward(user.id, 'post_reward', data.id)
      if (result.earned) {
        setPointToast(`💰 ${result.points}P 적립! (오늘 ${result.remaining}회 남음)`)
        setTimeout(() => setPointToast(''), 3000)
      }
    }
    setNewTitle(''); setNewBody(''); setNewImage(''); setNewCategory(activeCategory === '전체' ? '자유' : activeCategory)
    setShowModal(false)
    setIsSubmitting(false)
  }

  const toggleLike = async (post: Post) => {
    if (!user) return
    const isLiked = post.isLiked
    const newLikes = isLiked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1
    
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isLiked: !isLiked, likes_count: newLikes } : p))
    
    const supabase = createClient()
    if (isLiked) {
      await supabase.from('post_likes').delete().match({ post_id: post.id, user_id: user.id })
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
    }
    await supabase.from('posts').update({ likes_count: newLikes }).eq('id', post.id)
  }

  const toggleBookmark = async (post: Post) => {
    if (!user) return
    const isBookmarked = post.isBookmarked
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isBookmarked: !isBookmarked } : p))
    
    const supabase = createClient()
    if (isBookmarked) {
      await supabase.from('post_bookmarks').delete().match({ post_id: post.id, user_id: user.id })
    } else {
      await supabase.from('post_bookmarks').insert({ post_id: post.id, user_id: user.id })
    }
  }

  const handleDeletePost = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const supabase = createClient()
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (!error) {
      setPosts(prev => prev.filter(x => x.id !== id))
    }
  }

  const handleShare = async (post: Post) => {
    const shareData = {
      title: post.title,
      text: post.body,
      url: window.location.href, // Or generate a specific URL if router paths are supported
    }
    if (navigator.share) {
      await navigator.share(shareData).catch(console.error)
    } else {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.url}`)
      alert('링크가 복사되었습니다.')
    }
  }

  const toggleComments = async (post: Post) => {
    const isShowing = post.showComments
    if (!isShowing) {
      const supabase = createClient()
      const { data } = await supabase
        .from('comments')
        .select('*, profiles:user_id(nickname, display_name, avatar_url, rank_level, branch)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
      
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, showComments: true, commentsList: data || [] } : p))
    } else {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, showComments: false } : p))
    }
  }

  const submitComment = async (post: Post) => {
    if (!user) { alert('로그인이 필요합니다.'); return }
    const txt = commentInput[post.id]?.trim()
    if (!txt) return

    const supabase = createClient()
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: user.id, body: txt })
      .select('*, profiles:user_id(nickname, display_name, avatar_url, rank_level, branch)')
      .single()

    if (data) {
      const newCount = post.comments_count + 1
      setPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          return {
            ...p,
            comments_count: newCount,
            commentsList: [...(p.commentsList || []), data]
          }
        }
        return p
      }))
      setCommentInput(prev => ({ ...prev, [post.id]: '' }))
      await supabase.from('posts').update({ comments_count: newCount }).eq('id', post.id)
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${Math.max(1, mins)}분 전`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>👥 커뮤니티</h2>
        <button onClick={() => {
          setNewCategory(activeCategory === '전체' ? '자유' : activeCategory);
          setShowModal(true);
        }} style={{
          padding: '8px 16px', borderRadius: '20px', border: 'none',
          background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', color: '#fff',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
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
            whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0
          }}>{cat}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
          아직 작성된 게시글이 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map(p => {
            const authorName = p.profiles?.nickname || p.profiles?.display_name || '익명'
            return (
              <article key={p.id} style={{
                background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden'
              }}>
                {/* 헤더 */}
                <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: p.profiles?.avatar_url ? `url(${p.profiles.avatar_url}) center/cover` : '#e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {!p.profiles?.avatar_url && <RankIcon level={p.profiles?.rank_level || 1} branch={p.profiles?.branch || 'army'} size={20} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{authorName}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{formatTimeAgo(p.created_at)}</div>
                  </div>
                  {p.category && (
                    <span style={{
                      marginLeft: 'auto', fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '8px',
                      background: `${categoryColors[p.category] || '#6b7280'}15`,
                      color: categoryColors[p.category] || '#6b7280',
                    }}>{p.category}</span>
                  )}
                  {(user?.id === p.user_id || user?.user_metadata?.nickname === '관리자' || user?.user_metadata?.display_name === '관리자' || p.profiles?.nickname === '관리자') && (
                    <button onClick={() => handleDeletePost(p.id)} style={{
                      marginLeft: '8px', border: 'none', background: 'none', fontSize: '11px',
                      color: '#ef4444', cursor: 'pointer', padding: '4px'
                    }}>삭제</button>
                  )}
                </div>

                {/* 본문 */}
                <div style={{ padding: '4px 16px 12px' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{p.title}</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.body}</p>
                </div>

                {/* 첨부 이미지 (가장 아래 배치) */}
                {p.image_url && (
                  <div style={{ width: '100%', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                    <img src={p.image_url} alt="첨부" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }} />
                  </div>
                )}

                {/* 액션 바: 왼쪽 그룹(좋아요, 찜, 댓글) / 오른쪽 그룹(공유) */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => toggleLike(p)} style={{
                      border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      color: p.isLiked ? '#ef4444' : '#64748b', fontSize: '13px', fontWeight: 600, padding: 0
                    }}>
                      <span>{p.isLiked ? '❤️' : '🤍'}</span> {p.likes_count}
                    </button>
                    <button onClick={() => toggleBookmark(p)} style={{
                      border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      color: p.isBookmarked ? '#8b5cf6' : '#64748b', fontSize: '13px', fontWeight: 600, padding: 0
                    }}>
                      <span>{p.isBookmarked ? '🔖' : '📑'}</span>
                    </button>
                    <button onClick={() => toggleComments(p)} style={{
                      border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      color: '#64748b', fontSize: '13px', fontWeight: 600, padding: 0
                    }}>
                      <span>💬</span> {p.comments_count}
                    </button>
                  </div>
                  <button onClick={() => handleShare(p)} style={{
                    border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                    color: '#64748b', fontSize: '13px', fontWeight: 600, padding: 0
                  }}>
                    🔗 공유
                  </button>
                </div>

                {/* 댓글 영역 */}
                {p.showComments && (
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
                    {p.commentsList?.map(c => (
                      <div key={c.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                          background: c.profiles?.avatar_url ? `url(${c.profiles.avatar_url}) center/cover` : '#e2e8f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {!c.profiles?.avatar_url && <RankIcon level={c.profiles?.rank_level || 1} branch={c.profiles?.branch || 'army'} size={14} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                              {c.profiles?.nickname || c.profiles?.display_name || '사용자'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>{formatTimeAgo(c.created_at)}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>{c.body}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <input 
                        type="text" placeholder="댓글을 남겨보세요..." 
                        value={commentInput[p.id] || ''}
                        onChange={(e) => setCommentInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={(e) => { if(e.key === 'Enter') submitComment(p) }}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: '16px', border: '1px solid #e2e8f0',
                          fontSize: '13px', outline: 'none'
                        }}
                      />
                      <button onClick={() => submitComment(p)} style={{
                        padding: '6px 14px', borderRadius: '16px', border: 'none',
                        background: '#0f172a', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                      }}>등록</button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* 작성 모달 */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '24px',
            padding: '24px', paddingBottom: '32px'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800 }}>새 게시물 작성</h3>
            
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{
              width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0',
              marginBottom: '12px', fontSize: '14px', outline: 'none', background: '#fafbff'
            }}>
              {CATEGORIES.filter(c => c !== '전체').map(c => {
                 // 공지사항은 관리자만 선택 가능하도록 처리
                 if (c === '공지사항') {
                   const isAuthAdmin = user?.user_metadata?.nickname === '관리자' || user?.user_metadata?.display_name === '관리자';
                   if (!isAuthAdmin) return null;
                 }
                 return <option key={c} value={c}>{c}</option>
              })}
            </select>

            <input 
              type="text" placeholder="제목을 입력하세요" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0',
                marginBottom: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }}
            />
            
            <textarea 
              placeholder="내용을 자세히 작성해주세요" value={newBody} onChange={e => setNewBody(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0',
                marginBottom: '12px', fontSize: '14px', height: '100px', resize: 'none', outline: 'none', boxSizing: 'border-box'
              }}
            />

            {newImage ? (
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <img src={newImage} alt="Preview" style={{ width: '100%', borderRadius: '12px', maxHeight: '160px', objectFit: 'cover' }} />
                <button onClick={() => setNewImage('')} style={{
                  position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)',
                  color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer'
                }}>X</button>
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <input type="file" accept="image/*" id="hidden-file-input" style={{ display: 'none' }} onChange={handleImageChange} ref={fileInputRef} />
                <button onClick={() => fileInputRef.current?.click()} style={{
                  width: '100%', padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1',
                  background: '#f8fafc', color: '#64748b', fontSize: '13px', cursor: 'pointer'
                }}>📸 사진 첨부 (선택)</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={isSubmitting} onClick={() => setShowModal(false)} style={{
                flex: 1, padding: '14px', border: 'none', borderRadius: '12px',
                background: '#f1f5f9', color: '#64748b', fontWeight: 600, cursor: 'pointer'
              }}>취소</button>
              <button disabled={isSubmitting} onClick={handleCreatePost} style={{
                flex: 1, padding: '14px', border: 'none', borderRadius: '12px',
                background: '#0f172a', color: '#fff', fontWeight: 600, cursor: 'pointer'
              }}>{isSubmitting ? '업로드...' : '등록하기'}</button>
            </div>
          </div>
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
