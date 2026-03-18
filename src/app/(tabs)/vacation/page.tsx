"use client"
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { SERVICE_MONTHS, type Branch } from '@/components/RankIcon'
import {
  VACATION_TYPES, type VacationType, type VacationRecord,
  loadVacationRecords, addVacationRecord, deleteVacationRecord,
  loadVacationBudgets, saveVacationBudgets,
  calcUsedDays, nextVacationDDay, daysBetweenInclusive,
} from '@/lib/vacationUtils'

function formatDate(d: string) {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function formatDateKr(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(target: Date) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

export default function VacationPage() {
  const { profile, user, connectedSoldier } = useAuth()
  
  const isSoldier = profile?.user_type === 'soldier'
  const targetUserId = profile?.connected_soldier_id || user?.id
  const isShared = !!profile?.connected_soldier_id && !!connectedSoldier
  
  const branch = (isShared ? connectedSoldier?.branch : profile?.branch) as Branch || 'army'
  const enlistDate = (isShared ? connectedSoldier?.enlist_date : profile?.enlist_date) || ''
  const totalServiceMonths = SERVICE_MONTHS[branch]

  const dischargeDate = useMemo(() => {
    if (!enlistDate) return null
    const d = new Date(enlistDate)
    d.setMonth(d.getMonth() + totalServiceMonths)
    return d
  }, [enlistDate, totalServiceMonths])

  const [records, setRecords] = useState<VacationRecord[]>([])
  const [budgets, setBudgets] = useState<Record<VacationType, number>>({
    regular: 24, reward: 0, consolation: 0, petition: 0, other: 0,
  })
  const [showForm, setShowForm] = useState(false)
  const [showBudgetEdit, setShowBudgetEdit] = useState(false)
  const [formType, setFormType] = useState<VacationType>('regular')
  const [formTitle, setFormTitle] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formMemo, setFormMemo] = useState('')
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [saving, setSaving] = useState(false)

  // Load data from Supabase
  useEffect(() => {
    const load = async () => {
      if (!targetUserId) return
      const [recs, buds] = await Promise.all([
        loadVacationRecords(targetUserId),
        loadVacationBudgets(targetUserId, branch),
      ])
      setRecords(recs)
      setBudgets(buds)
    }
    load()
  }, [targetUserId, branch])

  const usedDays = useMemo(() => calcUsedDays(records), [records])
  const nextDDay = useMemo(() => nextVacationDDay(records), [records])

  const totalUsed = Object.values(usedDays).reduce((a, b) => a + b, 0)
  const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0)
  const totalRemaining = totalBudget - totalUsed

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcomingRecords = records.filter(r => new Date(r.endDate) >= today).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  const pastRecords = records.filter(r => new Date(r.endDate) < today).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

  const handleAdd = useCallback(async () => {
    if (!formStart || !formEnd) return
    if (!user) { alert('로그인이 필요합니다. 마이페이지에서 로그인해주세요.'); return }
    setSaving(true)
    const days = daysBetweenInclusive(formStart, formEnd)
    const typeInfo = VACATION_TYPES.find(t => t.value === formType)!
    const newRecord = await addVacationRecord(user.id, {
      type: formType,
      title: formTitle || typeInfo.label,
      startDate: formStart,
      endDate: formEnd,
      days,
      memo: formMemo || undefined,
    })
    if (newRecord) {
      setRecords(prev => [...prev, newRecord])
    }
    setShowForm(false)
    setFormTitle(''); setFormStart(''); setFormEnd(''); setFormMemo('')
    setSaving(false)
  }, [formType, formTitle, formStart, formEnd, formMemo, user])

  const handleDelete = useCallback(async (id: string) => {
    const success = await deleteVacationRecord(id)
    if (success) {
      setRecords(prev => prev.filter(r => r.id !== id))
    }
  }, [])

  const handleBudgetSave = useCallback(async () => {
    if (!user) return
    await saveVacationBudgets(user.id, budgets)
    setShowBudgetEdit(false)
  }, [budgets, user])

  // Progress bar values
  const progressPct = totalBudget > 0 ? Math.min(100, (totalUsed / totalBudget) * 100) : 0

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── 휴가 D-Day 배너 ── */}
      <div style={{
        background: 'linear-gradient(135deg, #059669, #10b981)',
        borderRadius: '20px', padding: '24px', color: '#fff',
        boxShadow: '0 8px 24px rgba(5,150,105,0.3)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: '-25px', left: '30px', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>🗓️</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>휴가 관리</h2>
            {isShared && (
              <span style={{ 
                background: 'rgba(255,255,255,0.2)', 
                padding: '2px 8px', 
                borderRadius: '8px', 
                fontSize: '10px', 
                fontWeight: 700 
              }}>연동됨</span>
            )}
          </div>
          {dischargeDate && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>{isShared ? `${connectedSoldier?.nickname || '용사'}님 전역까지` : '전역까지'}</div>
              <div style={{ fontSize: '13px', fontWeight: 800 }}>D-{daysUntil(dischargeDate)}</div>
            </div>
          )}
        </div>

        {nextDDay ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>다음 휴가까지</div>
              <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1.1 }}>D-{nextDDay.days}</div>
            </div>
            <div style={{
              padding: '8px 12px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', flex: 1,
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700 }}>{nextDDay.record.title}</div>
              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                {formatDate(nextDDay.record.startDate)} ~ {formatDate(nextDDay.record.endDate)} ({nextDDay.record.days}일)
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            등록된 예정 휴가가 없습니다
          </div>
        )}

        {/* 전체 진행 바 */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>사용 {totalUsed}일 / 총 {totalBudget}일</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>잔여 {totalRemaining}일</span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '4px', background: '#fff',
              width: `${progressPct}%`, transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      {/* ── 종류별 잔여 현황 ── */}
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>종류별 현황</h3>
          {!isShared && (
            <button onClick={() => setShowBudgetEdit(!showBudgetEdit)} style={{
              border: 'none', background: '#f1f5f9', padding: '5px 12px', borderRadius: '12px',
              fontSize: '11px', fontWeight: 600, color: '#64748b', cursor: 'pointer',
            }}>⚙️ 일수 설정</button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {VACATION_TYPES.map(t => {
            const total = budgets[t.value]
            const used = usedDays[t.value]
            const remaining = total - used
            if (total === 0 && used === 0) return null
            const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
            return (
              <div key={t.value} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '12px', background: '#f8fafc',
              }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{t.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{t.label}</span>
                    <span style={{ fontSize: '11px', color: remaining > 0 ? t.color : '#ef4444', fontWeight: 700 }}>
                      {remaining}일 남음
                    </span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px', background: t.color,
                      width: `${pct}%`, transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                    {used}일 사용 / 총 {total}일
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 일수 설정 패널 */}
        {showBudgetEdit && (
          <div style={{
            marginTop: '12px', padding: '14px', borderRadius: '14px',
            background: '#f8fafc', border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
              💡 각 휴가 종류의 총 일수를 설정하세요
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {VACATION_TYPES.map(t => (
                <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', minWidth: '80px' }}>{t.emoji} {t.label}</span>
                  <input
                    type="number" min={0} max={99}
                    value={budgets[t.value]}
                    onChange={e => setBudgets({ ...budgets, [t.value]: Math.max(0, Number(e.target.value)) })}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                      fontSize: '13px', fontWeight: 700, textAlign: 'center', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>일</span>
                </div>
              ))}
            </div>
            <button onClick={handleBudgetSave} style={{
              marginTop: '10px', width: '100%', padding: '10px', borderRadius: '10px',
              border: 'none', background: '#10b981', color: '#fff',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}>저장</button>
          </div>
        )}
      </div>

      {/* ── 휴가 등록 버튼 ── */}
      {!isShared && (
        <button onClick={() => setShowForm(!showForm)} style={{
          width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
          background: showForm ? '#f1f5f9' : 'linear-gradient(135deg, #059669, #10b981)',
          color: showForm ? '#64748b' : '#fff',
          fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          boxShadow: showForm ? 'none' : '0 4px 12px rgba(16,185,129,0.3)',
          transition: 'all 0.3s',
        }}>
          {showForm ? '✕ 취소' : '➕ 휴가 등록하기'}
        </button>
      )}

      {/* ── 휴가 등록 폼 ── */}
      {showForm && (
        <div style={{
          background: '#fff', borderRadius: '20px', padding: '20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            🗓️ 휴가 등록
          </h3>

          {/* 종류 선택 */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {VACATION_TYPES.map(t => (
              <button key={t.value} onClick={() => setFormType(t.value)} style={{
                padding: '6px 12px', borderRadius: '12px', border: 'none',
                background: formType === t.value ? t.color : '#f1f5f9',
                color: formType === t.value ? '#fff' : '#64748b',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              }}>{t.emoji} {t.label}</button>
            ))}
          </div>

          {/* 제목 */}
          <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
            placeholder="제목 (예: 첫 정기휴가)" style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              border: '1px solid #e2e8f0', fontSize: '13px', marginBottom: '8px',
              outline: 'none', boxSizing: 'border-box',
            }} />

          {/* 날짜 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>시작일</label>
              <input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} style={{
                width: '100%', padding: '8px 10px', borderRadius: '10px',
                border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>종료일</label>
              <input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} style={{
                width: '100%', padding: '8px 10px', borderRadius: '10px',
                border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
          </div>
          {formStart && formEnd && (
            <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, marginBottom: '8px' }}>
              📅 총 {daysBetweenInclusive(formStart, formEnd)}일
            </div>
          )}

          {/* 메모 */}
          <input value={formMemo} onChange={e => setFormMemo(e.target.value)}
            placeholder="메모 (선택)" style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              border: '1px solid #e2e8f0', fontSize: '13px', marginBottom: '12px',
              outline: 'none', boxSizing: 'border-box',
            }} />

          <button onClick={handleAdd} disabled={!formStart || !formEnd || saving} style={{
            width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
            background: formStart && formEnd && !saving ? '#10b981' : '#e2e8f0',
            color: formStart && formEnd && !saving ? '#fff' : '#9ca3af',
            fontSize: '14px', fontWeight: 700, cursor: formStart && formEnd && !saving ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}>{saving ? '저장 중...' : '등록하기'}</button>
        </div>
      )}

      {/* ── 휴가 기록 목록 ── */}
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}>
        {/* 탭 */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
          {[
            { key: 'upcoming' as const, label: `예정 (${upcomingRecords.length})` },
            { key: 'past' as const, label: `사용 완료 (${pastRecords.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#0f172a' : '#9ca3af',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* 목록 */}
        {(activeTab === 'upcoming' ? upcomingRecords : pastRecords).length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '30px 20px', borderRadius: '12px', background: '#f8fafc',
            color: '#9ca3af', fontSize: '13px',
          }}>
            {activeTab === 'upcoming' ? '예정된 휴가가 없습니다\n위의 ➕ 버튼으로 등록하세요' : '아직 사용한 휴가가 없습니다'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(activeTab === 'upcoming' ? upcomingRecords : pastRecords).map(r => {
              const typeInfo = VACATION_TYPES.find(t => t.value === r.type)!
              const startDate = new Date(r.startDate)
              const isOngoing = startDate <= today && new Date(r.endDate) >= today
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px', borderRadius: '14px',
                  background: isOngoing ? `${typeInfo.color}08` : '#f8fafc',
                  border: isOngoing ? `1.5px solid ${typeInfo.color}30` : '1px solid #f1f5f9',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: `${typeInfo.color}15`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0,
                  }}>{typeInfo.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{r.title}</span>
                      {isOngoing && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px',
                          background: typeInfo.color, color: '#fff',
                        }}>진행중</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {formatDate(r.startDate)} ~ {formatDate(r.endDate)} · {r.days}일
                    </div>
                    {r.memo && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{r.memo}</div>}
                  </div>
                  {!isShared && (
                    <button onClick={() => handleDelete(r.id)} style={{
                      border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer',
                      color: '#cbd5e1', padding: '4px', flexShrink: 0,
                    }}>✕</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
