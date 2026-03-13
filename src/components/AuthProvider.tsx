"use client"
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface MiliProfile {
    id: string
    email: string
    display_name: string | null
    branch: string
    rank_level: number
    enlist_date: string | null
    nickname: string | null
}

interface AuthContextType {
    user: User | null
    profile: MiliProfile | null
    loading: boolean
    isGuest: boolean
    signInWithGoogle: () => Promise<void>
    signOut: () => Promise<void>
    setGuestMode: () => void
    refreshProfile: () => Promise<void>
    updateProfile: (updates: Partial<MiliProfile> | { rankOverride: number | null }) => void
}

const AuthContext = createContext<AuthContextType>({
    user: null, profile: null, loading: true, isGuest: false,
    signInWithGoogle: async () => { }, signOut: async () => { },
    setGuestMode: () => { }, refreshProfile: async () => { },
    updateProfile: () => { },
})

export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<MiliProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [isGuest, setIsGuest] = useState(false)

    const supabase = createClient()

    const fetchProfile = useCallback(async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('id, email, display_name, branch, rank_level, enlist_date, nickname')
            .eq('id', userId)
            .single()
        if (data) setProfile(data as MiliProfile)
        return data
    }, [supabase])

    const refreshProfile = useCallback(async () => {
        if (user) await fetchProfile(user.id)
    }, [user, fetchProfile])

    useEffect(() => {
        // Check guest mode
        const guest = localStorage.getItem('mili_guest')
        if (guest === 'true') {
            setIsGuest(true)
            // Load guest profile from localStorage
            try {
                const gp = localStorage.getItem('mili_profile')
                if (gp) {
                    const p = JSON.parse(gp)
                    setProfile({
                        id: 'guest', email: '', display_name: p.name || null,
                        branch: p.branch || 'army', rank_level: p.rank || 1,
                        enlist_date: p.enlistDate || null, nickname: p.name || null,
                    })
                }
            } catch { }
            setLoading(false)
            return
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                } else {
                    setUser(null)
                    setProfile(null)
                }
                setLoading(false)
            }
        )

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user)
                fetchProfile(session.user.id)
            }
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [supabase, fetchProfile])

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem('mili_guest')
        localStorage.removeItem('mili_profile')
        setUser(null)
        setProfile(null)
        setIsGuest(false)
    }

    const setGuestMode = () => {
        localStorage.setItem('mili_guest', 'true')
        setIsGuest(true)
    }

    const updateProfile = useCallback((updates: any) => {
        setProfile(prev => {
            if (!prev) return null
            const next = { ...prev, ...updates }

            // Sync to localStorage for guests or for immediate UI update
            try {
                const s = localStorage.getItem('mili_profile')
                const current = s ? JSON.parse(s) : {}
                localStorage.setItem('mili_profile', JSON.stringify({
                    ...current,
                    name: next.display_name,
                    branch: next.branch,
                    rank: next.rank_level,
                    enlistDate: next.enlist_date,
                    rankOverride: updates.rankOverride !== undefined ? updates.rankOverride : current.rankOverride
                }))
            } catch (e) { console.error('Error syncing profile to localStorage:', e) }

            return next
        })
    }, [])

    return (
        <AuthContext.Provider value={{
            user, profile, loading, isGuest,
            signInWithGoogle, signOut, setGuestMode, refreshProfile,
            updateProfile,
        }}>
            {children}
        </AuthContext.Provider>
    )
}
