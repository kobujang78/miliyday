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
    avatar_url: string | null
    nickname_updated_at: string | null
    points: number
}

interface AuthContextType {
    user: User | null
    profile: MiliProfile | null
    loading: boolean
    isGuest: boolean
    signInWithGoogle: () => Promise<void>
    signInWithOAuth: (provider: 'google' | 'kakao' | 'apple' | 'github') => Promise<void>
    signInWithEmail: (email: string, password: string) => Promise<{ error: any }>
    signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>
    signOut: () => Promise<void>
    deleteAccount: () => Promise<void>
    setGuestMode: () => void
    refreshProfile: () => Promise<void>
    updateProfile: (updates: Partial<MiliProfile> | { rankOverride: number | null }) => void
}

const AuthContext = createContext<AuthContextType>({
    user: null, profile: null, loading: true, isGuest: false,
    signInWithGoogle: async () => { },
    signInWithOAuth: async () => { },
    signInWithEmail: async () => ({ error: 'Not implemented' }),
    signUpWithEmail: async () => ({ error: 'Not implemented' }),
    signOut: async () => { },
    deleteAccount: async () => { },
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
            .select('id, email, display_name, branch, rank_level, enlist_date, nickname, avatar_url, nickname_updated_at, points')
            .eq('id', userId)
            .single()
        if (data) setProfile(data as MiliProfile)
        return data
    }, [supabase])

    const refreshProfile = useCallback(async () => {
        if (user) await fetchProfile(user.id)
    }, [user, fetchProfile])

    useEffect(() => {
        let authSubscription: any = null

        const initAuth = async () => {
            // 1. Initial guest check
            const guest = localStorage.getItem('mili_guest')
            if (guest === 'true') {
                setIsGuest(true)
                try {
                    const gp = localStorage.getItem('mili_profile')
                    if (gp) {
                        const p = JSON.parse(gp)
                        setProfile({
                            id: 'guest', email: '', display_name: p.name || null,
                            branch: p.branch || 'army', rank_level: p.rank || 1,
                            enlist_date: p.enlistDate || null, nickname: p.name || null,
                            avatar_url: null, nickname_updated_at: null, points: 0,
                        })
                    }
                } catch { }
            }

            // 2. Initial session check
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setIsGuest(false) // If real session exists, disable guest mode
                setUser(session.user)
                await fetchProfile(session.user.id)
            }

            // 3. Listen for changes (ALWAYS)
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (event, session) => {
                    console.log('Auth event:', event, session?.user?.email)
                    if (session?.user) {
                        setIsGuest(false)
                        setUser(session.user)
                        await fetchProfile(session.user.id)
                    } else if (event === 'SIGNED_OUT') {
                        setUser(null)
                        setProfile(null)
                        setIsGuest(false)
                    }
                }
            )
            authSubscription = subscription
            setLoading(false)
        }

        initAuth()

        return () => {
            if (authSubscription) authSubscription.unsubscribe()
        }
    }, [supabase, fetchProfile])

    const signInWithOAuth = async (provider: 'google' | 'kakao' | 'apple' | 'github') => {
        await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            }
        })
    }

    const signInWithGoogle = async () => {
        await signInWithOAuth('google')
    }

    const signInWithEmail = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (data.user) setUser(data.user)
        return { error }
    }

    const signUpWithEmail = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })
        if (data.user) setUser(data.user)
        return { error }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem('mili_guest')
        localStorage.removeItem('mili_profile')
        localStorage.removeItem('mili_onboarded')
        setUser(null)
        setProfile(null)
        setIsGuest(false)
    }
    
    const deleteAccount = async () => {
        if (user) {
            // Delete public.profiles record.
            // Many foreign keys are set to public.profiles.id, so this should trigger cascading
            // or at least remove the user's presence from the app's tables.
            const { error } = await supabase.from('profiles').delete().eq('id', user.id)
            if (error) {
                console.error('Account deletion error:', error)
                throw error
            }
        }
        await signOut()
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
            signInWithGoogle, signInWithOAuth, signInWithEmail, signUpWithEmail, signOut, deleteAccount, setGuestMode, refreshProfile,
            updateProfile,
        }}>
            {children}
        </AuthContext.Provider>
    )
}
