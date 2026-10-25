import { createClient } from '@/lib/supabase'
import { firstAuthor, type FeedCommentRow, type FeedPostRow, type WithAuthor } from '@/types/database'

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
  showComments?: boolean
  commentsList?: FeedComment[]
}

export interface FeedComment {
  id: string
  userId: string
  userName: string
  userAvatar: string
  userRank: number
  userBranch: string
  body: string
  createdAt: string
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

  return (data as WithAuthor<FeedPostRow>[]).map((row) => {
    const author = firstAuthor(row.profiles)
    return {
      id: row.id,
      ownerId: row.user_id || '',
      ownerName: author?.display_name || '사용자',
      ownerNickname: author?.nickname || '',
      ownerAvatar: author?.avatar_url || '',
      ownerRank: author?.rank_level || 1,
      ownerBranch: author?.branch || 'army',
      caption: row.caption || '',
      images: row.images || [],
      visibility: row.visibility || 'connections',
      createdAt: row.created_at,
      likes: row.likes || 0,
      comments: row.comments_count || 0,
    }
  })
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

  const row = data as WithAuthor<FeedPostRow>
  const author = firstAuthor(row.profiles)

  return {
    id: row.id,
    ownerId: row.user_id || '',
    ownerName: author?.display_name || '사용자',
    ownerNickname: author?.nickname || '',
    ownerAvatar: author?.avatar_url || '',
    ownerRank: author?.rank_level || 1,
    ownerBranch: author?.branch || 'army',
    caption: row.caption || '',
    images: row.images || [],
    visibility: row.visibility || 'connections',
    createdAt: row.created_at,
    likes: row.likes || 0,
    comments: row.comments_count || 0,
  }
}

// Toggle like (with localStorage-based duplicate prevention)
export async function toggleLike(postId: string, userId: string): Promise<{ liked: boolean; newCount: number }> {
  const supabase = createClient()
  const storageKey = `feed_likes_${userId}`
  
  // Get liked posts from localStorage
  let likedPosts: string[] = []
  try {
    likedPosts = JSON.parse(localStorage.getItem(storageKey) || '[]')
  } catch { likedPosts = [] }

  const alreadyLiked = likedPosts.includes(postId)
  
  // Get current count
  const { data: post } = await supabase
    .from('feed_posts')
    .select('likes')
    .eq('id', postId)
    .single()

  if (!post) return { liked: false, newCount: 0 }

  const newCount = alreadyLiked 
    ? Math.max(0, post.likes - 1) 
    : post.likes + 1

  const { error } = await supabase
    .from('feed_posts')
    .update({ likes: newCount })
    .eq('id', postId)

  if (error) return { liked: alreadyLiked, newCount: post.likes }

  // Update localStorage
  if (alreadyLiked) {
    likedPosts = likedPosts.filter(id => id !== postId)
  } else {
    likedPosts.push(postId)
  }
  localStorage.setItem(storageKey, JSON.stringify(likedPosts))

  return { liked: !alreadyLiked, newCount }
}

// Check if user has liked a post
export function isPostLiked(postId: string, userId: string): boolean {
  try {
    const likedPosts = JSON.parse(localStorage.getItem(`feed_likes_${userId}`) || '[]')
    return likedPosts.includes(postId)
  } catch { return false }
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

// Edit a feed post caption
export async function editFeedPost(postId: string, newCaption: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('feed_posts')
    .update({ caption: newCaption })
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

// Load comments for a feed post
export async function loadFeedComments(postId: string): Promise<FeedComment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('feed_comments')
    .select(`
      id, user_id, body, created_at,
      profiles:user_id ( display_name, nickname, avatar_url, rank_level, branch )
    `)
    .eq('feed_post_id', postId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return (data as WithAuthor<FeedCommentRow>[]).map((row) => {
    const author = firstAuthor(row.profiles)
    return {
      id: row.id,
      userId: row.user_id,
      userName: author?.nickname || author?.display_name || '사용자',
      userAvatar: author?.avatar_url || '',
      userRank: author?.rank_level || 1,
      userBranch: author?.branch || 'army',
      body: row.body || '',
      createdAt: row.created_at,
    }
  })
}

// Add a comment to a feed post
export async function addFeedComment(postId: string, userId: string, body: string): Promise<FeedComment | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('feed_comments')
    .insert({ feed_post_id: postId, user_id: userId, body })
    .select(`
      id, user_id, body, created_at,
      profiles:user_id ( display_name, nickname, avatar_url, rank_level, branch )
    `)
    .single()

  if (error || !data) return null

  // Increment comment count in feed_posts
  const { data: post } = await supabase.from('feed_posts').select('comments_count').eq('id', postId).single()
  if (post) {
    await supabase.from('feed_posts').update({ comments_count: post.comments_count + 1 }).eq('id', postId)
  }

  const row = data as WithAuthor<FeedCommentRow>
  const author = firstAuthor(row.profiles)

  return {
    id: row.id,
    userId: row.user_id,
    userName: author?.nickname || author?.display_name || '사용자',
    userAvatar: author?.avatar_url || '',
    userRank: author?.rank_level || 1,
    userBranch: author?.branch || 'army',
    body: row.body || '',
    createdAt: row.created_at,
  }
}
