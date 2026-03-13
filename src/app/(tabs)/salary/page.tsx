"use client"
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { SERVICE_MONTHS, BRANCHES, type Branch, type RankLevel } from '@/components/RankIcon'
import { RANK_LABELS, calcAutoRank, getPromotionDates } from '@/lib/rankUtils'
import {
  SALARY_BY_RANK, SAVINGS, calcMonthlySalaries,
  calcTotalSalary, calcSavings
} from '@/lib/salaryUtils'

const RANK_COLORS: Record<number, string> = {
  1: '#94a3b8', // 이병 - gray
  2: '#3b82f6', // 일병 - blue
  3: '#8b5cf6', // 상병 - purple
  4: '#f59e0b', // 병장 - gold
}

function formatWon(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`
  return n.toLocaleString()
}

function formatWonFull(n: number): string {
  return n.toLocaleString() + '원'
}

function formatDateKr(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
function daysUntil(target: Date) {
  const now = new Date(); now.setHours(0,0,0,0)
  return Math.ceil((target.getTime() - now.getTime()) / (24*60*60*1000))
}

export default function SalaryPage() {
  const { profile } = useAuth()
  const branch = (profile?.branch as Branch) || 'army'
  const enlistDate = profile?.enlist_date || ''
  // Use auto-calculated rank from enlistment date
  const rankLevel: RankLevel = enlistDate ? calcAutoRank(enlistDate, branch) : ((profile?.rank_level as RankLevel) || 1)
  const totalServiceMonths = SERVICE_MONTHS[branch]
  const branchInfo = BRANCHES.find(b => b.value === branch)!

  // Calculate discharge date and remaining months
  const { dischargeDate, remainingMonths, promotionDates } = useMemo(() => {
    if (!enlistDate) return { dischargeDate: null, remainingMonths: totalServiceMonths, promotionDates: null }
    const enlist = new Date(enlistDate)
    const discharge = new Date(enlist)
    discharge.setMonth(discharge.getMonth() + totalServiceMonths)
    const now = new Date()
    const elapsed = (now.getFullYear() - enlist.getFullYear()) * 12 + (now.getMonth() - enlist.getMonth())
    const remaining = Math.max(0, totalServiceMonths - elapsed)
    const promos = getPromotionDates(enlistDate, branch)
    return { dischargeDate: discharge, remainingMonths: remaining, promotionDates: promos }
  }, [enlistDate, branch, totalServiceMonths])

  const [monthlyDeposit, setMonthlyDeposit] = useState(550000)
  const timelineRef = useRef<HTMLDivElement>(null)

  const monthlyEntries = useMemo(() => calcMonthlySalaries(enlistDate, branch), [enlistDate, branch])
  const totalSalary = useMemo(() => calcTotalSalary(monthlyEntries), [monthlyEntries])
  const savingsResult = useMemo(() => calcSavings(monthlyDeposit, totalServiceMonths), [monthlyDeposit, totalServiceMonths])

  // Scroll timeline to current month
  useEffect(() => {
    if (!timelineRef.current || !enlistDate) return
    const enlist = new Date(enlistDate)
    const now = new Date()
    const monthsPassed = (now.getFullYear() - enlist.getFullYear()) * 12 + (now.getMonth() - enlist.getMonth())
    const el = timelineRef.current.children[Math.max(0, monthsPassed)] as HTMLElement
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [enlistDate])

  const currentSalary = SALARY_BY_RANK[rankLevel]

  // Next promotion info
  const nextPromotion = useMemo(() => {
    if (!promotionDates) return null
    const now = new Date(); now.setHours(0,0,0,0)
    const promos = [
      { rank: 2 as RankLevel, date: promotionDates.private1, label: '일병' },
      { rank: 3 as RankLevel, date: promotionDates.corporal, label: '상병' },
      { rank: 4 as RankLevel, date: promotionDates.sergeant, label: '병장' },
    ]
    return promos.find(p => p.date > now) || null
  }, [promotionDates])

  // Donut chart for savings
  const donutSize = 140
  const donutStroke = 20
  const donutRadius = (donutSize - donutStroke) / 2
  const donutCirc = 2 * Math.PI * donutRadius
  const total = savingsResult.totalAmount || 1
  const principalPct = savingsResult.totalPrincipal / total
  const matchingPct = savingsResult.matchingAmount / total
  const interestPct = savingsResult.interest / total

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── 월급 대시보드 ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #334155)',
        borderRadius: '20px', padding: '24px', color: '#fff',
        boxShadow: '0 8px 24px rgba(30,41,59,0.3)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px',
          borderRadius: '50%', background: 'rgba(251,191,36,0.1)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-30px', left: '20px', width: '60px', height: '60px',
          borderRadius: '50%', background: 'rgba(139,92,246,0.08)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '20px' }}>💰</span>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>내 월급 현황 · {branchInfo.label}</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
            background: RANK_COLORS[rankLevel] + '30', color: RANK_COLORS[rankLevel],
          }}>
            {RANK_LABELS[rankLevel]}
          </span>
          <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px' }}>
            {formatWonFull(currentSalary)}
          </span>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px',
        }}>
          <div style={{
            padding: '10px 12px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>복무기간 총 월급</div>
            <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
              {formatWon(totalSalary)}원
            </div>
          </div>
          <div style={{
            padding: '10px 12px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>
              {dischargeDate ? '전역일' : '복무 기간'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
              {dischargeDate ? formatDateKr(dischargeDate) : `${totalServiceMonths}개월`}
            </div>
          </div>
        </div>

        {/* 진급 D-Day */}
        {nextPromotion && (
          <div style={{
            marginTop: '10px', padding: '8px 12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>
              🎖️ {nextPromotion.label} 진급까지
            </span>
            <span style={{ fontSize: '13px', fontWeight: 800 }}>
              D-{daysUntil(nextPromotion.date)} ({formatDateKr(nextPromotion.date)})
            </span>
          </div>
        )}

        {/* 계급별 월급 표 */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
          {([1, 2, 3, 4] as RankLevel[]).map(r => (
            <div key={r} style={{
              flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: '10px',
              background: r === rankLevel ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
              border: r === rankLevel ? '1.5px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.06)',
              transition: 'all 0.3s',
            }}>
              <div style={{ fontSize: '9px', opacity: 0.7, marginBottom: '2px' }}>{RANK_LABELS[r]}</div>
              <div style={{ fontSize: '11px', fontWeight: 800 }}>{(SALARY_BY_RANK[r] / 10000).toFixed(0)}만</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 월급 캘린더 (타임라인) ── */}
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📅 월급 캘린더
        </h3>

        {monthlyEntries.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '20px', borderRadius: '12px', background: '#f8fafc',
            color: '#9ca3af', fontSize: '13px',
          }}>마이페이지에서 입대일을 입력하면 월급 캘린더가 표시됩니다</div>
        ) : (
          <div ref={timelineRef} style={{
            display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px',
            scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch',
          }}>
            {monthlyEntries.map((e, i) => {
              const now = new Date()
              const isCurrent = e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth()
              const isPast = e.date < new Date(now.getFullYear(), now.getMonth(), 1)
              const isPromoMonth = i > 0 && monthlyEntries[i - 1].rank !== e.rank

              return (
                <div key={i} style={{
                  minWidth: '68px', padding: '10px 8px', borderRadius: '12px', textAlign: 'center',
                  background: isCurrent ? `${RANK_COLORS[e.rank]}10` : isPast ? '#f8fafc' : '#fff',
                  border: isCurrent ? `2px solid ${RANK_COLORS[e.rank]}` : '1px solid #f1f5f9',
                  opacity: isPast && !isCurrent ? 0.6 : 1,
                  flexShrink: 0, transition: 'all 0.2s',
                  position: 'relative',
                }}>
                  {isPromoMonth && (
                    <div style={{
                      position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)',
                      fontSize: '10px', background: RANK_COLORS[e.rank],
                      color: '#fff', padding: '1px 6px', borderRadius: '8px', fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>🎉 진급</div>
                  )}
                  <div style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '4px' }}>
                    {e.label}
                  </div>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', margin: '0 auto 4px',
                    background: RANK_COLORS[e.rank],
                  }} />
                  <div style={{
                    fontSize: '10px', fontWeight: 700,
                    color: isCurrent ? RANK_COLORS[e.rank] : '#334155',
                  }}>
                    {(e.salary / 10000)}만
                  </div>
                  <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '1px' }}>
                    {RANK_LABELS[e.rank]}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 적금 시뮬레이터 ── */}
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🏦 장병내일준비적금 시뮬레이터
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
          정부 100% 매칭 · 연 5% 금리 · 비과세
        </p>

        {/* 슬라이더 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>월 납입액</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
              {(monthlyDeposit / 10000).toFixed(0)}만원
            </span>
          </div>
          <input
            type="range"
            min={SAVINGS.MIN_MONTHLY}
            max={SAVINGS.MAX_MONTHLY}
            step={SAVINGS.STEP}
            value={monthlyDeposit}
            onChange={e => setMonthlyDeposit(Number(e.target.value))}
            style={{
              width: '100%', height: '6px', appearance: 'none', WebkitAppearance: 'none',
              borderRadius: '3px', outline: 'none', cursor: 'pointer',
              background: `linear-gradient(to right, #6366f1 ${((monthlyDeposit - SAVINGS.MIN_MONTHLY) / (SAVINGS.MAX_MONTHLY - SAVINGS.MIN_MONTHLY)) * 100}%, #e2e8f0 0%)`,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '9px', color: '#9ca3af' }}>5만원</span>
            <span style={{ fontSize: '9px', color: '#9ca3af' }}>55만원</span>
          </div>
        </div>

        {/* 도넛 차트 + 결과 */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ flexShrink: 0, position: 'relative' }}>
            <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
              {/* 원금 */}
              <circle cx={donutSize / 2} cy={donutSize / 2} r={donutRadius}
                fill="none" stroke="#6366f1" strokeWidth={donutStroke}
                strokeDasharray={`${donutCirc * principalPct} ${donutCirc * (1 - principalPct)}`}
                strokeDashoffset={0}
                transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                style={{ transition: 'all 0.5s ease' }}
              />
              {/* 매칭 */}
              <circle cx={donutSize / 2} cy={donutSize / 2} r={donutRadius}
                fill="none" stroke="#10b981" strokeWidth={donutStroke}
                strokeDasharray={`${donutCirc * matchingPct} ${donutCirc * (1 - matchingPct)}`}
                strokeDashoffset={-donutCirc * principalPct}
                transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                style={{ transition: 'all 0.5s ease' }}
              />
              {/* 이자 */}
              <circle cx={donutSize / 2} cy={donutSize / 2} r={donutRadius}
                fill="none" stroke="#f59e0b" strokeWidth={donutStroke}
                strokeDasharray={`${donutCirc * interestPct} ${donutCirc * (1 - interestPct)}`}
                strokeDashoffset={-donutCirc * (principalPct + matchingPct)}
                transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                style={{ transition: 'all 0.5s ease' }}
              />
              <text x={donutSize / 2} y={donutSize / 2 - 6} textAnchor="middle"
                fontSize="13" fontWeight="900" fill="#0f172a">만기 수령</text>
              <text x={donutSize / 2} y={donutSize / 2 + 12} textAnchor="middle"
                fontSize="14" fontWeight="900" fill="#6366f1">{formatWon(savingsResult.totalAmount)}원</text>
            </svg>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: '💜 내 원금', value: savingsResult.totalPrincipal, color: '#6366f1' },
              { label: '💚 정부 매칭', value: savingsResult.matchingAmount, color: '#10b981' },
              { label: '💛 이자 (비과세)', value: savingsResult.interest, color: '#f59e0b' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: '10px', background: '#f8fafc',
              }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                  {item.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                  {formatWon(item.value)}원
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 총액 요약 */}
        <div style={{
          marginTop: '16px', padding: '14px', borderRadius: '14px',
          background: 'linear-gradient(135deg, #6366f110, #10b98110)',
          border: '1px solid #6366f120',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>월 {(monthlyDeposit / 10000).toFixed(0)}만원 × {totalServiceMonths}개월 납입 시</div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                정부 매칭 100% + 연 5% 이자 포함
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#6366f1' }}>
                {formatWonFull(savingsResult.totalAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* 안내 */}
        <div style={{
          marginTop: '12px', padding: '10px 12px', borderRadius: '10px',
          background: '#fffbeb', border: '1px solid #fef3c7',
          fontSize: '10px', color: '#92400e', lineHeight: 1.6,
        }}>
          💡 실제 금리는 은행별 우대금리에 따라 최대 연 7%까지 적용 가능합니다. 중도 해지 시 매칭지원금 및 비과세 혜택이 소멸됩니다.
        </div>
      </div>

    </div>
  )
}
