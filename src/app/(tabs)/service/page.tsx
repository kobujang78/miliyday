"use client"
import React from 'react'
import MiliDDay from '@/components/MiliDDay'
import NextMilestoneBadge from '@/components/NextMilestoneBadge'
import QuickActions from '@/components/QuickActions'
import TimelineCondensed from '@/components/TimelineCondensed'
import WeeklySummary from '@/components/WeeklySummary'
import BadgeEarn from '@/components/BadgeEarn'
import ImageUploadWidget from '@/components/ImageUploadWidget'
import NotificationToggle from '@/components/NotificationToggle'

export default function ServicePage() {
  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">복무기간</h2>
      <MiliDDay enlistmentDate={undefined} branch="army" />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <NextMilestoneBadge label="다음 진급" date="2026-07-10" daysLeft={134} />
        <NextMilestoneBadge label="예상 휴가" date="2026-10-10" daysLeft={226} />
      </div>

      <div className="mt-3 flex justify-between items-center">
        <QuickActions inviteCode={'MILI-XXXX'} dischargeDate={'2027-07-10'} />
      </div>

      <WeeklySummary todayPercent={8.6} thisWeek={`D-${499}`} thisMonth={`D-${499}`} />

      <TimelineCondensed milestones={[{label:'입대',date:'2026-01-10',percent:0},{label:'3개월',date:'2026-04-10',percent:16.5},{label:'6개월',date:'2026-07-10',percent:33.1}]} />

      <ImageUploadWidget />
      
      <BadgeEarn percent={8.6} />

      <div className="mt-3">
        <NotificationToggle />
      </div>
    </div>
  )
}
