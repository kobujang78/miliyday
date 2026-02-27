"use client"
import React from 'react'

export default function NextMilestoneBadge({ label, date, daysLeft }:{ label:string; date: string; daysLeft:number|null }){
  return (
    <button className="inline-flex items-center gap-2 bg-white border rounded-md px-3 py-2 shadow-sm text-sm" title={`${label} - ${date}`}>
      <div className="flex flex-col text-left">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-sm font-medium text-gray-800">{date}</span>
      </div>
      <div className="ml-2 text-xs text-indigo-600 font-semibold">{daysLeft!==null? (daysLeft>0?`D-${daysLeft}`:'지남') : '—'}</div>
    </button>
  )
}
