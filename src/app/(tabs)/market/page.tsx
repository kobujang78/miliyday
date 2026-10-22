"use client"
import { useState } from 'react'

const PX_GUIDE_URL = 'https://pxguide.zeromorow.chatgpt.site'

export default function MarketPage() {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <section style={{
      position: 'relative',
      width: '100%',
      height: 'calc(100dvh - 145px)',
      minHeight: '520px',
      maxWidth: '1200px',
      margin: '0 auto',
      overflow: 'hidden',
      borderRadius: '16px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
    }}>
      {!isLoaded && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          PX 가이드를 불러오는 중입니다…
        </div>
      )}

      <iframe
        title="슬병 PX 가이드"
        src={PX_GUIDE_URL}
        onLoad={() => setIsLoaded(true)}
        allow="clipboard-read; clipboard-write"
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          height: '100%',
          border: 0,
          background: '#fff',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      />

      <a
        href={PX_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="새 창에서 열기"
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 2,
          padding: '7px 10px',
          borderRadius: '999px',
          background: 'rgba(15, 23, 42, 0.82)',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 700,
          textDecoration: 'none',
          backdropFilter: 'blur(8px)',
        }}
      >
        새 창에서 열기 ↗
      </a>
    </section>
  )
}
