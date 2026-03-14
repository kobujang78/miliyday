"use client"
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import RankIcon, { RANKS, BRANCHES, SERVICE_MONTHS, type Branch, type RankLevel } from '@/components/RankIcon'
import { calcAutoRank, RANK_LABELS, getPromotionDates } from '@/lib/rankUtils'
import { getPoints, getMyInviteCode, getInviteStats } from '@/lib/pointUtils'
import { createClient } from '@/lib/supabase'

function formatDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function MyPage() {
  const router = useRouter()
  const { user, profile, signOut, updateProfile } = useAuth()

  const [showRankEdit, setShowRankEdit] = useState(false)
  const [showInfoEdit, setShowInfoEdit] = useState(false)
  const [myPoints, setMyPoints] = useState(0)
  const [myInviteCode, setMyInviteCode] = useState('')
  const [inviteCount, setInviteCount] = useState(0)
  const [codeCopied, setCodeCopied] = useState(false)

  // Editing state for profile
  const [editName, setEditName] = useState('')
  const [editBranch, setEditBranch] = useState<Branch>('army')
  const [editEnlistDate, setEditEnlistDate] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleSignOut = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await signOut()
      router.replace('/onboarding')
    }
  }

  const name = profile?.display_name || ''
  const nickname = profile?.nickname || ''
  const avatarUrl = profile?.avatar_url || ''
  const displayName = nickname || name
  const branch = (profile?.branch as Branch) || 'army'
  const enlistDate = profile?.enlist_date || ''
  const rank = (profile?.rank_level as RankLevel) || 1
  const nicknameUpdatedAt = profile?.nickname_updated_at || null

  // Initialize editing state when modal opens
  useEffect(() => {
    if (showInfoEdit) {
      setEditName(name)
      setEditBranch(branch)
      setEditEnlistDate(enlistDate)
      setEditNickname(nickname)
    }
  }, [showInfoEdit, name, branch, enlistDate, nickname])

  const canEditNickname = useMemo(() => {
    if (!nicknameUpdatedAt) return true
    const lastUpdate = new Date(nicknameUpdatedAt)
    const daysSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince >= 30
  }, [nicknameUpdatedAt])

  const daysUntilNicknameEdit = useMemo(() => {
    if (!nicknameUpdatedAt) return 0
    const lastUpdate = new Date(nicknameUpdatedAt)
    const nextAllowed = new Date(lastUpdate.getTime() + 30 * 24 * 60 * 60 * 1000)
    return Math.max(0, Math.ceil((nextAllowed.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  }, [nicknameUpdatedAt])

  const handleSaveInfo = async () => {
    const updates: Record<string, any> = {
      display_name: editName,
      branch: editBranch,
      enlist_date: editEnlistDate,
    }
    // 닉네임 변경 체크 (30일 제한)
    if (editNickname !== nickname) {
      if (!canEditNickname) {
        alert(`닉네임은 ${daysUntilNicknameEdit}일 후에 변경할 수 있습니다.`)
        return
      }
      updates.nickname = editNickname.trim() || editName
      updates.nickname_updated_at = new Date().toISOString()
    }
    updateProfile(updates)
    // Supabase에도 직접 저장
    if (user) {
      const supabase = createClient()
      await supabase.from('profiles').update(updates).eq('id', user.id)
      // refresh to get new data
      const { data } = await supabase.from('profiles').select('id, email, display_name, branch, rank_level, enlist_date, nickname, avatar_url, nickname_updated_at').eq('id', user.id).single()
      if (data) updateProfile(data)
    }
    setShowInfoEdit(false)
  }

  // 아바타 압축 + 업로드
  const compressAvatar = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = 64
          canvas.height = 64
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, 64, 64)
          resolve(canvas.toDataURL('image/webp', 0.7))
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      const compressed = await compressAvatar(file)
      const supabase = createClient()
      await supabase.from('profiles').update({ avatar_url: compressed }).eq('id', user.id)
      updateProfile({ avatar_url: compressed } as any)
      // Trigger re-fetch
      const { data } = await supabase.from('profiles').select('id, email, display_name, branch, rank_level, enlist_date, nickname, avatar_url, nickname_updated_at').eq('id', user.id).single()
      if (data) updateProfile(data)
    } catch {
      alert('사진 업로드에 실패했습니다.')
    }
  }

  // We'll load rankOverride from localStorage specifically since AuthProvider doesn't strictly type it yet
  const [rankOverride, setRankOverrideLocal] = useState<number | null>(null)

  useEffect(() => {
    try {
      const s = localStorage.getItem('mili_profile')
      if (s) {
        const p = JSON.parse(s)
        if (p.rankOverride !== undefined) setRankOverrideLocal(p.rankOverride)
      }
    } catch { }
  }, [])

  const handleRankOverride = (newRank: number | null) => {
    setRankOverrideLocal(newRank)
    updateProfile({ rankOverride: newRank })
  }

  // Auto-calculate rank
  const autoRank = useMemo(() => {
    return enlistDate ? calcAutoRank(enlistDate, branch) : rank
  }, [enlistDate, branch, rank])

  const activeRank = rankOverride ?? autoRank

  const currentRank = RANKS.find(r => r.value === activeRank)!
  const currentBranch = BRANCHES.find(b => b.value === branch)!
  const accentColor = { army: '#2d5016', navy: '#1a365d', airforce: '#4a1d96', marines: '#991b1b' }[branch]
  const promotionDates = useMemo(() => getPromotionDates(enlistDate, branch), [enlistDate, branch])

  // Fetch MiliPoint data
  useEffect(() => {
    if (!user) return
    const fetchPointData = async () => {
      const [pts, code, stats] = await Promise.all([
        getPoints(user.id),
        getMyInviteCode(user.id),
        getInviteStats(user.id),
      ])
      setMyPoints(pts)
      setMyInviteCode(code)
      setInviteCount(stats.count)
    }
    fetchPointData()
  }, [user])

  const handleCopyInviteCode = async () => {
    if (!myInviteCode) return
    try {
      await navigator.clipboard.writeText(myInviteCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      alert(myInviteCode)
    }
  }

  const handleShareInvite = async () => {
    const shareUrl = `https://miliyday.vercel.app/onboarding?invite=${myInviteCode}`
    const shareData = {
      title: '슬기로운 병영생활 초대',
      text: `슬기로운 병영생활 앱에 가입하면 2,000P 보너스! 초대코드: ${myInviteCode}`,
      url: shareUrl,
    }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareUrl}`)
      alert('초대 링크가 클립보드에 복사되었습니다!')
    }
  }

  const MENU_ITEMS = [
    { icon: '💰', label: '포인트 내역', desc: '적립/사용 내역 확인', href: '/points' },
    { icon: '📝', label: '내 작성글', desc: '내가 작성한 글 모아보기' },
    { icon: '❤️', label: '찜 목록', desc: '찜한 장터 아이템' },
    { icon: '🔔', label: '알림 설정', desc: '푸시 알림 관리' },
    { icon: '🛡️', label: '개인정보', desc: '개인정보 처리방침' },
    { icon: 'ℹ️', label: '앱 정보', desc: '슬기로운 병영생활 v0.1' },
  ]

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 프로필 카드 */}
      <div style={{
        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
        borderRadius: '20px', padding: '24px', color: '#fff',
        boxShadow: `0 8px 24px ${accentColor}40`,
        position: 'relative',
      }}>
        {/* 정보 수정 버튼 */}
        <button 
          onClick={() => setShowInfoEdit(true)}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            border: 'none', background: 'rgba(255,255,255,0.2)',
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff', fontSize: '14px',
          }}
        >
          ⚙️
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div
            onClick={() => avatarInputRef.current?.click()}
            style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', cursor: 'pointer',
              overflow: 'hidden', position: 'relative',
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <RankIcon level={activeRank as RankLevel} branch={branch} size={32} />
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.4)', fontSize: '8px',
              textAlign: 'center', padding: '1px', color: '#fff',
            }}>📷</div>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>
              {displayName || '이름을 입력하세요'}
            </div>
            {nickname && name && nickname !== name && (
              <div style={{ fontSize: '11px', opacity: 0.7 }}>{name}</div>
            )}
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>
              {currentBranch.label} · {currentRank.label}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{
            padding: '10px 12px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.15)',
          }}>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>입대일</div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
              {enlistDate || '미입력'}
            </div>
          </div>
          <div style={{
            padding: '10px 12px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.15)',
          }}>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>복무기간</div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
              {SERVICE_MONTHS[branch]}개월
            </div>
          </div>
        </div>
      </div>

      {/* ── 내 정보 수정 모달 ── */}
      {showInfoEdit && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '400px',
            padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>내 정보 수정</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px', display: 'block' }}>이름</label>
                <input 
                  type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  닉네임
                  {!canEditNickname && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>({daysUntilNicknameEdit}일 후 변경 가능)</span>}
                </label>
                <input 
                  type="text" value={editNickname}
                  onChange={e => canEditNickname && setEditNickname(e.target.value)}
                  disabled={!canEditNickname}
                  placeholder="닉네임을 입력하세요"
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0',
                    fontSize: '14px', outline: 'none',
                    opacity: canEditNickname ? 1 : 0.5,
                    background: canEditNickname ? '#fff' : '#f8fafc',
                  }}
                />
                <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>닉네임은 30일에 1번만 변경할 수 있습니다</div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px', display: 'block' }}>병종</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {BRANCHES.map(b => (
                    <button 
                      key={b.value}
                      onClick={() => setEditBranch(b.value as Branch)}
                      style={{
                        padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                        border: `2px solid ${editBranch === b.value ? accentColor : '#f1f5f9'}`,
                        background: editBranch === b.value ? `${accentColor}10` : '#fff',
                        color: editBranch === b.value ? accentColor : '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px', display: 'block' }}>입대일</label>
                <input 
                  type="date" value={editEnlistDate} onChange={e => setEditEnlistDate(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', colorScheme: 'light' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button 
                onClick={() => setShowInfoEdit(false)}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: '#f1f5f9', color: '#64748b', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                취소
              </button>
              <button 
                onClick={handleSaveInfo}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: accentColor, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 계급/복무기간 카드 ── */}
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>내 진급 상황</h3>
          <button onClick={() => setShowRankEdit(!showRankEdit)} style={{
            border: 'none', background: showRankEdit ? '#f1f5f9' : 'transparent',
            fontSize: '11px', color: '#6b7280', cursor: 'pointer',
            padding: '4px 8px', borderRadius: '8px',
          }}>
            {showRankEdit ? '닫기' : '✏️ 수동 조정'}
          </button>
        </div>

        {/* 현재 계급 표시 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
          padding: '12px', borderRadius: '12px',
          background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}05)`,
          border: `1px solid ${accentColor}15`,
        }}>
          <RankIcon level={activeRank as RankLevel} branch={branch} size={36} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: accentColor }}>
              {RANK_LABELS[activeRank as RankLevel]}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              {enlistDate && autoRank !== rankOverride && rankOverride != null
                ? `기본 진급: ${RANK_LABELS[autoRank as RankLevel]} → 수동 설정됨`
                : `${currentBranch.label} 기본 진급 기준`
              }
            </div>
          </div>
        </div>

        {/* 진급 일정 */}
        {promotionDates && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '12px' }}>
            {RANKS.map(r => {
              const dateKey = r.value === 1 ? 'private2' : r.value === 2 ? 'private1' : r.value === 3 ? 'corporal' : 'sergeant'
              const d = promotionDates[dateKey]
              const isCurrent = activeRank === r.value
              return (
                <div key={r.value} style={{
                  textAlign: 'center', padding: '8px 2px', borderRadius: '10px',
                  background: isCurrent ? `${accentColor}10` : '#f8fafc',
                  border: isCurrent ? `1.5px solid ${accentColor}30` : '1.5px solid transparent',
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: isCurrent ? accentColor : '#6b7280' }}>{r.label}</div>
                  <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>{formatDate(d)}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* 계급 수정 패널 */}
        {showRankEdit && (
          <div style={{
            padding: '12px', borderRadius: '12px', background: '#f8fafc',
            border: '1px dashed #d1d5db',
          }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
              조기진급/진급누락 시 수동으로 변경하세요
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {RANKS.map(r => {
                const isActive = activeRank === r.value
                return (
                  <button key={r.value} onClick={() => {
                    if (r.value === autoRank) {
                      handleRankOverride(null) // reset to auto
                    } else {
                      handleRankOverride(r.value)
                    }
                  }} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    padding: '8px 4px', border: `2px solid ${isActive ? accentColor : '#e5e7eb'}`,
                    borderRadius: '10px', cursor: 'pointer',
                    background: isActive ? `${accentColor}10` : '#fff', color: '#0f172a',
                  }}>
                    <RankIcon level={r.value as RankLevel} branch={branch} size={24} />
                    <span style={{ fontSize: '10px', fontWeight: 600 }}>{r.label}</span>
                  </button>
                )
              })}
            </div>
            {rankOverride != null && (
              <button onClick={() => handleRankOverride(null)} style={{
                marginTop: '8px', width: '100%', padding: '6px', border: 'none',
                background: 'transparent', fontSize: '11px', color: '#9ca3af',
                cursor: 'pointer',
              }}>기본 진급으로 되돌리기</button>
            )}
          </div>
        )}
      </div>

      {/* 밀포인트 & 초대 */}
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
          💰 밀포인트 & 초대
        </h3>

        {/* 포인트 잔액 */}
        <div style={{
          padding: '16px', borderRadius: '14px', marginBottom: '14px',
          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
          color: '#fff',
        }}>
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>내 밀포인트</div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {myPoints.toLocaleString()}P
          </div>
          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
            초대한 지인: {inviteCount}명
          </div>
        </div>

        {/* 내 초대코드 */}
        <div style={{
          padding: '14px', borderRadius: '12px', background: '#f8fafc',
          border: '1px solid #e2e8f0', marginBottom: '10px',
        }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>내 초대코드</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              flex: 1, fontSize: '20px', fontWeight: 800, color: accentColor,
              letterSpacing: '0.1em',
            }}>
              {myInviteCode || '로딩...'}
            </span>
            <button onClick={handleCopyInviteCode} style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: codeCopied ? '#10b981' : '#0f172a', color: '#fff',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              {codeCopied ? '✓ 복사됨' : '복사'}
            </button>
          </div>
        </div>

        {/* 초대 링크 공유 */}
        <button onClick={handleShareInvite} style={{
          width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}>
          <span>📨</span> 초대 링크 보내기 (가입시 양쪽 2,000P + 1,000P!)
        </button>
      </div>

      {/* 메뉴 리스트 */}
      <div style={{
        background: '#fff', borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        {MENU_ITEMS.map((item, idx) => (
          <div key={item.label} onClick={() => { if ('href' in item && item.href) router.push(item.href) }} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px', cursor: 'pointer',
            borderBottom: idx < MENU_ITEMS.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <span style={{ fontSize: '18px' }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{item.label}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.desc}</div>
            </div>
            <span style={{ fontSize: '14px', color: '#d1d5db' }}>›</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleSignOut}
        style={{
          marginTop: '8px',
          width: '100%',
          padding: '16px',
          borderRadius: '16px',
          border: 'none',
          background: '#fff',
          color: '#ef4444',
          fontSize: '15px',
          fontWeight: 700,
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <span>🚪</span> 로그아웃
      </button>
    </div>
  )
}
