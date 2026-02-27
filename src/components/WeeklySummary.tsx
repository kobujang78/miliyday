"use client"
import React from 'react'

export default function WeeklySummary({ todayPercent, thisWeek, thisMonth }:{ todayPercent:number; thisWeek:string; thisMonth:string }){
  return (
    <div className="mt-4 bg-white rounded-md p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">현재 진행</div>
          <div className="text-lg font-semibold">{todayPercent.toFixed(1)}%</div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>이번주: {thisWeek}</div>
          <div className="mt-1">이번달: {thisMonth}</div>
        </div>
      </div>
    </div>
  )
}
