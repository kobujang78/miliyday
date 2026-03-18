import type { Branch, RankLevel } from '@/components/RankIcon'

/**
 * Korean military standard promotion schedule (months from enlistment)
 * 이등병→일병: 3개월, 일병→상병: 7개월, 상병→병장: 7개월
 * Total differs by branch but promotion timeline is the same.
 */
export const PROMOTION_MONTHS: Record<Branch, { toPrivate1: number; toCorporal: number; toSergeant: number }> = {
    army: { toPrivate1: 2, toCorporal: 8, toSergeant: 14 },
    navy: { toPrivate1: 2, toCorporal: 8, toSergeant: 14 },
    airforce: { toPrivate1: 2, toCorporal: 8, toSergeant: 14 },
    marines: { toPrivate1: 2, toCorporal: 8, toSergeant: 14 },
    katusa: { toPrivate1: 2, toCorporal: 8, toSergeant: 14 },
}

/**
 * Calculate auto-rank based on enlistment date and branch.
 * Returns the rank level (1-4) that the soldier should be at.
 */
export function calcAutoRank(enlistDate: string, branch: Branch): RankLevel {
    if (!enlistDate) return 1
    const enlist = new Date(enlistDate)
    const now = new Date()

    // Months elapsed since enlistment
    const months = (now.getFullYear() - enlist.getFullYear()) * 12
        + (now.getMonth() - enlist.getMonth())
        + (now.getDate() >= enlist.getDate() ? 0 : -1)

    if (months < 0) return 1

    const p = PROMOTION_MONTHS[branch]
    if (months >= p.toSergeant) return 4  // 병장
    if (months >= p.toCorporal) return 3  // 상병
    if (months >= p.toPrivate1) return 2  // 일병
    return 1 // 이등병
}

/** Labels for ranks */
export const RANK_LABELS: Record<RankLevel, string> = {
    1: '이등병',
    2: '일병',
    3: '상병',
    4: '병장',
}

/**
 * Get promotion dates for all ranks given an enlistment date.
 */
export function getPromotionDates(enlistDate: string, branch: Branch) {
    if (!enlistDate) return null
    const enlist = new Date(enlistDate)
    const p = PROMOTION_MONTHS[branch]

    const addMonths = (d: Date, m: number) => {
        const result = new Date(d)
        result.setMonth(result.getMonth() + m)
        return result
    }

    return {
        private2: enlist,
        private1: addMonths(enlist, p.toPrivate1),
        corporal: addMonths(enlist, p.toCorporal),
        sergeant: addMonths(enlist, p.toSergeant),
    }
}
