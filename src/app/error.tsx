"use client"
import React, { useEffect } from 'react'

/**
 * 전역 에러 바운더리.
 * 이전에는 렌더 중 예외가 나면 흰 화면만 남았다. 최소한 다시 시도할 수단을 준다.
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // 정적 내보내기라 서버 로그가 없다. 콘솔에라도 남겨 원인 추적을 돕는다.
        console.error('Unhandled error:', error)
    }, [error])

    return (
        <div style={{
            minHeight: '60dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px',
            padding: '40px 20px', textAlign: 'center',
        }}>
            <div style={{ fontSize: '48px' }}>🛠️</div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                문제가 발생했습니다
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                일시적인 오류일 수 있습니다.<br />
                다시 시도해도 같은 화면이 나오면 잠시 후 접속해주세요.
            </p>
            {error.digest && (
                <code style={{ fontSize: '11px', color: '#94a3b8' }}>오류코드: {error.digest}</code>
            )}
            <button
                onClick={reset}
                style={{
                    marginTop: '8px', padding: '12px 24px', borderRadius: '12px',
                    border: 'none', background: '#0f172a', color: '#fff',
                    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                }}
            >
                다시 시도
            </button>
        </div>
    )
}
