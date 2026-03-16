"use client"
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
    href: string
    label: string
    icon: React.ReactNode
    matchPaths: string[]
}

const navItems: NavItem[] = [
    {
        href: '/',
        label: '홈',
        matchPaths: ['/', '/service'],
        icon: <span style={{ fontSize: '20px', lineHeight: 1 }}>🏠</span>,
    },
    {
        href: '/salary',
        label: '월급/적금',
        matchPaths: ['/salary'],
        icon: <span style={{ fontSize: '18px', lineHeight: 1 }}>💰</span>,
    },
    {
        href: '/vacation',
        label: '휴가관리',
        matchPaths: ['/vacation'],
        icon: <span style={{ fontSize: '18px', lineHeight: 1 }}>🗓️</span>,
    },
    {
        href: '/board',
        label: '커뮤니티',
        matchPaths: ['/board'],
        icon: <span style={{ fontSize: '20px', lineHeight: 1 }}>👥</span>,
    },
    {
        href: '/market',
        label: '슬병PX',
        matchPaths: ['/market'],
        icon: <span style={{ fontSize: '20px', lineHeight: 1 }}>🛒</span>,
    },
    {
        href: '/benefits',
        label: '슬병혜택',
        matchPaths: ['/benefits'],
        icon: <span style={{ fontSize: '20px', lineHeight: 1 }}>🎁</span>,
    },
    {
        href: '/share',
        label: '생활공유',
        matchPaths: ['/share'],
        icon: <span style={{ fontSize: '20px', lineHeight: 1 }}>📸</span>,
    },
]


export default function BottomNav() {
    const pathname = usePathname()

    return (
        <nav
            aria-label="메인 내비게이션"
            style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0, zIndex: 50,
                height: '64px',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(0,0,0,0.06)',
                display: 'flex', flexDirection: 'row',
                alignItems: 'center', justifyContent: 'space-around',
                padding: '0 4px',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.04)',
            }}
        >
            {navItems.map((item) => {
                const isActive = item.matchPaths.includes(pathname)
                const isPX = item.label === '슬병PX'

                const handleTabClick = (e: React.MouseEvent) => {
                    if (isPX) {
                        e.preventDefault()
                        alert('준비 중입니다. (업데이트 예정)')
                    }
                }

                return (
                    <Link
                        key={item.href}
                        href={isPX ? '#' : item.href}
                        onClick={handleTabClick}
                        style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: '2px', flex: 1, padding: '6px 0',
                            textDecoration: 'none',
                            color: isActive ? '#0f172a' : '#9ca3af',
                            WebkitTapHighlightColor: 'transparent',
                            cursor: 'pointer', transition: 'color 0.2s',
                        }}
                    >
                        <span style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px',
                            borderRadius: '8px',
                            background: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
                            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            transform: isActive ? 'scale(1.1)' : 'scale(1)',
                        }}>
                            {item.icon}
                        </span>
                        <span style={{
                            fontSize: '9px',
                            fontWeight: isActive ? 700 : 500,
                            letterSpacing: '-0.01em', lineHeight: 1,
                        }}>
                            {item.label}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
