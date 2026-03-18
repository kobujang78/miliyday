"use client"
import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase'
import { processInviteReward } from '@/lib/pointUtils'
import RankIcon, { RANKS, BRANCHES, type Branch, type RankLevel } from '@/components/RankIcon'

export default function OnboardingPage() {
    const { user, profile, isGuest, signInWithOAuth, signInWithEmail, signUpWithEmail, setGuestMode, refreshProfile } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [step, setStep] = useState<'splash' | 'login' | 'userType' | 'profile'>('splash')
    const [userType, setUserType] = useState<'soldier' | 'girlfriend' | 'friend' | 'family'>('soldier')
    const [relationship, setRelationship] = useState('')
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [passwordConfirm, setPasswordConfirm] = useState('')
    const [name, setName] = useState('')
    const [nickname, setNickname] = useState('')
    const [branch, setBranch] = useState<Branch>('army')
    const [rank, setRank] = useState<RankLevel>(1)
    const [enlistDate, setEnlistDate] = useState('')
    const [saving, setSaving] = useState(false)
    const [authError, setAuthError] = useState('')
    const [inviteCode, setInviteCode] = useState('')
    const [agreedPrivacy, setAgreedPrivacy] = useState(false)

    // Splash timer
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!user && !isGuest) {
                setStep('login')
            } else if (profile?.privacy_policy_agreed && !isGuest) {
                router.replace('/')
            } else {
                setStep('userType')
                // Pre-fill from Google/Social if available
                if (user?.user_metadata?.full_name || user?.user_metadata?.name) {
                    const fallbackName = user.user_metadata.full_name || user.user_metadata.name
                    if (!name) setName(fallbackName)
                    if (!nickname) setNickname(fallbackName)
                }
            }
        }, 3000)
        return () => clearTimeout(timer)
    }, [user, isGuest, profile, router])

    // Read invite code from URL if present

    // Sync step with auth status (Only when not in splash)
    useEffect(() => {
        if (step === 'splash') return
        
        if (!user && !isGuest) {
            setStep('login')
        } else {
            // If already has profile (agreed to privacy), skip to home
            if (profile?.privacy_policy_agreed && !isGuest) {
                router.replace('/')
                return
            }
            setStep('userType')
            // Pre-fill from Google/Social if available
            if (user?.user_metadata?.full_name || user?.user_metadata?.name) {
                const fallbackName = user.user_metadata.full_name || user.user_metadata.name
                if (!name) setName(fallbackName)
                if (!nickname) setNickname(fallbackName)
            }
        }
    }, [user, isGuest, profile, router, step])

    const branchColorMap: Record<Branch, string> = {
        army: '#2d5016', navy: '#1a365d', airforce: '#4a1d96', marines: '#991b1b', katusa: '#967117'
    }
    const accentColor = branchColorMap[branch]

    const handleGuestContinue = () => {
        setGuestMode()
        setStep('userType')
    }

    const handleEmailAuth = async () => {
        if (!email || !password) { setAuthError('이메일과 비밀번호를 입력해주세요'); return }
        if (authMode === 'signup' && password !== passwordConfirm) {
            setAuthError('비밀번호가 일치하지 않습니다')
            return
        }
        if (authMode === 'signup' && password.length < 6) {
            setAuthError('비밀번호는 6자 이상이어야 합니다')
            return
        }
        setAuthError('')
        setSaving(true)
        const { error } = authMode === 'login'
            ? await signInWithEmail(email, password)
            : await signUpWithEmail(email, password)

        if (error) {
            if (error.message?.includes('Invalid login')) {
                setAuthError('이메일 또는 비밀번호가 올바르지 않습니다')
            } else if (error.message?.includes('already registered')) {
                setAuthError('이미 가입된 이메일입니다. 로그인해주세요.')
            } else {
                setAuthError(error.message || '인증에 실패했습니다')
            }
            setSaving(false)
        } else {
            if (authMode === 'signup') {
                setStep('userType')
            }
            setSaving(false)
        }
    }

    const handleSave = async () => {
        if (!name.trim()) { alert('이름을 입력해주세요'); return }
        if (!agreedPrivacy) { alert('개인정보 처리방침에 동의해주세요'); return }
        setSaving(true)

        try {
            if (user) {
                const supabase = createClient()
                const { error } = await supabase.from('profiles').upsert({
                    id: user.id,
                    email: user.email || '',
                    display_name: name,
                    nickname: nickname.trim() || name,
                    branch: userType === 'soldier' ? branch : 'army',
                    rank_level: userType === 'soldier' ? rank : 1,
                    enlist_date: userType === 'soldier' ? (enlistDate || null) : null,
                    nickname_updated_at: nickname.trim() ? new Date().toISOString() : null,
                    privacy_policy_agreed: true,
                    privacy_policy_agreed_at: new Date().toISOString(),
                    user_type: userType,
                    relationship: userType !== 'soldier' ? relationship : null,
                })
                if (error) {
                    console.error('Profile save error:', error)
                    alert('저장 중 오류가 발생했습니다')
                    setSaving(false)
                    return
                }
            }

            localStorage.setItem('mili_profile', JSON.stringify({
                name, branch: userType === 'soldier' ? branch : 'army', 
                rank: userType === 'soldier' ? rank : 1, 
                enlistDate: userType === 'soldier' ? enlistDate : null,
                userType, relationship
            }))
            localStorage.setItem('mili_onboarded', 'true')

            if (user) {
                await refreshProfile()

                // 초대코드 처리
                if (inviteCode.trim()) {
                    const ok = await processInviteReward(inviteCode.trim(), user.id)
                    if (ok) {
                        alert('🎉 초대코드 적용! 2,000P가 적립되었습니다!')
                    }
                }
            }

            router.push('/')
        } catch (e) {
            console.error(e)
            alert('저장 중 오류가 발생했습니다')
        }
        setSaving(false)
    }

    // Shared input style
    const inputStyle = {
        width: '100%', padding: '13px 16px', border: '1.5px solid #e5e7eb', borderRadius: '12px',
        fontSize: '14px', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' as const,
        transition: 'border-color 0.2s',
    }

    return (
        <div style={{
            minHeight: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            padding: '24px',
        }}>
            <style>{`
                @keyframes splashFadeIn {
                    from { opacity: 0; transform: scale(1.05); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes splashFadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .splash-container {
                    animation: splashFadeIn 1.5s ease-out forwards;
                    display: flex;
                    flex-direction: column;
                    alignItems: center;
                    justifyContent: center;
                    text-align: center;
                }
                .hero-full {
                    width: 100%;
                    max-width: 320px;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                    margin-bottom: 24px;
                }
            `}</style>

            {step === 'splash' ? (
                <div className="splash-container">
                    <img src="/images/hero.jpg" alt="슬기로운 병영생활" className="hero-full" />
                    <div style={{
                        color: '#fff',
                        fontSize: '24px',
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                        슬기로운 병영생활
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginTop: '8px' }}>
                        군 생활의 든든한 동반자
                    </div>
                </div>
            ) : (
                <div style={{
                    width: '100%', maxWidth: '400px',
                    background: 'rgba(255,255,255,0.97)', borderRadius: '24px',
                    padding: '36px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(20px)',
                    transition: 'all 0.3s ease',
                    animation: 'splashFadeIn 0.5s ease-out'
                }}>
                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: step === 'login' ? '28px' : '24px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎖️</div>
                        <div style={{
                            fontSize: '28px', fontWeight: 900, color: '#0f172a',
                            letterSpacing: '-0.03em',
                        }}>슬기로운 병영생활</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                            군 생활의 든든한 동반자
                        </div>
                    </div>

                {step === 'login' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                        {/* ── 로그인/회원가입 탭 ── */}
                        <div style={{
                            display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '3px',
                            marginBottom: '4px',
                        }}>
                            {(['login', 'signup'] as const).map(mode => (
                                <button key={mode} onClick={() => { setAuthMode(mode); setAuthError('') }} style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                                    background: authMode === mode ? '#fff' : 'transparent',
                                    color: authMode === mode ? '#0f172a' : '#9ca3af',
                                    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                                    boxShadow: authMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                    transition: 'all 0.2s',
                                }}>
                                    {mode === 'login' ? '로그인' : '회원가입'}
                                </button>
                            ))}
                        </div>

                        {/* ── 소셜 로그인 버튼들 ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Google */}
                            <button onClick={() => signInWithOAuth('google')} style={{
                                width: '100%', padding: '13px', borderRadius: '12px',
                                border: '1px solid #e5e7eb', background: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                color: '#0f172a', transition: 'all 0.2s',
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Google로 {authMode === 'login' ? '로그인' : '가입'}
                            </button>

                            {/* Kakao */}
                            <button onClick={() => alert('준비 중입니다.')} style={{
                                width: '100%', padding: '13px', borderRadius: '12px',
                                border: 'none', background: '#FEE500',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                                color: '#191919', transition: 'all 0.2s',
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#191919">
                                    <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.72 1.8 5.106 4.5 6.453-.199.744-.722 2.694-.827 3.112-.128.51.187.503.393.366.162-.107 2.576-1.753 3.62-2.462.743.104 1.507.16 2.314.16 5.523 0 10-3.463 10-7.629S17.523 3 12 3z" />
                                </svg>
                                카카오로 {authMode === 'login' ? '로그인' : '가입'}
                            </button>

                            {/* Apple */}
                            <button onClick={() => alert('준비 중입니다.')} style={{
                                width: '100%', padding: '13px', borderRadius: '12px',
                                border: 'none', background: '#000',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                                color: '#fff', transition: 'all 0.2s',
                            }}>
                                <svg width="16" height="18" viewBox="0 0 16 20" fill="#fff">
                                    <path d="M13.34 10.18c-.03-2.31 1.89-3.42 1.97-3.47-1.07-1.57-2.74-1.78-3.34-1.81-1.42-.14-2.77.84-3.49.84-.72 0-1.83-.82-3.01-.8-1.55.02-2.98.9-3.78 2.28-1.61 2.8-.41 6.95 1.16 9.22.77 1.11 1.69 2.37 2.9 2.32 1.16-.05 1.6-.75 3-.75 1.39 0 1.79.75 3.01.73 1.25-.02 2.05-1.13 2.81-2.25.89-1.29 1.25-2.54 1.27-2.6-.03-.01-2.44-.94-2.47-3.71zM11.05 3.28c.64-.78 1.07-1.86.96-2.94-.92.04-2.03.61-2.69 1.39-.59.68-1.1 1.77-.96 2.81 1.03.08 2.07-.52 2.69-1.26z" />
                                </svg>
                                Apple로 {authMode === 'login' ? '로그인' : '가입'}
                            </button>

                            {/* GitHub */}
                            <button onClick={() => alert('준비 중입니다.')} style={{
                                width: '100%', padding: '13px', borderRadius: '12px',
                                border: '1px solid #d1d5db', background: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                                color: '#24292f', transition: 'all 0.2s',
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#24292f">
                                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                                </svg>
                                GitHub로 {authMode === 'login' ? '로그인' : '가입'}
                            </button>
                        </div>

                        {/* ── 구분선 ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
                            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>또는 이메일</span>
                            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                        </div>

                        {/* ── 이메일/비밀번호 입력 ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input
                                type="email" placeholder="이메일 주소" value={email}
                                onChange={e => { setEmail(e.target.value); setAuthError('') }}
                                onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                                style={inputStyle}
                            />
                            <input
                                type="password"
                                placeholder={authMode === 'signup' ? '비밀번호 (6자 이상)' : '비밀번호'}
                                value={password}
                                onChange={e => { setPassword(e.target.value); setAuthError('') }}
                                onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                                style={inputStyle}
                            />
                            {authMode === 'signup' && (
                                <input
                                    type="password"
                                    placeholder="비밀번호 확인"
                                    value={passwordConfirm}
                                    onChange={e => { setPasswordConfirm(e.target.value); setAuthError('') }}
                                    onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                                    style={inputStyle}
                                />
                            )}

                            {/* Error message */}
                            {authError && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: '10px',
                                    background: '#fef2f2', border: '1px solid #fee2e2',
                                    color: '#dc2626', fontSize: '12px', fontWeight: 600,
                                }}>⚠️ {authError}</div>
                            )}

                            <button onClick={handleEmailAuth} disabled={saving} style={{
                                width: '100%', padding: '14px', borderRadius: '12px',
                                border: 'none', background: '#0f172a',
                                color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                                opacity: saving ? 0.6 : 1, transition: 'all 0.2s',
                            }}>
                                {saving
                                    ? (authMode === 'login' ? '로그인 중...' : '가입 진행 중...')
                                    : (authMode === 'login' ? '이메일로 로그인' : '이메일로 가입하기')
                                }
                            </button>
                        </div>

                        {/* ── 게스트 모드 ── */}
                        <div style={{
                            textAlign: 'center', color: '#9ca3af', fontSize: '12px',
                            margin: '8px 0 0', position: 'relative',
                        }}>
                            <span style={{ background: 'rgba(255,255,255,0.97)', padding: '0 12px', position: 'relative', zIndex: 1 }}>또는</span>
                            <div style={{
                                position: 'absolute', top: '50%', left: 0, right: 0,
                                height: '1px', background: '#e5e7eb',
                            }} />
                        </div>
                        <button onClick={handleGuestContinue} style={{
                            width: '100%', padding: '13px', borderRadius: '12px',
                            border: 'none', background: '#f1f5f9',
                            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                            color: '#64748b', transition: 'all 0.2s',
                        }}>
                            로그인 없이 비회원으로 체험하기
                        </button>

                        {/* ── 안내 문구 ── */}
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>
                            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
                                {authMode === 'login'
                                    ? <>아직 계정이 없으신가요? <button onClick={() => { setAuthMode('signup'); setAuthError('') }} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', fontSize: '11px', padding: 0, textDecoration: 'underline' }}>회원가입</button></>
                                    : <>이미 계정이 있으신가요? <button onClick={() => { setAuthMode('login'); setAuthError('') }} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', fontSize: '11px', padding: 0, textDecoration: 'underline' }}>로그인</button></>
                                }
                            </p>
                        </div>
                    </div>
                ) : step === 'userType' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>
                            당신은 누구신가요?
                        </h2>
                        <p style={{ margin: '-10px 0 10px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                            신분에 따라 최적화된 서비스를 제공해 드립니다.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {[
                                { id: 'soldier', label: '현역병', icon: '🎖️', desc: '군 복무 중인 용사' },
                                { id: 'girlfriend', label: '여자친구', icon: '💝', desc: '든든한 곰신' },
                                { id: 'family', label: '가족', icon: '🏠', desc: '자랑스러운 아들/형제' },
                                { id: 'friend', label: '친구', icon: '🤝', desc: '늘 응원하는 전우/친구' },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setUserType(t.id as any)}
                                    style={{
                                        padding: '20px 10px', borderRadius: '16px', border: '2px solid',
                                        borderColor: userType === t.id ? '#2563eb' : '#f1f5f9',
                                        background: userType === t.id ? '#eff6ff' : '#fff',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    <span style={{ fontSize: '32px' }}>{t.icon}</span>
                                    <span style={{ fontSize: '15px', fontWeight: 800, color: userType === t.id ? '#1e40af' : '#475569' }}>{t.label}</span>
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{t.desc}</span>
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => setStep('profile')}
                            style={{
                                width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
                                background: '#0f172a', color: '#fff', fontSize: '15px', fontWeight: 800,
                                cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 12px rgba(15,23,42,0.2)'
                            }}
                        >
                            선택 완료
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Profile Setup */}
                        <h2 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>
                            {userType === 'soldier' ? '관등성명 입력' : '내 정보 입력'}
                        </h2>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                            <div style={{ 
                                background: '#f1f5f9', color: '#64748b', padding: '4px 12px', 
                                borderRadius: '20px', fontSize: '12px', fontWeight: 700 
                            }}>
                                {userType === 'soldier' ? '🎖️ 현역병' : 
                                 userType === 'girlfriend' ? '💝 여자친구' : 
                                 userType === 'family' ? '🏠 가족' : '🤝 친구'}
                            </div>
                            <button 
                                onClick={() => setStep('userType')}
                                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                변경하기
                            </button>
                        </div>

                        {userType === 'soldier' && (
                            <>
                                {/* 군 선택 */}
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>소속</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '16px' }}>
                                    {BRANCHES.map(b => (
                                        <button key={b.value} onClick={() => setBranch(b.value)} style={{
                                            flex: 1, padding: '8px 0', border: `2px solid ${branch === b.value ? b.color : '#e5e7eb'}`,
                                            borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                            background: branch === b.value ? `${b.color}12` : '#f8fafc', color: b.color,
                                            transition: 'all 0.2s',
                                        }}>{b.label}</button>
                                    ))}
                                </div>

                                {/* 계급 선택 */}
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>계급</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                                    {RANKS.map(r => {
                                        const isActive = rank === r.value
                                        return (
                                            <button key={r.value} onClick={() => setRank(r.value)} style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                                padding: '10px 4px', border: `2px solid ${isActive ? accentColor : '#e5e7eb'}`,
                                                borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                                                background: isActive ? `${accentColor}10` : '#fafbff', color: '#0f172a',
                                            }}>
                                                <RankIcon level={r.value} branch={branch} size={28} />
                                                <span style={{ fontSize: '11px', fontWeight: 600 }}>{r.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}

                        {/* 이름 */}
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>이름</label>
                        <input
                            type="text" placeholder="이름을 입력하세요" value={name}
                            onChange={e => setName(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px',
                            }}
                            onFocus={e => e.target.style.borderColor = accentColor}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                        />

                        {/* 닉네임 */}
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>닉네임</label>
                        <input
                            type="text" placeholder="닉네임을 입력하세요 (미입력시 성명 사용)" value={nickname}
                            onChange={e => setNickname(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px',
                            }}
                            onFocus={e => e.target.style.borderColor = accentColor}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                        />

                        {/* 입대일 */}
                        {userType === 'soldier' && (
                            <>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>입대일</label>
                                <input
                                    type="date" value={enlistDate} onChange={e => setEnlistDate(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                        fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px',
                                    }}
                                />
                            </>
                        )}

                        {/* 관계 선택 (현역병 아닐 때) */}
                        {userType !== 'soldier' && (
                            <>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>관련 용사와의 관계 (선택)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '16px' }}>
                                    {['애인', '부모', '형제/자매', '친구', '전우', '기타'].map(rel => (
                                        <button key={rel} onClick={() => setRelationship(rel)} style={{
                                            padding: '8px 0', border: `2px solid ${relationship === rel ? '#3b82f6' : '#e5e7eb'}`,
                                            borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                            background: relationship === rel ? '#eff6ff' : '#f8fafc', color: relationship === rel ? '#1e40af' : '#6b7280',
                                            transition: 'all 0.2s',
                                        }}>{rel}</button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* 초대코드 */}
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>초대코드 (선택)</label>
                        <input
                            type="text" placeholder="초대코드가 있다면 입력해주세요 (예: MILI-A3K9)"
                            value={inviteCode}
                            onChange={e => setInviteCode(e.target.value.toUpperCase())}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px',
                                letterSpacing: '0.05em',
                            }}
                        />
                        {name && (
                            <div style={{
                                textAlign: 'center', padding: '12px', borderRadius: '12px',
                                background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}05)`,
                                border: `1px solid ${accentColor}20`, marginBottom: '20px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <RankIcon level={userType === 'soldier' ? rank : 1} branch={userType === 'soldier' ? branch : 'army'} size={24} />
                                    <span style={{ fontSize: '17px', fontWeight: 800, color: userType === 'soldier' ? accentColor : '#0f172a' }}>
                                        {userType === 'soldier' ? `${RANKS.find(r => r.value === rank)?.label} ` : ''}{name}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                                    {userType === 'soldier' ? `${BRANCHES.find(b => b.value === branch)?.label} 용사` : 
                                     userType === 'girlfriend' ? '든든한 곰신' : 
                                     userType === 'family' ? '소중한 가족' : '응원하는 친구'}
                                </div>
                            </div>
                        )}

                        {/* 개인정보 동의 */}
                        <div 
                            onClick={() => setAgreedPrivacy(!agreedPrivacy)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '12px', borderRadius: '12px', background: '#f8fafc',
                                border: `1.5px solid ${agreedPrivacy ? accentColor : '#e5e7eb'}`,
                                cursor: 'pointer', marginBottom: '20px', transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: '20px', height: '20px', borderRadius: '4px',
                                border: `2px solid ${agreedPrivacy ? accentColor : '#cbd5e1'}`,
                                background: agreedPrivacy ? accentColor : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: '14px',
                            }}>
                                {agreedPrivacy && '✓'}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>개인정보 처리방침 동의 (필수)</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>서비스 이용을 위해 개인정보 수집 및 이용에 동의합니다</div>
                            </div>
                        </div>

                        {/* 저장 버튼 */}
                        <button onClick={handleSave} disabled={saving} style={{
                            width: '100%', padding: '14px', borderRadius: '12px',
                            border: 'none', background: accentColor,
                            color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                            boxShadow: `0 4px 14px ${accentColor}40`,
                            opacity: saving ? 0.6 : 1,
                        }}>
                            {saving ? '저장 중...' : '시작하기'}
                        </button>
                    </>
                )}
            </div>
        )}
        </div>
    )
}
