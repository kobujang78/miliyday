import { createClient } from '@/lib/supabase'

export interface FeedItem {
  id: string
  ownerId: string
  ownerName: string
  ownerNickname: string
  ownerAvatar: string
  ownerRank: number
  ownerBranch: string
  caption: string
  images: string[] // URLs or Base64
  visibility: 'public' | 'connections' | 'private'
  createdAt: string
  likes: number
  comments: number
}

// Load feed from Supabase (includes owner profile info via join)
export async function loadFeed(): Promise<FeedItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('feed_posts')
    .select(`
      id, user_id, caption, images, visibility, likes, comments_count, created_at,
      profiles:user_id ( display_name, nickname, avatar_url, rank_level, branch )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !data) return []

  return data.map((row: any) => ({
    id: row.id,
    ownerId: row.user_id || '',
    ownerName: row.profiles?.display_name || '사용자',
    ownerNickname: row.profiles?.nickname || '',
    ownerAvatar: row.profiles?.avatar_url || '',
    ownerRank: row.profiles?.rank_level || 1,
    ownerBranch: row.profiles?.branch || 'army',
    caption: row.caption || '',
    images: row.images || [],
    visibility: row.visibility || 'connections',
    createdAt: row.created_at,
    likes: row.likes || 0,
    comments: row.comments_count || 0,
  }))
}

// Add a new post to Supabase
export async function addPost(post: {
  userId: string
  caption: string
  images: string[]
  visibility: string
}): Promise<FeedItem | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('feed_posts')
    .insert({
      user_id: post.userId,
      caption: post.caption,
      images: post.images,
      visibility: post.visibility,
    })
    .select(`
      id, user_id, caption, images, visibility, likes, comments_count, created_at,
      profiles:user_id ( display_name, nickname, avatar_url, rank_level, branch )
    `)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    ownerId: data.user_id || '',
    ownerName: (data as any).profiles?.display_name || '사용자',
    ownerNickname: (data as any).profiles?.nickname || '',
    ownerAvatar: (data as any).profiles?.avatar_url || '',
    ownerRank: (data as any).profiles?.rank_level || 1,
    ownerBranch: (data as any).profiles?.branch || 'army',
    caption: data.caption || '',
    images: data.images || [],
    visibility: data.visibility || 'connections',
    createdAt: data.created_at,
    likes: data.likes || 0,
    comments: data.comments_count || 0,
  }
}

// Toggle like (increment)
export async function toggleLike(postId: string): Promise<boolean> {
  const supabase = createClient()
  // Use RPC or simple increment
  const { data: post } = await supabase
    .from('feed_posts')
    .select('likes')
    .eq('id', postId)
    .single()

  if (!post) return false

  const { error } = await supabase
    .from('feed_posts')
    .update({ likes: post.likes + 1 })
    .eq('id', postId)

  return !error
}

// Delete a feed post
export async function deleteFeedPost(postId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('feed_posts')
    .delete()
    .eq('id', postId)
  return !error
}

// Format time elapsed
export function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`
  
  const d = new Date(dateString)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
