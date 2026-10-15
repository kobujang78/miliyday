import React from 'react'
import Link from 'next/link'

export default function NotFound() {
    return (
        <div style={{
            minHeight: '60dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px',
            padding: '40px 20px', textAlign: 'center',
        }}>
            <div style={{ fontSize: '48px' }}>🧭</div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                페이지를 찾을 수 없습니다
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                주소가 바뀌었거나 삭제된 화면입니다.
            </p>
            <Link
                href="/"
                style={{
                    marginTop: '8px', padding: '12px 24px', borderRadius: '12px',
                    background: '#0f172a', color: '#fff', textDecoration: 'none',
                    fontSize: '14px', fontWeight: 700,
                }}
            >
                홈으로
            </Link>
        </div>
    )
}
