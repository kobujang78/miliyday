"use client"
import React from 'react'

export type Branch = 'army' | 'navy' | 'airforce' | 'marines' | 'katusa'
export type RankLevel = 1 | 2 | 3 | 4

interface RankIconProps {
    level: RankLevel
    branch?: Branch
    size?: number
    className?: string
}

const branchColors: Record<Branch, { primary: string; secondary: string }> = {
    army: { primary: '#2d5016', secondary: '#4a7c28' },
    navy: { primary: '#1a365d', secondary: '#2b6cb0' },
    airforce: { primary: '#4a1d96', secondary: '#6d28d9' },
    marines: { primary: '#991b1b', secondary: '#dc2626' },
    katusa: { primary: '#967117', secondary: '#c2b280' },
}

/**
 * Korean military enlisted rank insignia.
 * Renders 1-4 horizontal bars in a consistent-width box.
 * Colors vary by branch.
 */
export default function RankIcon({ level, branch = 'army', size = 40, className }: RankIconProps) {
    const colors = branchColors[branch]
    const barCount = level
    const barHeight = size * 0.1
    const barGap = size * 0.08
    const barWidth = size * 0.7
    const totalBarsHeight = barCount * barHeight + (barCount - 1) * barGap
    const startY = (size - totalBarsHeight) / 2
    const startX = (size - barWidth) / 2

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className={className}
            aria-label={`${barCount}줄 계급장`}
        >
            <defs>
                <linearGradient id={`rank-grad-${branch}-${level}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={colors.primary} />
                    <stop offset="100%" stopColor={colors.secondary} />
                </linearGradient>
            </defs>
            {/* Background shield shape */}
            <rect
                x={size * 0.05}
                y={size * 0.05}
                width={size * 0.9}
                height={size * 0.9}
                rx={size * 0.15}
                ry={size * 0.15}
                fill={`url(#rank-grad-${branch}-${level})`}
                opacity={0.12}
            />
            {/* Bars */}
            {Array.from({ length: barCount }).map((_, i) => (
                <rect
                    key={i}
                    x={startX}
                    y={startY + i * (barHeight + barGap)}
                    width={barWidth}
                    height={barHeight}
                    rx={barHeight / 2}
                    fill={`url(#rank-grad-${branch}-${level})`}
                />
            ))}
        </svg>
    )
}

/* Rank metadata */
export const RANKS: { value: RankLevel; label: string }[] = [
    { value: 1, label: '이등병' },
    { value: 2, label: '일병' },
    { value: 3, label: '상병' },
    { value: 4, label: '병장' },
]

export const BRANCHES: { value: Branch; label: string; color: string }[] = [
    { value: 'army', label: '육군', color: '#2d5016' },
    { value: 'navy', label: '해군', color: '#1a365d' },
    { value: 'airforce', label: '공군', color: '#4a1d96' },
    { value: 'marines', label: '해병대', color: '#991b1b' },
    { value: 'katusa', label: '카투사', color: '#967117' },
]

/** Service duration in months per branch (as of current Korean law) */
export const SERVICE_MONTHS: Record<Branch, number> = {
    army: 18,
    navy: 20,
    airforce: 21,
    marines: 18,
    katusa: 18,
}
