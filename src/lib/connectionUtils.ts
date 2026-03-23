import { createClient } from '@/lib/supabase'

export interface ConnectionRequest {
  id: string
  requester_id: string
  soldier_id: string
  status: 'pending' | 'accepted' | 'rejected'
  message: string | null
  created_at: string
  responded_at: string | null
  // Joined data
  requester?: {
    id: string
    nickname: string | null
    display_name: string | null
    avatar_url: string | null
    user_type: string
    relationship: string | null
  }
  soldier?: {
    id: string
    nickname: string | null
    display_name: string | null
    avatar_url: string | null
    branch: string
    rank_level: number
    enlist_date: string | null
  }
}

export interface SoldierSearchResult {
  id: string
  nickname: string | null
  display_name: string | null
  avatar_url: string | null
  branch: string
  rank_level: number
}

/**
 * 닉네임으로 현역병 검색
 */
export async function searchSoldierByNickname(nickname: string): Promise<SoldierSearchResult[]> {
  if (!nickname.trim()) return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, display_name, avatar_url, branch, rank_level')
    .eq('user_type', 'soldier')
    .ilike('nickname', `%${nickname.trim()}%`)
    .limit(10)

  if (error) {
    console.error('Search error:', error)
    return []
  }
  return (data || []) as SoldierSearchResult[]
}

/**
 * 연동 신청 보내기
 */
export async function sendConnectionRequest(
  requesterId: string,
  soldierId: string,
  message?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // 이미 연동된 상태인지 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('connected_soldier_id')
    .eq('id', requesterId)
    .single()

  if (profile?.connected_soldier_id) {
    return { success: false, error: '이미 다른 용사와 연동되어 있습니다. 연동을 해제한 후 다시 시도해주세요.' }
  }

  // 중복 pending 요청 확인
  const { data: existing } = await supabase
    .from('connection_requests')
    .select('id, status')
    .eq('requester_id', requesterId)
    .eq('soldier_id', soldierId)
    .in('status', ['pending'])
    .single()

  if (existing) {
    return { success: false, error: '이미 해당 용사에게 연동 신청을 보냈습니다.' }
  }

  const { error } = await supabase
    .from('connection_requests')
    .insert({
      requester_id: requesterId,
      soldier_id: soldierId,
      status: 'pending',
      message: message || null,
    })

  if (error) {
    console.error('Connection request error:', error)
    if (error.code === '23505') {
      return { success: false, error: '이미 해당 용사에게 신청한 기록이 있습니다.' }
    }
    return { success: false, error: '신청 중 오류가 발생했습니다.' }
  }
  return { success: true }
}

/**
 * 내가 받은 연동 신청 목록 (현역병용)
 */
export async function getReceivedRequests(soldierId: string): Promise<ConnectionRequest[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('connection_requests')
    .select(`
      id, requester_id, soldier_id, status, message, created_at, responded_at,
      requester:profiles!connection_requests_requester_id_fkey(
        id, nickname, display_name, avatar_url, user_type, relationship
      )
    `)
    .eq('soldier_id', soldierId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Get received requests error:', error)
    return []
  }
  return (data || []) as unknown as ConnectionRequest[]
}

/**
 * 내가 보낸 연동 신청 목록 (비현역용)
 */
export async function getSentRequests(requesterId: string): Promise<ConnectionRequest[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('connection_requests')
    .select(`
      id, requester_id, soldier_id, status, message, created_at, responded_at,
      soldier:profiles!connection_requests_soldier_id_fkey(
        id, nickname, display_name, avatar_url, branch, rank_level, enlist_date
      )
    `)
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Get sent requests error:', error)
    return []
  }
  return (data || []) as unknown as ConnectionRequest[]
}

/**
 * pending 요청 개수 (현역병이 받은 것)
 */
export async function getPendingRequestCount(soldierId: string): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('connection_requests')
    .select('id', { count: 'exact', head: true })
    .eq('soldier_id', soldierId)
    .eq('status', 'pending')

  if (error) {
    console.error('Get pending count error:', error)
    return 0
  }
  return count || 0
}

/**
 * 연동 신청 수락
 * - connection_requests.status → 'accepted'
 * - requester의 profiles.connected_soldier_id → soldier_id 로 업데이트
 */
export async function acceptConnectionRequest(
  requestId: string,
  soldierId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // 요청 정보 조회
  const { data: request, error: fetchError } = await supabase
    .from('connection_requests')
    .select('requester_id, soldier_id, status')
    .eq('id', requestId)
    .eq('soldier_id', soldierId)
    .single()

  if (fetchError || !request) {
    return { success: false, error: '요청을 찾을 수 없습니다.' }
  }
  if (request.status !== 'pending') {
    return { success: false, error: '이미 처리된 요청입니다.' }
  }

  // 요청 수락
  const { error: updateError } = await supabase
    .from('connection_requests')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateError) {
    console.error('Accept error:', updateError)
    return { success: false, error: '수락 처리 중 오류가 발생했습니다.' }
  }

  // 신청자의 connected_soldier_id 업데이트
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ connected_soldier_id: soldierId })
    .eq('id', request.requester_id)

  if (profileError) {
    console.error('Profile update error:', profileError)
    return { success: false, error: '프로필 연동 업데이트 중 오류가 발생했습니다.' }
  }

  return { success: true }
}

/**
 * 연동 신청 거절
 */
export async function rejectConnectionRequest(
  requestId: string,
  soldierId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('connection_requests')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('soldier_id', soldierId)

  if (error) {
    console.error('Reject error:', error)
    return { success: false, error: '거절 처리 중 오류가 발생했습니다.' }
  }
  return { success: true }
}

/**
 * 연동 해제 (비현역 사용자가 호출)
 */
export async function disconnectSoldier(userId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // connected_soldier_id 초기화
  const { error } = await supabase
    .from('profiles')
    .update({ connected_soldier_id: null })
    .eq('id', userId)

  if (error) {
    console.error('Disconnect error:', error)
    return { success: false, error: '연동 해제 중 오류가 발생했습니다.' }
  }
  return { success: true }
}

/**
 * 현역병에게 연동된 지인 목록 조회
 */
export async function getConnectedUsers(soldierId: string): Promise<Array<{
  id: string
  nickname: string | null
  display_name: string | null
  avatar_url: string | null
  user_type: string
  relationship: string | null
}>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, display_name, avatar_url, user_type, relationship')
    .eq('connected_soldier_id', soldierId)

  if (error) {
    console.error('Get connected users error:', error)
    return []
  }
  return data || []
}
