"use client"
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { getPoints, getPointHistory } from '@/lib/pointUtils'

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  signup_bonus: { label: '가입 보너스', emoji: '🎉' },
  invite_reward: { label: '초대 보상', emoji: '🤝' },
  post_reward: { label: '병영꿀팁 작성', emoji: '💡' },
  feed_reward: { label: '생활공유 작성', emoji: '📸' },
  purchase: { label: '장터 구매', emoji: '🛒' },
  coupon_exchange: { label: '쿠폰 교환', emoji: '🎫' },
}

export default function PointsPage() {
  const { user } = useAuth()
  const [points, setPoints] = useState(0)
  const [history, setHistory] = useState<Array<{
    id: string; amount: number; type: string; description: string; created_at: string
  }>>([])
  const [filter, setFilter] = useState<'all' | 'earned' | 'spent'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      const [pts, hist] = await Promise.all([
        getPoints(user.id),
        getPointHistory(user.id, filter),
      ])
      setPoints(pts)
      setHistory(hist)
      setLoading(false)
    }
    load()
  }, [user, filter])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
        로그인이 필요합니다
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>💰</span> 밀포인트
      </h2>

      {/* 잔액 카드 */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a, #1e293b)',
        borderRadius: '20px', padding: '24px', color: '#fff',
        boxShadow: '0 8px 24px rgba(15,23,42,0.3)',
      }}>
        <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>현재 보유 포인트</div>
        <div style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          {points.toLocaleString()}
          <span style={{ fontSize: '18px', fontWeight: 600, opacity: 0.8 }}>P</span>
        </div>
        <div style={{
          marginTop: '16px', padding: '10px 14px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.1)', fontSize: '11px', lineHeight: 1.6,
        }}>
          <div>💡 꿀팁 작성: <strong>+50P</strong> (일 3회)</div>
          <div>📸 생활공유: <strong>+30P</strong> (일 3회)</div>
          <div>🤝 초대 가입: 초대자 <strong>+1,000P</strong> / 가입자 <strong>+2,000P</strong></div>
        </div>
      </div>

      {/* 필터 탭 */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {([
          { key: 'all', label: '전체' },
          { key: 'earned', label: '적립' },
          { key: 'spent', label: '사용' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
              background: filter === f.key ? '#0f172a' : '#f1f5f9',
              color: filter === f.key ? '#fff' : '#64748b',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 포인트 내역 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>불러오는 중...</div>
      ) : history.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px', background: '#fff',
          borderRadius: '16px', color: '#9ca3af', fontSize: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <div style={{ fontWeight: 700, color: '#64748b' }}>아직 내역이 없습니다</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>활동하면 포인트가 쌓여요!</div>
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        }}>
          {history.map((item, idx) => {
            const typeInfo = TYPE_LABELS[item.type] || { label: item.type, emoji: '💎' }
            const isPositive = item.amount > 0
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px',
                borderBottom: idx < history.length - 1 ? '1px solid #f8fafc' : 'none',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: isPositive ? '#dcfce710' : '#fee2e210',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', flexShrink: 0,
                }}>
                  {typeInfo.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    {item.description || typeInfo.label}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                    {formatDate(item.created_at)}
                  </div>
                </div>
                <div style={{
                  fontSize: '15px', fontWeight: 800,
                  color: isPositive ? '#10b981' : '#ef4444',
                }}>
                  {isPositive ? '+' : ''}{item.amount.toLocaleString()}P
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
