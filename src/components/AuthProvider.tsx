"use client"
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { AuthError, Subscription, User } from '@supabase/supabase-js'
import { getPendingRequestCount } from '@/lib/connectionUtils'
import type { UserRole } from '@/types/database'

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
    privacy_policy_agreed: boolean
    terms_agreed: boolean
    marketing_agreed: boolean
    marketing_agreed_at: string | null
    user_type: string
    relationship: string | null
    connected_soldier_id: string | null
    invite_code: string | null
    role: UserRole
}

// 관리자 판정의 단일 출처. 근거는 profiles.role 뿐이며,
// 사용자가 직접 바꿀 수 있는 닉네임·표시 이름은 절대 근거로 삼지 않는다.
export function isAdmin(profile: MiliProfile | null): boolean {
    return profile?.role === 'admin'
}

// role 을 제외한 프로필 컬럼. role 컬럼 마이그레이션 전 폴백 조회에도 그대로 쓴다.
const PROFILE_COLUMNS = 'id, email, display_name, branch, rank_level, enlist_date, nickname, avatar_url, nickname_updated_at, points, privacy_policy_agreed, terms_agreed, marketing_agreed, marketing_agreed_at, user_type, relationship, connected_soldier_id, invite_code'

interface AuthContextType {
    user: User | null
    profile: MiliProfile | null
    loading: boolean
    isGuest: boolean
    signInWithGoogle: () => Promise<void>
    signInWithOAuth: (provider: 'google' | 'kakao' | 'apple' | 'github') => Promise<void>
    signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>
    // needsEmailConfirm: 인증 메일 확인 전이라 세션이 없는 상태. 온보딩을 진행시키면 안 된다.
    signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null; needsEmailConfirm?: boolean }>
    signOut: () => Promise<void>
    deleteAccount: () => Promise<void>
    setGuestMode: () => void
    refreshProfile: () => Promise<void>
    updateProfile: (updates: Partial<MiliProfile> & { rankOverride?: number | null }) => void
    connectedSoldier: Partial<MiliProfile> | null
    pendingRequests: number
    refreshPendingRequests: () => Promise<void>
}

// Provider 밖에서 useAuth() 를 부른 경우에만 반환되는 자리표시자. 실제 AuthError 객체는 아니다.
const NOT_IMPLEMENTED = 'Not implemented' as unknown as AuthError

const AuthContext = createContext<AuthContextType>({
    user: null, profile: null, loading: true, isGuest: false,
    signInWithGoogle: async () => { },
    signInWithOAuth: async () => { },
    signInWithEmail: async () => ({ error: NOT_IMPLEMENTED }),
    signUpWithEmail: async () => ({ error: NOT_IMPLEMENTED, needsEmailConfirm: false }),
    signOut: async () => { },
    deleteAccount: async () => { },
    setGuestMode: () => { },
    refreshProfile: async () => { },
    updateProfile: () => { },
    connectedSoldier: null,
    pendingRequests: 0,
    refreshPendingRequests: async () => { },
})

export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<MiliProfile | null>(null)
    const [connectedSoldier, setConnectedSoldier] = useState<Partial<MiliProfile> | null>(null)
    const [loading, setLoading] = useState(true)
    const [isGuest, setIsGuest] = useState(false)
    const [pendingRequests, setPendingRequests] = useState(0)

    const supabase = createClient()

    const fetchProfile = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select(`${PROFILE_COLUMNS}, role`)
            .eq('id', userId)
            .single()

        // 42703 = undefined_column. role 마이그레이션 적용 전이면 select 전체가 실패해
        // 프로필이 통째로 비어버린다. 이때만 role 없이 다시 읽어 앱을 살리고,
        // 권한은 항상 'user' 로 떨어뜨린다(닉네임 폴백 같은 우회는 두지 않는다).
        if (error?.code === '42703') {
            const { data: legacy } = await supabase
                .from('profiles')
                .select(PROFILE_COLUMNS)
                .eq('id', userId)
                .single()
            if (!legacy) return null
            const fallback = { ...legacy, role: 'user' } as MiliProfile
            setProfile(fallback)
            return fallback
        }

        if (!data) return null
        // 컬럼은 있으나 값이 비어 있는 행도 일반 사용자로 본다.
        const next = { ...data, role: (data as MiliProfile).role ?? 'user' } as MiliProfile
        setProfile(next)
        return next
    }, [supabase])

    useEffect(() => {
        if (profile?.connected_soldier_id) {
            const fetchConnectedSoldier = async () => {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, display_name, branch, rank_level, enlist_date, nickname')
                    .eq('id', profile.connected_soldier_id)
                    .single()
                if (data) setConnectedSoldier(data as Partial<MiliProfile>)
            }
            fetchConnectedSoldier()
        } else {
            // connectedSoldier 는 Supabase 조회로만 채워지는 값이라 렌더 중 파생이 불가능하다.
            // 연결이 끊기면 이 effect 에서 같이 비워야 조회 결과와 상태가 어긋나지 않는다.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setConnectedSoldier(null)
        }
    }, [profile?.connected_soldier_id])

    const refreshProfile = useCallback(async () => {
        if (user) await fetchProfile(user.id)
    }, [user, fetchProfile])

    const refreshPendingRequests = useCallback(async () => {
        if (user && profile?.user_type === 'soldier') {
            const count = await getPendingRequestCount(user.id)
            setPendingRequests(count)
        } else {
            setPendingRequests(0)
        }
    }, [user, profile?.user_type])

    // Fetch pending requests when profile loads/changes
    useEffect(() => {
        // 대기 중인 연결 요청 수는 Supabase 조회 결과라 렌더 중 계산할 수 없다.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        refreshPendingRequests()
    }, [refreshPendingRequests])

    useEffect(() => {
        let authSubscription: Subscription | null = null

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
                            privacy_policy_agreed: true,
                            terms_agreed: true,
                            marketing_agreed: false,
                            marketing_agreed_at: null,
                            user_type: 'soldier', relationship: null,
                            connected_soldier_id: null,
                            invite_code: p.inviteCode || null,
                            role: 'user',
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
        if (error) return { error, needsEmailConfirm: false }

        // 프로젝트 Auth 설정이 mailer_autoconfirm=false 이면 메일 확인 전까지 session 이 null 이다.
        // 이때 user 만 보고 로그인 상태로 처리하면, 이후 profiles 쓰기가 익명 요청이 되어
        // RLS(42501)에 막히고 온보딩이 완주되지 않는다. 세션이 있을 때만 로그인으로 인정한다.
        if (!data.session) return { error: null, needsEmailConfirm: true }

        setUser(data.user)
        return { error: null, needsEmailConfirm: false }
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
            // 정적 내보내기라 클라이언트는 서비스 롤 키를 가질 수 없다.
            // profiles 행만 지우면 auth.users 에 이메일이 남으므로 Edge Function 에 위임한다.
            // 대상 id 는 보내지 않는다. 함수가 JWT 로 본인을 확인하고 본인만 지운다.
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) throw new Error('세션이 만료되어 탈퇴를 진행할 수 없습니다. 다시 로그인해 주세요.')

            const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            if (!baseUrl) throw new Error('탈퇴 요청 주소가 설정되지 않았습니다.')

            let res: Response
            try {
                res = await fetch(`${baseUrl}/functions/v1/delete-account`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                })
            } catch (e) {
                // 네트워크 단절. 조용히 넘기면 탈퇴된 줄 알고 떠나므로 반드시 실패로 알린다.
                console.error('Account deletion request failed:', e)
                throw new Error('탈퇴 요청을 보내지 못했습니다. 네트워크 상태를 확인해 주세요.')
            }

            if (!res.ok) {
                const detail = await res.text().catch(() => '')
                console.error('Account deletion failed:', res.status, detail)
                // 404 는 Edge Function 미배포. 성공으로 처리하면 계정이 남은 채 탈퇴로 오인한다.
                throw new Error(res.status === 404
                    ? '탈퇴 기능이 아직 준비되지 않았습니다(delete-account 미배포).'
                    : `탈퇴 처리에 실패했습니다. (${res.status})`)
            }
        }
        await signOut()
    }

    const setGuestMode = () => {
        localStorage.setItem('mili_guest', 'true')
        setIsGuest(true)
    }

    const updateProfile = useCallback((updates: Partial<MiliProfile> & { rankOverride?: number | null }) => {
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
            user, profile, loading, isGuest, connectedSoldier,
            signInWithGoogle, signInWithOAuth, signInWithEmail, signUpWithEmail, signOut, deleteAccount, setGuestMode, refreshProfile,
            updateProfile, pendingRequests, refreshPendingRequests,
        }}>
            {children}
        </AuthContext.Provider>
    )
}
