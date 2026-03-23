"use client"
import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import RankIcon, { type Branch, type RankLevel } from '@/components/RankIcon'
import { calcAutoRank, RANK_LABELS } from '@/lib/rankUtils'
import {
  type FeedItem, loadFeed, addPost, toggleLike, isPostLiked, formatTimeAgo, deleteFeedPost, editFeedPost,
  loadFeedComments, addFeedComment
} from '@/lib/shareUtils'
import { earnContentReward } from '@/lib/pointUtils'

const VISIBILITY_MAP: Record<string, { label: string; icon: string }> = {
  public: { label: '전체공개', icon: '🌐' },
  connections: { label: '지인만', icon: '🔗' },
  private: { label: '나만보기', icon: '🔒' },
}

export default function SharePage() {
  const { profile, user } = useAuth()

  // Profile derived data
  const userName = profile?.nickname || profile?.display_name || '사용자'
  const userAvatar = profile?.avatar_url || ''
  const userBranch = (profile?.branch as Branch) || 'army'
  const enlistDate = profile?.enlist_date || ''
  const userRank = enlistDate ? calcAutoRank(enlistDate, userBranch) : ((profile?.rank_level as RankLevel) || 1)

  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'private'>('connections')
  const [images, setImages] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pointToast, setPointToast] = useState('')

  // Edit Mode state
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editingCaption, setEditingCaption] = useState('')

  // Comment input state
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const feedData = await loadFeed()
      setFeed(feedData)
      setLoading(false)
    }
    load()
  }, [])

  // --- Photo Upload Handling ---
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // Limit to 4 images to prevent overloaded payload 
    const filesArray = Array.from(files).slice(0, 4)
    
    try {
      const compressedImages = await Promise.all(
        filesArray.map(file => compressImage(file))
      )
      setImages(prev => [...prev, ...compressedImages].slice(0, 4))
    } catch {
      alert('이미지 처리 중 오류가 발생했습니다.')
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  // --- Post Submission ---
  const handleSubmit = async () => {
    if (!caption.trim() && images.length === 0) return
    if (!user) { alert('로그인이 필요합니다'); return }
    setIsSubmitting(true)

    const newPost = await addPost({
      userId: user.id,
      caption: caption.trim(),
      images: images,
      visibility: visibility,
    })

    if (newPost) {
      setFeed(prev => [newPost, ...prev])

      // 포인트 적립
      if (user?.id) {
        const result = await earnContentReward(user.id, 'feed_reward', newPost.id)
        if (result.earned) {
          setPointToast(`💰 ${result.points}P 적립! (오늘 ${result.remaining}회 남음)`)
          setTimeout(() => setPointToast(''), 3000)
        }
      }
    }

    // Reset and close
    setCaption('')
    setImages([])
    setVisibility('connections')
    setShowModal(false)
    setIsSubmitting(false)
  }

  // --- External Sharing ---
  const handleShare = async (post: FeedItem) => {
    const shareData = {
      title: `${post.ownerName}님의 슬기로운 병영생활`,
      text: post.caption,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`)
        alert('링크가 클립보드에 복사되었습니다. 카카오톡 등에 붙여넣기 해보세요!')
      }
    } catch (err) {
      console.log('공유 취소 또는 오류:', err)
    }
  }

  // --- Like Toggle ---
  const handleLike = async (id: string) => {
    if (!user) return
    const result = await toggleLike(id, user.id)
    setFeed(prev => prev.map(p => p.id === id ? { ...p, likes: result.newCount } : p))
  }

  // --- Comment Handling ---
  const handleToggleComments = async (post: FeedItem) => {
    // If closing
    if (post.showComments) {
      setFeed(prev => prev.map(p => p.id === post.id ? { ...p, showComments: false } : p))
      return
    }

    // If opening, load comments
    const commentsList = await loadFeedComments(post.id)
    setFeed(prev => prev.map(p => p.id === post.id ? { ...p, showComments: true, commentsList } : p))
  }

  const handleAddComment = async (post: FeedItem) => {
    if (!user) { alert('로그인이 필요합니다.'); return }
    const text = commentInputs[post.id]?.trim()
    if (!text) return

    const newComment = await addFeedComment(post.id, user.id, text)
    if (newComment) {
      setFeed(prev => prev.map(p => {
        if (p.id === post.id) {
          return {
            ...p,
            comments: p.comments + 1,
            commentsList: [...(p.commentsList || []), newComment]
          }
        }
        return p
      }))
      setCommentInputs(prev => ({ ...prev, [post.id]: '' }))
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>📸</span> 생활공유
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>불러오는 중...</div>
      ) : feed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '16px', color: '#9ca3af', fontSize: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📷</div>
          <div style={{ fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>아직 첫 소식이 없네요!</div>
          <div style={{ fontSize: '12px' }}>오른쪽 아래 ➕ 버튼을 눌러 사진을 올려보세요.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feed.map(f => {
            const vis = VISIBILITY_MAP[f.visibility] || VISIBILITY_MAP.connections
            const isOwner = user?.id === f.ownerId
            const isAdmin = profile?.nickname === '관리자' || profile?.display_name === '관리자'
            
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
                      background: '#f8fafc', border: '1px solid #f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {f.ownerAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.ownerAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <RankIcon level={f.ownerRank as RankLevel} branch={f.ownerBranch as Branch} size={22} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        {f.ownerNickname || f.ownerName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {formatTimeAgo(f.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, padding: '4px 8px',
                      borderRadius: '8px', background: '#f8fafc', color: '#64748b',
                      border: '1px solid #f1f5f9'
                    }}>
                      {vis.icon} {vis.label}
                    </span>
                    {(isOwner || isAdmin) && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {isOwner && (
                          <button onClick={() => {
                            setEditingPostId(f.id)
                            setEditingCaption(f.caption)
                          }} style={{
                            border: '1px solid #e2e8f0', background: '#fff', fontSize: '11px',
                            color: '#64748b', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px'
                          }}>수정</button>
                        )}
                        <button onClick={async () => {
                          if (!confirm('정말 이 게시물을 삭제하시겠습니까?')) return
                          const success = await deleteFeedPost(f.id)
                          if (success) setFeed(prev => prev.filter(p => p.id !== f.id))
                        }} style={{
                          border: 'none', background: '#fee2e2', fontSize: '11px',
                          color: '#ef4444', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px'
                        }}>삭제</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content Text (if present) */}
                {editingPostId === f.id ? (
                  <div style={{ padding: '4px 16px 12px' }}>
                    <textarea 
                      value={editingCaption} 
                      onChange={(e) => setEditingCaption(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', resize: 'vertical', minHeight: '60px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => setEditingPostId(null)} style={{ padding: '6px 12px', border: 'none', background: '#f1f5f9', color: '#64748b', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>취소</button>
                      <button onClick={async () => {
                        const success = await editFeedPost(f.id, editingCaption)
                        if (success) {
                          setFeed(prev => prev.map(p => p.id === f.id ? { ...p, caption: editingCaption } : p))
                          setEditingPostId(null)
                        } else {
                          alert('수정 중 오류가 발생했습니다.')
                        }
                      }} style={{ padding: '6px 12px', border: 'none', background: '#10b981', color: '#fff', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>저장</button>
                    </div>
                  </div>
                ) : f.caption && (
                  <div style={{ padding: '4px 16px 12px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {f.caption}
                    </p>
                  </div>
                )}

                {/* Images (Horizontal Scroll) */}
                {f.images && f.images.length > 0 && (
                  <div style={{
                    display: 'flex', overflowX: 'auto', gap: '2px', paddingBottom: '2px',
                    scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                  }}>
                    {f.images.map((img, idx) => (
                      <div key={idx} style={{
                        width: f.images.length === 1 ? '100%' : '85%',
                        flexShrink: 0, scrollSnapAlign: 'center',
                        aspectRatio: '4/3', background: '#f8fafc',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}

                {f.images && f.images.length > 1 && (
                  <div style={{ textAlign: 'center', fontSize: '10px', color: '#cbd5e1', marginTop: '4px' }}>
                    ← 옆으로 밀어서 사진 더 보기 →
                  </div>
                )}

                {/* Footer Actions */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <button onClick={() => handleLike(f.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none',
                    fontSize: '13px', color: (user && isPostLiked(f.id, user.id)) ? '#ef4444' : '#64748b', fontWeight: 600, cursor: 'pointer', padding: 0
                  }}>
                    {(user && isPostLiked(f.id, user.id)) ? '❤️' : '🤍'} 좋아요 {f.likes > 0 && f.likes}
                  </button>
                  <button onClick={() => handleToggleComments(f)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none',
                    fontSize: '13px', color: '#64748b', fontWeight: 600, cursor: 'pointer', padding: 0
                  }}>
                    💬 댓글 {f.comments > 0 && f.comments}
                  </button>
                  <button onClick={() => handleShare(f)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none',
                    fontSize: '13px', color: '#64748b', fontWeight: 600, cursor: 'pointer', padding: 0, marginLeft: 'auto'
                  }}>
                    📤 공유
                  </button>
                </div>

                {/* Comments Section */}
                {f.showComments && (
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
                    {f.commentsList?.map(c => (
                      <div key={c.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                          background: c.userAvatar ? `url(${c.userAvatar}) center/cover` : '#e2e8f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {!c.userAvatar && <RankIcon level={c.userRank as RankLevel} branch={c.userBranch as Branch} size={14} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                              {c.userName}
                            </span>
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>{formatTimeAgo(c.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>{c.body}</div>
                        </div>
                      </div>
                    ))}
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <input 
                        type="text" placeholder="생활공유 글에 댓글을 남겨보세요..." 
                        value={commentInputs[f.id] || ''}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [f.id]: e.target.value }))}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleAddComment(f) }}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: '16px', border: '1px solid #e2e8f0',
                          fontSize: '13px', outline: 'none'
                        }}
                      />
                      <button onClick={() => handleAddComment(f)} style={{
                        padding: '6px 14px', borderRadius: '16px', border: 'none',
                        background: '#10b981', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                      }}>등록</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Floating Action Button */}
      {!showModal && (
        <button onClick={() => setShowModal(true)} style={{
          position: 'fixed', bottom: '80px', right: '20px', zIndex: 40,
          width: '56px', height: '56px', borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff', fontSize: '24px', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
        }}>➕</button>
      )}

      {/* --- Write Post Modal --- */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
          background: '#fff', display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.3s ease-out',
        }}>
          {/* Modal Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderBottom: '1px solid #f1f5f9'
          }}>
            <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#0f172a', fontWeight: 700, padding: 0 }}>✕</button>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>글 쓰기</h3>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (!caption.trim() && images.length === 0)}
              style={{
                border: 'none', background: isSubmitting || (!caption.trim() && images.length === 0) ? '#e2e8f0' : '#10b981',
                color: '#fff', fontSize: '14px', fontWeight: 700, padding: '6px 14px', borderRadius: '16px',
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? '게시 중...' : '게시'}
            </button>
          </div>

          {/* User Info & Visibility */}
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: '#f8fafc', border: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RankIcon level={userRank as RankLevel} branch={userBranch as Branch} size={22} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {RANK_LABELS[userRank as RankLevel]} {userName}
              </div>
            </div>

            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value as any)}
              style={{
                padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                background: '#f8fafc', fontSize: '12px', fontWeight: 600, color: '#475569',
                outline: 'none'
              }}
            >
              <option value="public">🌐 전체공개</option>
              <option value="connections">🔗 지인만</option>
              <option value="private">🔒 나만보기</option>
            </select>
          </div>

          {/* Text Area */}
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="무슨 일이 일어나고 있나요? 전우들이나 가족, 지인들에게 근황을 전해보세요."
            style={{
              flex: 1, border: 'none', padding: '0 16px', fontSize: '16px', lineHeight: 1.5,
              color: '#0f172a', resize: 'none', outline: 'none'
            }}
          />

          {/* Image Previews */}
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', padding: '16px', overflowX: 'auto', borderTop: '1px solid #f8fafc' }}>
              {images.map((img, idx) => (
                <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => removeImage(idx)}
                    style={{
                      position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px',
                      borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff',
                      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', cursor: 'pointer'
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar Setup */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px',
            background: '#f8fafc'
          }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', fontSize: '14px', color: '#10b981', fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              <span style={{ fontSize: '20px' }}>📸</span> 사진 첨부
            </button>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}} />

      {/* 포인트 토스트 */}
      {pointToast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '12px',
          fontSize: '13px', fontWeight: 700, zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {pointToast}
        </div>
      )}
    </div>
  )
}
