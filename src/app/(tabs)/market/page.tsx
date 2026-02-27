"use client"
import React, { useEffect, useState } from 'react'

interface Item { id:number; title:string; price:number; status:string }

export default function MarketPage(){
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    setLoading(true)
    fetch('/api/market')
      .then(r=>r.json())
      .then(data=>setItems(data.items||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false))
  },[])

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">병영장터</h2>

      <div className="mb-3">
        <button className="rounded bg-emerald-600 text-white px-3 py-1 text-sm" onClick={async()=>{
          const title = prompt('상품명')
          const price = Number(prompt('가격'))
          if(!title) return
          const res = await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,price,status:'selling'})})
          const j = await res.json()
          setItems(prev=>[j,...prev])
        }}>판매 등록</button>
      </div>

      {loading? <p className="text-sm text-gray-500">불러오는 중...</p> : (
        <div className="space-y-3">
          {items.map(i=> (
            <div key={i.id} className="p-3 bg-white rounded shadow-sm">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">{i.title}</h3>
                <div className="text-sm text-gray-500">{i.status}</div>
              </div>
              <p className="text-sm text-gray-700">{i.price?.toLocaleString()}원</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
