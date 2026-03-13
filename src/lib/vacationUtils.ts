import type { Branch } from '@/components/RankIcon'

/**
 * 휴가 종류
 */
export type VacationType = 'regular' | 'reward' | 'consolation' | 'petition' | 'other'

export const VACATION_TYPES: { value: VacationType; label: string; emoji: string; color: string }[] = [
  { value: 'regular', label: '정기휴가', emoji: '🏖️', color: '#3b82f6' },
  { value: 'reward', label: '포상휴가', emoji: '🏆', color: '#f59e0b' },
  { value: 'consolation', label: '위로휴가', emoji: '💚', color: '#10b981' },
  { value: 'petition', label: '청원휴가', emoji: '📋', color: '#8b5cf6' },
  { value: 'other', label: '기타', emoji: '📌', color: '#6b7280' },
]

/**
 * 군종별 기본 정기휴가 일수
 */
export const DEFAULT_REGULAR_DAYS: Record<Branch, number> = {
  army: 24,
  navy: 24,
  airforce: 24,
  marines: 24,
}

/**
 * 군종별 포상휴가 상한
 */
export const MAX_REWARD_DAYS: Record<Branch, number> = {
  army: 16,
  navy: 17,
  airforce: 18,
  marines: 16,
}

export interface VacationRecord {
  id: string
  type: VacationType
  title: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  days: number
  memo?: string
}

export interface VacationBudget {
  type: VacationType
  total: number
  used: number
  remaining: number
}

const STORAGE_KEY = 'mili_vacation_records'
const BUDGET_KEY = 'mili_vacation_budgets'

/**
 * localStorage에서 휴가 기록을 로드합니다.
 */
export function loadVacationRecords(): VacationRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/**
 * 휴가 기록을 localStorage에 저장합니다.
 */
export function saveVacationRecords(records: VacationRecord[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

/**
 * 휴가 예산(총 일수)을 로드합니다.
 */
export function loadVacationBudgets(branch: Branch): Record<VacationType, number> {
  if (typeof window === 'undefined') return getDefaultBudgets(branch)
  try {
    const raw = localStorage.getItem(BUDGET_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return getDefaultBudgets(branch)
}

export function getDefaultBudgets(branch: Branch): Record<VacationType, number> {
  return {
    regular: DEFAULT_REGULAR_DAYS[branch],
    reward: 0,
    consolation: 0,
    petition: 0,
    other: 0,
  }
}

export function saveVacationBudgets(budgets: Record<VacationType, number>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets))
}

/**
 * 두 날짜 사이의 일수를 계산합니다 (양쪽 포함).
 */
export function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(start)
  const b = new Date(end)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1)
}

/**
 * 사용한 휴가 일수를 종류별로 합산합니다.
 */
export function calcUsedDays(records: VacationRecord[]): Record<VacationType, number> {
  const used: Record<VacationType, number> = { regular: 0, reward: 0, consolation: 0, petition: 0, other: 0 }
  for (const r of records) {
    used[r.type] += r.days
  }
  return used
}

/**
 * 다음 휴가까지 남은 일수를 계산합니다 (등록된 미래 휴가 기준).
 */
export function nextVacationDDay(records: VacationRecord[]): { days: number; record: VacationRecord } | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const future = records
    .filter(r => new Date(r.startDate) > today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  if (future.length === 0) return null
  const next = future[0]
  const diff = Math.ceil((new Date(next.startDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  return { days: diff, record: next }
}
