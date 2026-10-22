"use client"
import { useState } from 'react'

const PX_GUIDE_URL = 'https://pxguide.zeromorow.chatgpt.site'

export default function MarketPage() {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <section style={{
      position: 'relative',
      width: '100%',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      background: '#f8fafc',
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
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          border: 0,
          background: '#fff',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      />

    </section>
  )
}
