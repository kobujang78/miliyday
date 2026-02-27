"use client"
import React from 'react'

export default function TimelineCondensed({ milestones }:{ milestones: {label:string; date:string; percent:number}[] }){
  return (
    <div className="mt-4 space-y-2">
      {milestones.map(m=> (
        <div key={m.label} className="flex items-center justify-between bg-white rounded-md p-2 shadow-sm">
          <div>
            <div className="text-sm font-medium">{m.label}</div>
            <div className="text-xs text-gray-500">{m.date}</div>
          </div>
          <div className="text-sm text-gray-700">{m.percent.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  )
}
