"use client"
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import RankIcon, { RANKS, BRANCHES, SERVICE_MONTHS, type Branch, type RankLevel } from '@/components/RankIcon'
import { calcAutoRank, RANK_LABELS, getPromotionDates } from '@/lib/rankUtils'

function formatDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function MyPage() {
  const router = useRouter()
  const { profile, signOut, updateProfile } = useAuth()

  const [showRankEdit, setShowRankEdit] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')

  const handleSignOut = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await signOut()
      router.replace('/onboarding')
    }
  }

  const name = profile?.display_name || ''
  const branch = (profile?.branch as Branch) || 'army'
  const enlistDate = profile?.enlist_date || ''
  const rank = (profile?.rank_level as RankLevel) || 1

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

  const generateInviteCode = () => {
    const code = `MILI-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    setGeneratedCode(code)
  }

  const MENU_ITEMS = [
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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <RankIcon level={activeRank as RankLevel} branch={branch} size={32} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>
              {name || '이름을 입력하세요'}
            </div>
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

      {/* ── 계급/복무기간 카드 (홈 화면에서 이동됨) ── */}
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>내 계급</h3>
          <button onClick={() => setShowRankEdit(!showRankEdit)} style={{
            border: 'none', background: showRankEdit ? '#f1f5f9' : 'transparent',
            fontSize: '11px', color: '#6b7280', cursor: 'pointer',
            padding: '4px 8px', borderRadius: '8px',
          }}>
            {showRankEdit ? '닫기' : '✏️ 수정'}
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

      {/* 초대코드 */}
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
          🔗 지인 연결
        </h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text" placeholder="초대코드 입력" value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', border: '1.5px solid #e5e7eb',
              borderRadius: '10px', fontSize: '13px', outline: 'none',
            }}
          />
          <button style={{
            padding: '8px 14px', borderRadius: '10px', border: 'none',
            background: '#0f172a', color: '#fff', fontSize: '12px',
            fontWeight: 700, cursor: 'pointer',
          }}>연결</button>
        </div>
        <button onClick={generateInviteCode} style={{
          width: '100%', padding: '10px', borderRadius: '10px',
          border: '1.5px dashed #d1d5db', background: '#fafbff',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#6b7280',
        }}>
          초대코드 생성하기
        </button>
        {generatedCode && (
          <div style={{
            marginTop: '10px', padding: '10px 14px', borderRadius: '10px',
            background: '#f0f4ff', textAlign: 'center',
            fontSize: '16px', fontWeight: 800, color: accentColor,
            letterSpacing: '0.1em',
          }}>
            {generatedCode}
          </div>
        )}
      </div>

      {/* 메뉴 리스트 */}
      <div style={{
        background: '#fff', borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        {MENU_ITEMS.map((item, idx) => (
          <div key={item.label} style={{
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
