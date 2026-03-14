"use client"
import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import RankIcon, { type Branch, type RankLevel } from '@/components/RankIcon'
import { calcAutoRank, RANK_LABELS } from '@/lib/rankUtils'
import {
  type FeedItem, loadFeed, addPost, toggleLike, formatTimeAgo
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
  const userName = profile?.display_name || '사용자'
  const userBranch = (profile?.branch as Branch) || 'army'
  const enlistDate = profile?.enlist_date || ''
  const userRank = enlistDate ? calcAutoRank(enlistDate, userBranch) : ((profile?.rank_level as RankLevel) || 1)

  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'private'>('connections')
  const [images, setImages] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pointToast, setPointToast] = useState('')

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
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // Convert files to Base64
    const newImages: string[] = []
    let processed = 0

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          newImages.push(event.target.result as string)
        }
        processed++
        if (processed === files.length) {
          setImages(prev => [...prev, ...newImages])
        }
      }
      reader.readAsDataURL(file)
    })

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
    const success = await toggleLike(id)
    if (success) {
      setFeed(prev => prev.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p))
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📸</span> 생활공유
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
                    }}>
                      <RankIcon level={f.ownerRank as RankLevel} branch={f.ownerBranch as Branch} size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        {RANK_LABELS[f.ownerRank as RankLevel]} {f.ownerName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {formatTimeAgo(f.createdAt)}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '4px 8px',
                    borderRadius: '8px', background: '#f8fafc', color: '#64748b',
                    border: '1px solid #f1f5f9'
                  }}>
                    {vis.icon} {vis.label}
                  </span>
                </div>

                {/* Content Text (if present) */}
                {f.caption && (
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
                    fontSize: '13px', color: f.likes > 0 ? '#ef4444' : '#64748b', fontWeight: 600, cursor: 'pointer', padding: 0
                  }}>
                    {f.likes > 0 ? '❤️' : '🤍'} 좋아요 {f.likes > 0 && f.likes}
                  </button>
                  <button style={{
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
