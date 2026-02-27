"use client"
import React, { useEffect, useState } from 'react'

interface FeedItem { id:number; owner:string; caption:string; visibility:string }

export default function SharePage(){
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    setLoading(true)
    fetch('/api/feed')
      .then(r=>r.json())
      .then(data=>setFeed(data.feed||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false))
  },[])

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">생활공유</h2>

      <div className="mb-3">
        <button className="rounded bg-indigo-600 text-white px-3 py-1 text-sm" onClick={async()=>{
          const caption = prompt('설명')||''
          const visibility = prompt('visibility (public/connections/private)')||'connections'
          const res = await fetch('/api/feed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:'me',caption,visibility,images:[]})})
          const j = await res.json()
          setFeed(prev=>[j,...prev])
        }}>새 피드 올리기</button>
      </div>

      {loading? <p className="text-sm text-gray-500">불러오는 중...</p> : (
        <div className="space-y-3">
          {feed.map(f=> (
            <div key={f.id} className="p-3 bg-white rounded shadow-sm">
              <div className="flex justify-between items-center">
                <div className="font-medium">{f.owner}</div>
                <div className="text-xs text-gray-500">{f.visibility}</div>
              </div>
              <p className="text-sm text-gray-600 mt-1">{f.caption}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
