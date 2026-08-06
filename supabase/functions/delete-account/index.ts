/**
 * 회원 탈퇴.
 *
 * 클라이언트는 서비스 롤 키를 가질 수 없으므로(정적 내보내기라 모든 환경변수가
 * 번들에 인라인된다) auth.users 를 지울 수 없다. 기존 코드는 profiles 행만
 * 삭제해서 이메일과 소셜 식별자가 auth.users 에 남았다.
 *   · 개인정보 파기 의무 미이행 소지
 *   · 같은 이메일로 재가입하면 profiles 없는 유령 세션이 생김
 *
 * 이 함수는 호출자의 JWT 로 신원을 확인한 뒤, 서비스 롤로 본인 계정만 삭제한다.
 * 대상 사용자 id 를 요청 본문으로 받지 않는 것이 핵심이다.
 *
 * 배포:
 *   supabase functions deploy delete-account
 * 필요한 시크릿(플랫폼이 자동 주입하지만 셀프호스팅 시 확인할 것):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://miliyday.vercel.app',
  'http://localhost:3000',
  'capacitor://localhost',
  'http://localhost',
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1) 호출자의 토큰으로 신원을 확인한다. 여기서 얻은 id 만 삭제 대상이 된다.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const userId = userData.user.id

  // 2) 앱 데이터를 먼저 정리한다.
  //    FK 가 CASCADE 로 걸려 있으면 profiles 삭제만으로 충분하지만,
  //    설정이 확실하지 않으므로 명시적으로 지운다. 실패해도 계정 삭제는 진행한다.
  const cleanup: Array<[string, string]> = [
    ['post_likes', 'user_id'],
    ['post_bookmarks', 'user_id'],
    ['comments', 'user_id'],
    ['feed_comments', 'user_id'],
    ['feed_posts', 'user_id'],
    ['posts', 'user_id'],
    ['vacation_records', 'user_id'],
    ['vacation_budgets', 'user_id'],
    ['daily_point_limits', 'user_id'],
    ['point_transactions', 'user_id'],
  ]
  for (const [table, column] of cleanup) {
    const { error } = await admin.from(table).delete().eq(column, userId)
    if (error) console.error(`cleanup ${table} failed:`, error.message)
  }

  // 연동 관계는 양방향 모두 끊는다.
  await admin.from('connection_requests').delete().or(`requester_id.eq.${userId},soldier_id.eq.${userId}`)
  await admin.from('invite_records').delete().or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
  await admin.from('profiles').update({ connected_soldier_id: null }).eq('connected_soldier_id', userId)

  const { error: profileError } = await admin.from('profiles').delete().eq('id', userId)
  if (profileError) console.error('profile delete failed:', profileError.message)

  // 3) auth.users 삭제. 여기까지 와야 실제로 파기된 것이다.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return new Response(JSON.stringify({ error: 'delete_failed', detail: deleteError.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
