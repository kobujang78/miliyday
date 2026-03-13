export interface FeedItem {
  id: string
  ownerId: string
  ownerName: string
  ownerRank: number
  ownerBranch: string
  caption: string
  images: string[] // Base64 encoded images
  visibility: 'public' | 'connections' | 'private'
  createdAt: string
  likes: number
  comments: number
}

const STORAGE_KEY = 'mili_feed'

// Load feed from localStorage
export function loadFeed(): FeedItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) return JSON.parse(data)
  } catch (e) {
    console.error('Failed to load feed:', e)
  }
  return []
}

// Save feed to localStorage
export function saveFeed(feed: FeedItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feed))
  } catch (e) {
    console.error('Failed to save feed:', e)
  }
}

// Add a new post
export function addPost(post: FeedItem) {
  const currentFeed = loadFeed()
  const newFeed = [post, ...currentFeed]
  saveFeed(newFeed)
  return newFeed
}

// Toggle like
export function toggleLike(postId: string) {
  const currentFeed = loadFeed()
  const newFeed = currentFeed.map(post => {
    if (post.id === postId) {
      return { ...post, likes: post.likes + 1 }
    }
    return post
  })
  saveFeed(newFeed)
  return newFeed
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
