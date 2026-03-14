"use client"
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase'
import RankIcon, { RANKS, BRANCHES, type Branch, type RankLevel } from '@/components/RankIcon'

export default function OnboardingPage() {
    const { user, isGuest, signInWithGoogle, signInWithEmail, signUpWithEmail, setGuestMode, refreshProfile } = useAuth()
    const router = useRouter()
    const [step, setStep] = useState<'login' | 'profile'>('login')
    const [authMode, setAuthMode] = useState<'selection' | 'login' | 'signup'>('selection')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [branch, setBranch] = useState<Branch>('army')
    const [rank, setRank] = useState<RankLevel>(1)
    const [enlistDate, setEnlistDate] = useState('')
    const [saving, setSaving] = useState(false)

    // Sync step with auth status
    useEffect(() => {
        if (!user && !isGuest) {
            setStep('login')
        } else {
            setStep('profile')
        }
    }, [user, isGuest])

    const branchColorMap: Record<Branch, string> = {
        army: '#2d5016', navy: '#1a365d', airforce: '#4a1d96', marines: '#991b1b'
    }
    const accentColor = branchColorMap[branch]

    const handleGuestContinue = () => {
        setGuestMode()
        setStep('profile')
    }

    const handleEmailAuth = async () => {
        if (!email || !password) { alert('이메일과 비밀번호를 입력해주세요'); return }
        setSaving(true)
        const { error } = authMode === 'login'
            ? await signInWithEmail(email, password)
            : await signUpWithEmail(email, password)

        if (error) {
            alert(error.message || '인증에 실패했습니다')
            setSaving(false)
        } else {
            if (authMode === 'signup') {
                setStep('profile')
            }
            setSaving(false)
        }
    }

    const handleSave = async () => {
        if (!name.trim()) { alert('이름을 입력해주세요'); return }
        setSaving(true)

        try {
            if (user) {
                // Save to Supabase
                const supabase = createClient()
                const { error } = await supabase.from('profiles').upsert({
                    id: user.id,
                    email: user.email || '',
                    display_name: name,
                    nickname: name,
                    branch,
                    rank_level: rank,
                    enlist_date: enlistDate || null,
                })
                if (error) {
                    console.error('Profile save error:', error)
                    alert('저장 중 오류가 발생했습니다')
                    setSaving(false)
                    return
                }
            }

            // Also save to localStorage for immediate use
            localStorage.setItem('mili_profile', JSON.stringify({
                name, branch, rank, enlistDate
            }))
            localStorage.setItem('mili_onboarded', 'true')

            // Refresh AuthProvider profile so all pages show correct data
            if (user) {
                await refreshProfile()
            }

            router.push('/')
        } catch (e) {
            console.error(e)
            alert('저장 중 오류가 발생했습니다')
        }
        setSaving(false)
    }

    return (
        <div style={{
            minHeight: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            padding: '24px',
        }}>
            <div style={{
                width: '100%', maxWidth: '400px',
                background: 'rgba(255,255,255,0.95)', borderRadius: '24px',
                padding: '32px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(20px)',
                transition: 'all 0.3s ease',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        fontSize: '32px', fontWeight: 900, color: '#0f172a',
                        letterSpacing: '-0.03em',
                    }}>슬기로운 병영생활</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                        군 생활의 든든한 동반자
                    </div>
                </div>

                {step === 'login' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {authMode === 'selection' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <button onClick={() => setAuthMode('login')} style={{
                                    width: '100%', padding: '20px', borderRadius: '16px',
                                    border: 'none', background: '#0f172a',
                                    color: '#fff', fontSize: '17px', fontWeight: 800, cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(15,23,42,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}>
                                    🔑 로그인
                                </button>
                                <button onClick={() => setAuthMode('signup')} style={{
                                    width: '100%', padding: '20px', borderRadius: '16px',
                                    border: '1.5px solid #0f172a', background: '#fff',
                                    color: '#0f172a', fontSize: '17px', fontWeight: 800, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}>
                                    📝 회원가입
                                </button>
                                <div style={{
                                    textAlign: 'center', color: '#9ca3af', fontSize: '12px',
                                    margin: '8px 0', position: 'relative',
                                }}>
                                    <span style={{ background: 'rgba(255,255,255,0.95)', padding: '0 12px', position: 'relative', zIndex: 1 }}>또는</span>
                                    <div style={{
                                        position: 'absolute', top: '50%', left: 0, right: 0,
                                        height: '1px', background: '#e5e7eb',
                                    }} />
                                </div>
                                <button onClick={handleGuestContinue} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px',
                                    border: 'none', background: '#f1f5f9',
                                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                                    color: '#64748b',
                                }}>
                                    로그인 없이 비회원으로 체험하기
                                </button>
                            </div>
                        ) : authMode === 'login' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>로그인</h2>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>이메일 또는 구글로 로그인하세요</p>
                                </div>

                                <button onClick={signInWithGoogle} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px',
                                    border: '1px solid #e5e7eb', background: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                    color: '#0f172a',
                                }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Google로 계속하기
                                </button>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                                    <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>또는 이메일</span>
                                    <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <input
                                        type="email" placeholder="이메일 주소" value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px 16px', border: '1.5px solid #e5e7eb', borderRadius: '12px',
                                            fontSize: '14px', outline: 'none', background: '#f8fafc'
                                        }}
                                    />
                                    <input
                                        type="password" placeholder="비밀번호" value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px 16px', border: '1.5px solid #e5e7eb', borderRadius: '12px',
                                            fontSize: '14px', outline: 'none', background: '#f8fafc'
                                        }}
                                    />
                                    <button onClick={handleEmailAuth} disabled={saving} style={{
                                        width: '100%', padding: '14px', borderRadius: '12px',
                                        border: 'none', background: '#0f172a',
                                        color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                                        opacity: saving ? 0.6 : 1, transition: 'all 0.2s', marginTop: '4px'
                                    }}>
                                        {saving ? '로그인 중...' : '로그인'}
                                    </button>
                                </div>

                                <button onClick={() => setAuthMode('selection')} style={{
                                    background: 'none', border: 'none', color: '#64748b',
                                    fontSize: '13px', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline'
                                }}>
                                    처음으로 돌아가기
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>회원가입</h2>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>새로운 군 생활의 시작을 함께하세요</p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <input
                                        type="email" placeholder="이메일 주소" value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px 16px', border: '1.5px solid #e5e7eb', borderRadius: '12px',
                                            fontSize: '14px', outline: 'none', background: '#f8fafc'
                                        }}
                                    />
                                    <input
                                        type="password" placeholder="비밀번호 (6자 이상)" value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px 16px', border: '1.5px solid #e5e7eb', borderRadius: '12px',
                                            fontSize: '14px', outline: 'none', background: '#f8fafc'
                                        }}
                                    />
                                    <button onClick={handleEmailAuth} disabled={saving} style={{
                                        width: '100%', padding: '14px', borderRadius: '12px',
                                        border: 'none', background: '#0f172a',
                                        color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                                        opacity: saving ? 0.6 : 1, transition: 'all 0.2s', marginTop: '4px'
                                    }}>
                                        {saving ? '가입 진행 중...' : '계정 만들기'}
                                    </button>
                                </div>

                                <button onClick={() => setAuthMode('selection')} style={{
                                    background: 'none', border: 'none', color: '#64748b',
                                    fontSize: '13px', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline'
                                }}>
                                    처음으로 돌아가기
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Profile Setup */}
                        <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>
                            관등성명 입력
                        </h2>

                        {/* 군 선택 */}
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>소속</label>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
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

                        {/* 입대일 */}
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', display: 'block' }}>입대일</label>
                        <input
                            type="date" value={enlistDate} onChange={e => setEnlistDate(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px',
                            }}
                        />

                        {/* 미리보기 */}
                        {name && (
                            <div style={{
                                textAlign: 'center', padding: '12px', borderRadius: '12px',
                                background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}05)`,
                                border: `1px solid ${accentColor}20`, marginBottom: '20px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <RankIcon level={rank} branch={branch} size={24} />
                                    <span style={{ fontSize: '17px', fontWeight: 800, color: accentColor }}>
                                        {RANKS.find(r => r.value === rank)?.label} {name}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                                    {BRANCHES.find(b => b.value === branch)?.label} 병사
                                </div>
                            </div>
                        )}

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
        </div>
    )
}
