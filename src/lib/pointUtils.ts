import { createClient } from '@/lib/supabase'
import type { PointTransactionRow } from '@/types/database'

/**
 * 밀포인트.
 *
 * 적립·초대보상은 전부 Postgres 함수(SECURITY DEFINER)에서 처리한다.
 * 이 앱은 output: 'export' 라 서버가 없고, 브라우저가 anon key 로 DB 에 직접 붙는다.
 * 따라서 클라이언트에서 원장(point_transactions)에 직접 INSERT 하거나
 * 일일 한도를 검사하는 방식은 신뢰할 수 없다 — 요청을 그대로 위조할 수 있기 때문이다.
 *
 * 이 파일은 이제 RPC 호출 래퍼와 읽기 전용 조회만 담당한다.
 * 실제 규칙(금액, 일일 3회 한도, 자기 초대 차단, 중복 수령 차단)은 DB 안에 있다.
 * supabase/migrations/20260805090000_server_side_points.sql 참고.
 */

// ── 포인트 상수 (표시용) ─────────────────────────────────────────
// 실제 지급 금액의 기준은 DB 함수다. 여기 값은 안내 문구에만 쓴다.
export const POINT_AMOUNTS = {
  SIGNUP_BONUS: 2000,
  INVITE_REWARD: 1000,
  POST_REWARD: 50,
  FEED_REWARD: 30,
} as const

export const DAILY_LIMIT = 3

export type ContentRewardType = 'post_reward' | 'feed_reward'

export interface EarnResult {
  earned: boolean
  points: number
  remaining: number
}

/**
 * 콘텐츠 작성 보상.
 * 대상 사용자를 인자로 받지 않는다 — DB 함수가 auth.uid() 로 호출자 본인에게만 적립한다.
 * 한도 검사와 적립이 한 트랜잭션 안에서 원자적으로 처리되므로 동시 요청으로 우회할 수 없다.
 */
export async function earnContentReward(
  actionType: ContentRewardType,
  referenceId?: string
): Promise<EarnResult> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('earn_content_reward', {
    p_action_type: actionType,
    p_reference_id: referenceId ?? null,
  })

  if (error) {
    console.error('earn_content_reward error:', error)
    return { earned: false, points: 0, remaining: 0 }
  }

  const result = data as EarnResult | null
  return result ?? { earned: false, points: 0, remaining: 0 }
}

export type RedeemReason = 'invalid_code' | 'self_invite' | 'already_redeemed' | 'error'

export interface RedeemResult {
  ok: boolean
  points?: number
  reason?: RedeemReason
}

/** 사용자에게 보여줄 초대코드 실패 사유. */
export const REDEEM_MESSAGES: Record<RedeemReason, string> = {
  invalid_code: '존재하지 않는 초대코드입니다.',
  self_invite: '자신의 초대코드는 사용할 수 없습니다.',
  already_redeemed: '이미 초대코드 보상을 받았습니다.',
  error: '초대코드 처리 중 오류가 발생했습니다.',
}

/**
 * 초대코드 사용.
 * 코드 검증·중복 수령 차단·양쪽 적립을 DB 함수가 한 트랜잭션으로 처리한다.
 */
export async function redeemInviteCode(code: string): Promise<RedeemResult> {
  const trimmed = code.trim().toUpperCase()
  if (trimmed.length < 4) return { ok: false, reason: 'invalid_code' }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('redeem_invite_code', { p_code: trimmed })

  if (error) {
    console.error('redeem_invite_code error:', error)
    return { ok: false, reason: 'error' }
  }
  return (data as RedeemResult | null) ?? { ok: false, reason: 'error' }
}

// ── 읽기 전용 조회 ───────────────────────────────────────────────

export async function getPoints(userId: string): Promise<number> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single()
  return data?.points ?? 0
}

export type PointHistoryItem = Pick<
  PointTransactionRow,
  'id' | 'amount' | 'type' | 'description' | 'created_at'
>

export async function getPointHistory(
  userId: string,
  filter: 'all' | 'earned' | 'spent' = 'all'
): Promise<PointHistoryItem[]> {
  const supabase = createClient()
  let query = supabase
    .from('point_transactions')
    .select('id, amount, type, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (filter === 'earned') query = query.gt('amount', 0)
  if (filter === 'spent') query = query.lt('amount', 0)

  const { data } = await query
  return (data ?? []) as PointHistoryItem[]
}

export async function getInviteStats(userId: string): Promise<{ count: number }> {
  const supabase = createClient()
  const { count } = await supabase
    .from('invite_records')
    .select('*', { count: 'exact', head: true })
    .eq('inviter_id', userId)
  return { count: count ?? 0 }
}

export async function getMyInviteCode(userId: string): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('invite_code')
    .eq('id', userId)
    .single()
  return data?.invite_code ?? ''
}
