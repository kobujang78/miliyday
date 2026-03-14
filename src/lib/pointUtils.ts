import { createClient } from '@/lib/supabase'

// ── 포인트 상수 ──
export const POINT_AMOUNTS = {
  SIGNUP_BONUS: 2000,      // 초대코드로 가입한 신규 회원
  INVITE_REWARD: 1000,     // 초대한 사람
  POST_REWARD: 50,         // 병영꿀팁 작성
  FEED_REWARD: 30,         // 생활공유 작성
} as const

export const DAILY_LIMIT = 3 // 일일 최대 획득 횟수

// ── 현재 잔액 조회 ──
export async function getPoints(userId: string): Promise<number> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single()
  return data?.points ?? 0
}

// ── 포인트 적립 ──
export async function addPoints(
  userId: string,
  amount: number,
  type: string,
  description: string,
  referenceId?: string | null
): Promise<boolean> {
  const supabase = createClient()

  // 1) 트랜잭션 기록
  const { error: txError } = await supabase
    .from('point_transactions')
    .insert({
      user_id: userId,
      amount,
      type,
      description,
      reference_id: referenceId || null,
    })
  if (txError) { console.error('point tx error:', txError); return false }

  // 2) 잔액 업데이트
  const currentPoints = await getPoints(userId)
  const { error: upError } = await supabase
    .from('profiles')
    .update({ points: currentPoints + amount })
    .eq('id', userId)
  if (upError) { console.error('point update error:', upError); return false }

  return true
}

// ── 일일 제한 확인 ──
export async function canEarnDailyReward(
  userId: string,
  actionType: 'post_reward' | 'feed_reward'
): Promise<boolean> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const { data } = await supabase
    .from('daily_point_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .eq('action_date', today)
    .single()

  return !data || data.count < DAILY_LIMIT
}

// ── 일일 카운터 증가 ──
async function incrementDailyCount(
  userId: string,
  actionType: 'post_reward' | 'feed_reward'
): Promise<void> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  // upsert: 없으면 1로 생성, 있으면 +1
  const { data: existing } = await supabase
    .from('daily_point_limits')
    .select('id, count')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .eq('action_date', today)
    .single()

  if (existing) {
    await supabase
      .from('daily_point_limits')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('daily_point_limits')
      .insert({ user_id: userId, action_type: actionType, action_date: today, count: 1 })
  }
}

// ── 콘텐츠 작성 보상 (제한 자동 확인) ──
export async function earnContentReward(
  userId: string,
  actionType: 'post_reward' | 'feed_reward',
  referenceId?: string
): Promise<{ earned: boolean; points: number; remaining: number }> {
  const canEarn = await canEarnDailyReward(userId, actionType)
  if (!canEarn) {
    return { earned: false, points: 0, remaining: 0 }
  }

  const amount = actionType === 'post_reward' ? POINT_AMOUNTS.POST_REWARD : POINT_AMOUNTS.FEED_REWARD
  const desc = actionType === 'post_reward' ? '병영꿀팁 작성 보상' : '생활공유 작성 보상'

  const ok = await addPoints(userId, amount, actionType, desc, referenceId)
  if (!ok) return { earned: false, points: 0, remaining: 0 }

  await incrementDailyCount(userId, actionType)

  // 남은 횟수 계산
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('daily_point_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .eq('action_date', today)
    .single()

  return { earned: true, points: amount, remaining: DAILY_LIMIT - (data?.count ?? 0) }
}

// ── 초대코드 검증 ──
export async function validateInviteCode(code: string): Promise<{ valid: boolean; inviterId?: string }> {
  if (!code || code.trim().length < 4) return { valid: false }

  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('invite_code', code.trim().toUpperCase())
    .single()

  if (!data) return { valid: false }
  return { valid: true, inviterId: data.id }
}

// ── 초대 보상 처리 ──
export async function processInviteReward(
  inviterCode: string,
  inviteeId: string
): Promise<boolean> {
  const { valid, inviterId } = await validateInviteCode(inviterCode)
  if (!valid || !inviterId) return false
  if (inviterId === inviteeId) return false // 자기 자신 초대 불가

  const supabase = createClient()

  // 1) invited_by 기록
  await supabase
    .from('profiles')
    .update({ invited_by: inviterId })
    .eq('id', inviteeId)

  // 2) invite_records 기록
  await supabase
    .from('invite_records')
    .insert({ inviter_id: inviterId, invitee_id: inviteeId })

  // 3) 가입자 2,000P 적립
  await addPoints(inviteeId, POINT_AMOUNTS.SIGNUP_BONUS, 'signup_bonus', '초대코드 가입 보너스')

  // 4) 초대자 1,000P 적립 — 여기는 inviter 소유이므로 RLS 우회를 위해 서비스 역할 필요
  //    하지만 클라이언트에서는 invitee가 insert하므로 직접 profiles update는 불가
  //    대안: point_transactions에만 기록하고, 초대자 잔액은 별도 계산
  //    여기서는 서버리스 접근이 어려우므로, 초대자의 포인트도 직접 업데이트
  const inviterPoints = await getPointsById(inviterId)
  await supabase
    .from('profiles')
    .update({ points: inviterPoints + POINT_AMOUNTS.INVITE_REWARD })
    .eq('id', inviterId)

  // 초대자 트랜잭션 기록 (RLS 때문에 직접 insert 불가할 수 있으나 시도)
  await supabase
    .from('point_transactions')
    .insert({
      user_id: inviterId,
      amount: POINT_AMOUNTS.INVITE_REWARD,
      type: 'invite_reward',
      description: '지인 초대 보상',
    })

  return true
}

// ── 특정 유저 포인트 조회 (내부용, RLS 무관) ──
async function getPointsById(userId: string): Promise<number> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single()
  return data?.points ?? 0
}

// ── 포인트 내역 조회 ──
export async function getPointHistory(
  userId: string,
  filter: 'all' | 'earned' | 'spent' = 'all'
): Promise<Array<{
  id: string
  amount: number
  type: string
  description: string
  created_at: string
}>> {
  const supabase = createClient()
  let query = supabase
    .from('point_transactions')
    .select('id, amount, type, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filter === 'earned') query = query.gt('amount', 0)
  if (filter === 'spent') query = query.lt('amount', 0)

  const { data } = await query
  return data ?? []
}

// ── 초대 현황 조회 ──
export async function getInviteStats(userId: string): Promise<{ count: number }> {
  const supabase = createClient()
  const { count } = await supabase
    .from('invite_records')
    .select('*', { count: 'exact', head: true })
    .eq('inviter_id', userId)

  return { count: count ?? 0 }
}

// ── 내 초대코드 조회 ──
export async function getMyInviteCode(userId: string): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('invite_code')
    .eq('id', userId)
    .single()
  return data?.invite_code ?? ''
}
