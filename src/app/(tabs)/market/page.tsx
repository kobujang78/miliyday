"use client"
import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

interface Item { id: string; title: string; price: number; status: string; description?: string; user_id?: string }

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  selling: { label: '판매중', bg: '#dcfce7', color: '#16a34a' },
  reserved: { label: '예약중', bg: '#fef3c7', color: '#d97706' },
  sold: { label: '판매완료', bg: '#f1f5f9', color: '#94a3b8' },
}

export default function MarketPage() {
  return (
    <div style={{ 
      maxWidth: '480px', margin: '0 auto', padding: '40px 20px', 
      textAlign: 'center', minHeight: '60dvh', display: 'flex', 
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center' 
    }}>
      <div style={{ fontSize: '64px', marginBottom: '20px' }}>🛒</div>
      <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>슬병PX</h2>
      <p style={{ fontSize: '16px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
        더 나은 병영 장터 문화를 위해<br />
        <strong>슬병PX</strong>가 출격 준비 중입니다!<br />
        <span style={{ fontSize: '14px', opacity: 0.8 }}>(업데이트 예정)</span>
      </p>
    </div>
  )
}
