"use client"
import React, { useEffect, useState } from 'react'

interface Item { id: number; title: string; price: number; status: string; seller?: string; desc?: string }

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  selling: { label: '판매중', bg: '#dcfce7', color: '#16a34a' },
  reserved: { label: '예약중', bg: '#fef3c7', color: '#d97706' },
  sold: { label: '판매완료', bg: '#f1f5f9', color: '#94a3b8' },
}

export default function MarketPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/market')
      .then(r => r.json())
      .then(data => setItems(data.items || []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const filtered = search ? items.filter(i => i.title.includes(search)) : items

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>병영장터</h2>

      {/* 검색 */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>🔍</span>
        <input
          type="text" placeholder="상품 검색..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px 10px 36px', boxSizing: 'border-box',
            border: '1.5px solid #e5e7eb', borderRadius: '12px',
            fontSize: '13px', outline: 'none', background: '#fff',
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
          {search ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(i => {
            const st = STATUS_MAP[i.status] || STATUS_MAP.selling
            return (
              <div key={i.id} style={{
                padding: '16px', background: '#fff', borderRadius: '16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                opacity: i.status === 'sold' ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{i.title}</h3>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '3px 10px',
                    borderRadius: '10px', background: st.bg, color: st.color,
                  }}>{st.label}</span>
                </div>
                {i.desc && (
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#64748b' }}>{i.desc}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    {i.price?.toLocaleString()}원
                  </span>
                  {i.seller && (
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>판매자: {i.seller}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 플로팅 등록 버튼 */}
      <button onClick={async () => {
        const title = prompt('상품명')
        const price = Number(prompt('가격'))
        const desc = prompt('설명') || ''
        if (!title) return
        const res = await fetch('/api/market', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, price, status: 'selling', desc, seller: '나' })
        })
        const j = await res.json()
        setItems(prev => [j, ...prev])
      }} style={{
        position: 'fixed', bottom: '80px', right: '20px', zIndex: 40,
        width: '52px', height: '52px', borderRadius: '50%', border: 'none',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: '#fff', fontSize: '24px', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>+</button>
    </div>
  )
}
