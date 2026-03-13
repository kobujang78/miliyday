"use client"

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function CallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code')
            const next = searchParams.get('next') ?? '/'

            if (code) {
                const supabase = createClient()
                const { error } = await supabase.auth.exchangeCodeForSession(code)
                if (!error) {
                    router.replace(next)
                    return
                }
            }

            router.replace('/onboarding?error=auth')
        }

        handleCallback()
    }, [router, searchParams])

    return (
        <div style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f4ff',
            fontSize: '18px',
            fontWeight: 700,
            color: '#0f172a'
        }}>
            로그인 중...
        </div>
    )
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CallbackContent />
        </Suspense>
    )
}
