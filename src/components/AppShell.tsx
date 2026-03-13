"use client"
import React, { useEffect, useState, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import BottomNav from '@/components/BottomNav'
import RankIcon, { type Branch, type RankLevel } from '@/components/RankIcon'
import { calcAutoRank, RANK_LABELS } from '@/lib/rankUtils'

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const { user, profile, loading, isGuest } = useAuth()
    const [checked, setChecked] = useState(false)

    const isOnboarding = pathname === '/onboarding'
    const isCallback = pathname.startsWith('/auth/')

    useEffect(() => {
        if (loading) return
        if (isOnboarding || isCallback) { setChecked(true); return }
        const onboarded = localStorage.getItem('mili_onboarded')
        if (!user && !isGuest && !onboarded) { router.replace('/onboarding'); return }
        setChecked(true)
    }, [loading, user, isGuest, isOnboarding, isCallback, router])

    // Derive header profile data from AuthProvider's profile (single source of truth)
    const headerProfile = useMemo(() => {
        if (!profile) return null
        const branch = (profile.branch as Branch) || 'army'
        const enlistDate = profile.enlist_date || ''
        const autoRank = enlistDate ? calcAutoRank(enlistDate, branch) : (profile.rank_level as RankLevel || 1)
        return {
            name: profile.display_name || '',
            branch,
            rank: autoRank as RankLevel,
        }
    }, [profile])

    if (loading || (!checked && !isOnboarding && !isCallback)) {
        return (
            <div style={{
                minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#f0f4ff',
            }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>슬기로운 병영생활</div>
            </div>
        )
    }

    if (isOnboarding || isCallback) return <>{children}</>

    const branchColor = headerProfile ? ({
        army: '#2d5016', navy: '#1a365d', airforce: '#4a1d96', marines: '#991b1b'
    }[headerProfile.branch]) : '#0f172a'

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f0f4ff' }}>
            <header style={{
                position: 'sticky', top: 0, zIndex: 40,
                background: '#ffffff', borderBottom: '1px solid #e5e7eb',
                padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <h1 style={{
                    margin: 0, fontSize: '18px', fontWeight: 700,
                    color: '#0f172a', letterSpacing: '-0.02em',
                }}>슬기로운 병영생활</h1>

                {headerProfile && headerProfile.name ? (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px 4px 6px',
                        background: `${branchColor}0a`, borderRadius: '20px',
                        border: `1px solid ${branchColor}18`,
                    }}>
                        <RankIcon level={headerProfile.rank} branch={headerProfile.branch} size={22} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: branchColor }}>
                            {RANK_LABELS[headerProfile.rank]} {headerProfile.name}
                        </span>
                    </div>
                ) : (
                    <button
                        onClick={() => router.push('/onboarding')}
                        style={{
                            fontSize: '12px', fontWeight: 700, color: '#2d5016',
                            background: '#2d50160a', border: '1px solid #2d501618',
                            padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                        }}
                    >
                        로그인
                    </button>
                )}
            </header>

            <main style={{ flex: 1, padding: '16px 16px 80px', maxWidth: '100%', overflowX: 'hidden' }}>
                {children}
            </main>

            <BottomNav />
        </div>
    )
}
