"use client"
import React, { useState, useEffect, useMemo } from 'react'
import RankIcon, { BRANCHES, SERVICE_MONTHS, type Branch, type RankLevel } from '@/components/RankIcon'
import { calcAutoRank, RANK_LABELS } from '@/lib/rankUtils'
import { useAuth } from '@/components/AuthProvider'
import { loadVacationRecords, nextVacationDDay } from '@/lib/vacationUtils'
import { createClient } from '@/lib/supabase'

function formatDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

interface Notice { id: string; title: string; body: string; date: string }

export default function Home() {
  const { profile, user, loading } = useAuth()

  // Derived state from profile
  const name = profile?.display_name || ''
  const nickname = profile?.nickname || ''
  const avatarUrl = profile?.avatar_url || ''
  const displayName = nickname || name
  const branch = (profile?.branch as Branch) || 'army'
  const enlistDate = profile?.enlist_date || ''
  
  // Use auto-calculated rank like AppShell
  const activeRank = enlistDate ? calcAutoRank(enlistDate, branch) : ((profile?.rank_level as RankLevel) || 1)

  const currentBranch = BRANCHES.find(b => b.value === branch)!
  const accentColor = { army: '#2d5016', navy: '#1a365d', airforce: '#4a1d96', marines: '#991b1b' }[branch]

  // Notices from Supabase
  const [notices, setNotices] = useState<Notice[]>([])
  useEffect(() => {
    const fetchNotices = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setNotices(data)
    }
    fetchNotices()
  }, [])

  // D-Day
  const dday = useMemo(() => {
    if (!enlistDate) return null
    const months = SERVICE_MONTHS[branch]
    const enlist = new Date(enlistDate)
    const discharge = new Date(enlist)
    discharge.setMonth(discharge.getMonth() + months)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const total = Math.max(1, daysBetween(enlist, discharge))
    const passed = Math.min(total, Math.max(0, daysBetween(enlist, today)))
    const remaining = Math.max(0, total - passed)
    const percent = Math.min(100, Math.max(0, (passed / total) * 100))
    return { total, passed, remaining, percent: Math.round(percent * 10) / 10, discharge }
  }, [enlistDate, branch])

  // Vacation D-Day from Supabase
  const [vacationInfo, setVacationInfo] = useState<{ days: number; record: any } | null>(null)
  useEffect(() => {
    const load = async () => {
      if (!user) return
      const records = await loadVacationRecords(user.id)
      setVacationInfo(nextVacationDDay(records))
    }
    load()
  }, [user, loading])


  const circleSize = 100
  const stroke = 8
  const radius = (circleSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = dday ? circumference * (1 - dday.percent / 100) : circumference

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── 인트로 배너 ── */}
      <div style={{
        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
        borderRadius: '20px', padding: '24px', color: '#fff',
        boxShadow: `0 8px 24px ${accentColor}30`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px',
          borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-30px', right: '40px', width: '80px', height: '80px',
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '48px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            overflow: 'hidden',
          }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <RankIcon level={activeRank} branch={branch} size={28} />
            )}
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              {displayName && dday ? (
                <>
                  <span>{currentBranch.label} {RANK_LABELS[activeRank]} {displayName}</span>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '15px', opacity: 0.9 }}>
                    {vacationInfo && <span>휴가 D-{vacationInfo.days}</span>}
                    <span>전역 D-{dday.remaining}</span>
                  </div>
                </>
              ) : displayName ? (
                `${currentBranch.label} ${RANK_LABELS[activeRank]} ${displayName}`
              ) : (
                '슬기로운 병영생활 오픈!'
              )}
            </div>
            {(!name || !dday) && (
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
                군 생활의 든든한 동반자
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 공지사항 ── */}
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '16px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📋 공지사항
        </h3>
        {notices.map((n, i) => (
          <div key={n.id} style={{
            padding: '10px 0',
            borderBottom: i < notices.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{n.title}</span>
              <span style={{ fontSize: '10px', color: '#9ca3af' }}>{n.date}</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>{n.body}</p>
          </div>
        ))}
      </div>


      {/* ── 복무기간 D-Day ── */}
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>복무기간</h3>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>{currentBranch.label} {SERVICE_MONTHS[branch]}개월</span>
        </div>

        {!enlistDate && (
          <div style={{
            textAlign: 'center', padding: '12px', border: '1.5px dashed #e5e7eb', borderRadius: '12px',
            color: '#6b7280', fontSize: '12px'
          }}>
            마이페이지에서 정보를 입력해주세요.
          </div>
        )}

        {dday ? (
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ flexShrink: 0 }}>
              <svg width={circleSize} height={circleSize} viewBox={`0 0 ${circleSize} ${circleSize}`}>
                <circle cx={circleSize / 2} cy={circleSize / 2} r={radius}
                  fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
                <circle cx={circleSize / 2} cy={circleSize / 2} r={radius}
                  fill="none" stroke={accentColor} strokeWidth={stroke} strokeLinecap="round"
                  strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={offset}
                  transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
                  style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.9,.2,1)' }} />
                <text x={circleSize / 2} y={circleSize / 2 - 4} textAnchor="middle"
                  fontSize="16" fontWeight="800" fill={accentColor}>{dday.percent}%</text>
                <text x={circleSize / 2} y={circleSize / 2 + 12} textAnchor="middle"
                  fontSize="9" fill="#6b7280">진행률</text>
              </svg>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                padding: '8px 10px', borderRadius: '10px',
                background: `${accentColor}08`, border: `1px solid ${accentColor}12`,
              }}>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>전역일</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: accentColor }}>{formatDate(dday.discharge)}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                {[
                  { label: '총', value: `${dday.total}일` },
                  { label: '경과', value: `${dday.passed}일` },
                  { label: 'D-', value: `${dday.remaining}` },
                ].map(s => (
                  <div key={s.label} style={{
                    textAlign: 'center', padding: '6px 2px', borderRadius: '8px', background: '#f8fafc',
                  }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>{s.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '20px', borderRadius: '12px', background: '#f8fafc',
            color: '#9ca3af', fontSize: '13px',
          }}>입대일을 입력하면 전역일과 진행률을 계산합니다</div>
        )}
      </div>


    </div>
  )
}
