import { http, HttpResponse } from 'msw'

let posts = [
  { id: 1, title: '훈련소 팁', body: '물 잘 챙겨라.', category: '훈련소' },
]
let market = [
  { id: 1, title: '군용 침낭', price: 20000, status: 'selling', images: [] },
]
let feed = [
  { id: 1, owner: 'soldier01', caption: '첫 사진', images: [], visibility: 'connections' },
]

export const handlers = [
  // Posts CRUD
  http.get('/api/posts', () => {
    return HttpResponse.json({ posts })
  }),
  http.post('/api/posts', async ({ request }) => {
    const body = await request.json() as any
    const next = { id: Date.now(), ...body }
    posts.unshift(next)
    return HttpResponse.json(next, { status: 201 })
  }),
  http.patch('/api/posts/:id', async ({ params, request }) => {
    const id = Number(params.id)
    const body = await request.json() as any
    posts = posts.map(p => (p.id === id ? { ...p, ...body } : p))
    return HttpResponse.json(posts.find(p => p.id === id))
  }),
  http.delete('/api/posts/:id', ({ params }) => {
    const id = Number(params.id)
    posts = posts.filter(p => p.id !== id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Market CRUD
  http.get('/api/market', () => {
    return HttpResponse.json({ items: market })
  }),
  http.post('/api/market', async ({ request }) => {
    const body = await request.json() as any
    const next = { id: Date.now(), ...body }
    market.unshift(next)
    return HttpResponse.json(next, { status: 201 })
  }),

  // Feed CRUD
  http.get('/api/feed', () => {
    return HttpResponse.json({ feed })
  }),
  http.post('/api/feed', async ({ request }) => {
    const body = await request.json() as any
    const next = { id: Date.now(), ...body }
    feed.unshift(next)
    return HttpResponse.json(next, { status: 201 })
  }),

  // Simple dday endpoint
  http.get('/api/dday', ({ request }) => {
    const url = new URL(request.url)
    const enlist = url.searchParams.get('enlistmentDate') || ''
    const branch = url.searchParams.get('branch') || 'army'
    return HttpResponse.json({ enlistmentDate: enlist, branch, message: 'mocked dday endpoint' })
  }),
]
