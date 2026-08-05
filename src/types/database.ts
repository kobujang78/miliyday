/**
 * Supabase 테이블 행 타입.
 *
 * 이상적으로는 `supabase gen types typescript --project-id <ref> > src/types/database.ts`
 * 로 생성해야 한다. 아직 CI 에 Supabase 액세스 토큰이 없어 코드에서 실제로 사용하는
 * 컬럼을 기준으로 손으로 정의해 둔다.
 *
 * 생성 방식으로 전환할 때 이 파일을 통째로 교체하면 된다. 그때까지는
 * DB 스키마를 바꾸면 이 파일도 함께 고쳐야 한다.
 */

export type Branch = 'army' | 'navy' | 'airforce' | 'marines' | 'katusa'
export type UserType = 'soldier' | 'girlfriend' | 'friend' | 'family'
export type Visibility = 'public' | 'connections' | 'private'
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected'
export type VacationTypeKey = 'regular' | 'reward' | 'consolation' | 'petition' | 'other'

/** 권한. 표시 이름이 아니라 이 컬럼이 관리자 여부의 유일한 근거다. */
export type UserRole = 'user' | 'admin'

export interface ProfileRow {
  id: string
  email: string
  role: UserRole
  display_name: string | null
  branch: string | null
  rank_level: number
  enlist_date: string | null
  nickname: string | null
  avatar_url: string | null
  nickname_updated_at: string | null
  points: number
  privacy_policy_agreed: boolean
  privacy_policy_agreed_at: string | null
  terms_agreed: boolean
  marketing_agreed: boolean
  marketing_agreed_at: string | null
  user_type: string
  relationship: string | null
  connected_soldier_id: string | null
  invite_code: string | null
  invited_by: string | null
}

/** 게시글/댓글에 조인해서 붙는 작성자 요약. PostgREST 임베드 결과이므로 누락될 수 있다. */
export interface AuthorSummary {
  id?: string
  nickname: string | null
  display_name: string | null
  avatar_url: string | null
  rank_level: number | null
  branch: string | null
}

export interface PostRow {
  id: string
  user_id: string | null
  title: string
  body: string
  category: string | null
  image_url: string | null
  board_type: string
  likes_count: number
  comments_count: number
  created_at: string
}

export interface CommentRow {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
}

export interface FeedPostRow {
  id: string
  user_id: string | null
  caption: string | null
  images: string[] | null
  visibility: Visibility | null
  likes: number
  comments_count: number
  created_at: string
}

export interface FeedCommentRow {
  id: string
  feed_post_id: string
  user_id: string
  body: string
  created_at: string
}

export interface PointTransactionRow {
  id: string
  user_id: string
  amount: number
  type: string
  description: string
  reference_id: string | null
  created_at: string
}

export interface VacationRecordRow {
  id: string
  user_id: string
  type: string
  title: string
  start_date: string
  end_date: string
  days: number
  memo: string | null
}

export interface VacationBudgetRow {
  id: string
  user_id: string
  regular: number
  reward: number
  consolation: number
  petition: number
  other: number
}

export interface ConnectionRequestRow {
  id: string
  requester_id: string
  soldier_id: string
  status: ConnectionStatus
  message: string | null
  created_at: string
  responded_at: string | null
}

/**
 * PostgREST 임베드(`select('*, profiles:user_id(...)')`) 결과에 작성자 정보를 얹는다.
 * supabase-js 는 임베드 결과를 배열로 추론하는 경우가 있어 둘 다 허용한다.
 */
export type WithAuthor<T> = T & {
  profiles?: AuthorSummary | AuthorSummary[] | null
}

/** 임베드 결과가 배열로 오든 객체로 오든 하나로 정규화한다. */
export function firstAuthor(
  profiles: AuthorSummary | AuthorSummary[] | null | undefined
): AuthorSummary | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles
}
