import type { Branch, RankLevel } from '@/components/RankIcon'
import { SERVICE_MONTHS } from '@/components/RankIcon'
import { PROMOTION_MONTHS } from '@/lib/rankUtils'

/**
 * 2026년 기준 병사 월급 (원)
 */
export const SALARY_BY_RANK: Record<RankLevel, number> = {
  1: 750000,   // 이병
  2: 960000,   // 일병
  3: 1200000,  // 상병
  4: 1500000,  // 병장
}

/**
 * 장병내일준비적금 상수
 */
export const SAVINGS = {
  MIN_MONTHLY: 50000,       // 최소 월 납입액
  MAX_MONTHLY: 550000,      // 최대 월 납입액
  STEP: 50000,              // 납입 단위
  BASE_RATE: 0.05,          // 기본 금리 (연 5%)
  MATCHING_RATIO: 1.0,      // 정부 매칭 비율 (100%)
  TAX_FREE: true,           // 비과세
}

export interface MonthlyEntry {
  month: number         // 0-indexed from enlistment
  date: Date            // start of month
  rank: RankLevel
  salary: number
  label: string         // "2026.03"
}

/**
 * 입대일~전역일까지 월별 월급 데이터를 생성합니다.
 */
export function calcMonthlySalaries(enlistDate: string, branch: Branch): MonthlyEntry[] {
  if (!enlistDate) return []
  const enlist = new Date(enlistDate)
  const totalMonths = SERVICE_MONTHS[branch]
  const promo = PROMOTION_MONTHS[branch]
  const entries: MonthlyEntry[] = []

  for (let m = 0; m < totalMonths; m++) {
    const d = new Date(enlist)
    d.setMonth(d.getMonth() + m)

    let rank: RankLevel = 1
    if (m >= promo.toSergeant) rank = 4
    else if (m >= promo.toCorporal) rank = 3
    else if (m >= promo.toPrivate1) rank = 2

    entries.push({
      month: m,
      date: d,
      rank,
      salary: SALARY_BY_RANK[rank],
      label: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }

  return entries
}

/**
 * 총 복무기간 동안의 월급 합산
 */
export function calcTotalSalary(entries: MonthlyEntry[]): number {
  return entries.reduce((sum, e) => sum + e.salary, 0)
}

export interface SavingsResult {
  monthlyDeposit: number      // 월 납입액
  totalMonths: number         // 총 납입 개월
  totalPrincipal: number      // 본인 납입 원금 합계
  matchingAmount: number      // 정부 매칭지원금
  interest: number            // 이자 (비과세)
  totalAmount: number         // 만기 수령 총액
}

/**
 * 장병내일준비적금 수익을 계산합니다.
 * 단리 기준, 비과세 적용.
 */
export function calcSavings(monthlyDeposit: number, totalServiceMonths: number): SavingsResult {
  const months = totalServiceMonths
  const totalPrincipal = monthlyDeposit * months
  const matchingAmount = totalPrincipal * SAVINGS.MATCHING_RATIO

  // 단리 이자 계산 (각 납입분의 잔여 개월에 대해)
  let interest = 0
  for (let m = 0; m < months; m++) {
    const remainingMonths = months - m
    interest += monthlyDeposit * (SAVINGS.BASE_RATE / 12) * remainingMonths
  }
  // 매칭금에 대한 이자도 동일하게 계산
  let matchingInterest = 0
  for (let m = 0; m < months; m++) {
    const remainingMonths = months - m
    matchingInterest += monthlyDeposit * SAVINGS.MATCHING_RATIO * (SAVINGS.BASE_RATE / 12) * remainingMonths
  }
  interest = Math.round(interest + matchingInterest)

  return {
    monthlyDeposit,
    totalMonths: months,
    totalPrincipal,
    matchingAmount,
    interest,
    totalAmount: totalPrincipal + matchingAmount + interest,
  }
}
