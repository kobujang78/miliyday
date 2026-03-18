import type { Branch } from '@/components/RankIcon'
import { createClient } from '@/lib/supabase'

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
  katusa: 24,
}

/**
 * 군종별 포상휴가 상한
 */
export const MAX_REWARD_DAYS: Record<Branch, number> = {
  army: 16,
  navy: 17,
  airforce: 18,
  marines: 16,
  katusa: 16,
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

// ── Supabase-backed CRUD ──

export async function loadVacationRecords(userId?: string): Promise<VacationRecord[]> {
  if (!userId) return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vacation_records')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: true })

  if (error || !data) return []
  return data.map(r => ({
    id: r.id,
    type: r.type as VacationType,
    title: r.title,
    startDate: r.start_date,
    endDate: r.end_date,
    days: r.days,
    memo: r.memo || undefined,
  }))
}

export async function addVacationRecord(userId: string, record: Omit<VacationRecord, 'id'>): Promise<VacationRecord | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vacation_records')
    .insert({
      user_id: userId,
      type: record.type,
      title: record.title,
      start_date: record.startDate,
      end_date: record.endDate,
      days: record.days,
      memo: record.memo || null,
    })
    .select()
    .single()

  if (error || !data) return null
  return {
    id: data.id,
    type: data.type as VacationType,
    title: data.title,
    startDate: data.start_date,
    endDate: data.end_date,
    days: data.days,
    memo: data.memo || undefined,
  }
}

export async function deleteVacationRecord(recordId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('vacation_records')
    .delete()
    .eq('id', recordId)
  return !error
}

// ── Vacation Budgets ──

export function getDefaultBudgets(branch: Branch): Record<VacationType, number> {
  return {
    regular: DEFAULT_REGULAR_DAYS[branch],
    reward: 0,
    consolation: 0,
    petition: 0,
    other: 0,
  }
}

export async function loadVacationBudgets(userId: string | undefined, branch: Branch): Promise<Record<VacationType, number>> {
  if (!userId) return getDefaultBudgets(branch)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vacation_budgets')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return getDefaultBudgets(branch)
  return {
    regular: data.regular,
    reward: data.reward,
    consolation: data.consolation,
    petition: data.petition,
    other: data.other,
  }
}

export async function saveVacationBudgets(userId: string, budgets: Record<VacationType, number>): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('vacation_budgets')
    .upsert({
      user_id: userId,
      regular: budgets.regular,
      reward: budgets.reward,
      consolation: budgets.consolation,
      petition: budgets.petition,
      other: budgets.other,
    }, { onConflict: 'user_id' })
  return !error
}

// ── Pure utility functions (unchanged) ──

export function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(start)
  const b = new Date(end)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1)
}

export function calcUsedDays(records: VacationRecord[]): Record<VacationType, number> {
  const used: Record<VacationType, number> = { regular: 0, reward: 0, consolation: 0, petition: 0, other: 0 }
  for (const r of records) {
    used[r.type] += r.days
  }
  return used
}

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
