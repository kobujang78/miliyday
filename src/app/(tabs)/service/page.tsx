"use client"
import React, { useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { SERVICE_MONTHS, BRANCHES, type Branch, type RankLevel } from '@/components/RankIcon'
import { calcAutoRank, getPromotionDates } from '@/lib/rankUtils'
import MiliDDay from '@/components/MiliDDay'
import NextMilestoneBadge from '@/components/NextMilestoneBadge'
import QuickActions from '@/components/QuickActions'
import TimelineCondensed from '@/components/TimelineCondensed'
import WeeklySummary from '@/components/WeeklySummary'
import BadgeEarn from '@/components/BadgeEarn'
import ImageUploadWidget from '@/components/ImageUploadWidget'
import NotificationToggle from '@/components/NotificationToggle'

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

export default function ServicePage() {
  const { profile, connectedSoldier, user } = useAuth()

  // Determine effective branch and enlistment date
  // (Priority: User's profile if soldier, otherwise connected soldier's profile)
  const isSoldier = profile?.user_type === 'soldier'
  const hasConnection = !!profile?.connected_soldier_id && !!connectedSoldier

  const branch = (isSoldier ? profile?.branch : connectedSoldier?.branch || profile?.branch) as Branch || 'army'
  const enlistDate = (isSoldier ? profile?.enlist_date : connectedSoldier?.enlist_date || profile?.enlist_date) || ''
  
  const { dischargeDate, remainingDays, totalDays, passedDays, percent, promotionDates } = useMemo(() => {
    if (!enlistDate) return { dischargeDate: null, remainingDays: 0, totalDays: 0, passedDays: 0, percent: 0, promotionDates: null }
    const months = SERVICE_MONTHS[branch]
    const enlist = new Date(enlistDate)
    const discharge = new Date(enlist)
    discharge.setMonth(discharge.getMonth() + months)
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const total = Math.max(1, daysBetween(enlist, discharge))
    const passed = Math.min(total, Math.max(0, daysBetween(enlist, today)))
    const remaining = Math.max(0, total - passed)
    const pct = Math.min(100, Math.max(0, (passed / total) * 100))
    
    const promos = getPromotionDates(enlistDate, branch)
    
    return { dischargeDate: discharge, remainingDays: remaining, totalDays: total, passedDays: passed, percent: pct, promotionDates: promos }
  }, [enlistDate, branch])

  const nextPromotion = useMemo(() => {
    if (!promotionDates) return null
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const promos = [
      { label: '일병', date: promotionDates.private1 },
      { label: '상병', date: promotionDates.corporal },
      { label: '병장', date: promotionDates.sergeant },
    ]
    const next = promos.find(p => p.date > now)
    if (!next) return null
    return { ...next, daysLeft: daysBetween(now, next.date) }
  }, [promotionDates])

  const dischargeDDay = dischargeDate ? daysBetween(new Date(), dischargeDate) : 0

  return (
    <div className="max-w-md mx-auto p-4 flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#0f172a] mb-2">복무현황</h2>
      
      <MiliDDay enlistmentDate={enlistDate} branch={branch} />

      {enlistDate && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {nextPromotion && (
              <NextMilestoneBadge 
                label={`다음 진급 (${nextPromotion.label})`} 
                date={nextPromotion.date.toISOString().split('T')[0]} 
                daysLeft={nextPromotion.daysLeft} 
              />
            )}
            <NextMilestoneBadge 
              label="전역일" 
              date={dischargeDate?.toISOString().split('T')[0] || ''} 
              daysLeft={dischargeDDay} 
            />
          </div>

          <div className="flex justify-between items-center py-2">
            <QuickActions inviteCode={profile?.invite_code || 'MILI-XXXX'} dischargeDate={dischargeDate?.toISOString().split('T')[0]} />
          </div>

          <WeeklySummary 
            todayPercent={Math.round(percent * 10) / 10} 
            thisWeek={`D-${dischargeDDay}`} 
            thisMonth={`D-${dischargeDDay}`} 
          />

          <TimelineCondensed 
            milestones={[
              { label: '입대', date: enlistDate, percent: 0 },
              { label: '현재', date: new Date().toISOString().split('T')[0], percent: Math.round(percent * 10) / 10 },
              { label: '전역', date: dischargeDate?.toISOString().split('T')[0] || '', percent: 100 }
            ]} 
          />
          
          <BadgeEarn percent={percent} />
        </>
      )}

      {!enlistDate && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm">
          💡 마이페이지에서 입대 정보를 입력하면 전역일과 진급 정보를 확인할 수 있습니다.
        </div>
      )}

      <ImageUploadWidget />
      
      <div className="mt-2">
        <NotificationToggle />
      </div>
    </div>
  )
}
