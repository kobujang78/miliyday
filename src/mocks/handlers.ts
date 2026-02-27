import { rest } from 'msw'

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
  rest.get('/api/posts', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ posts }))
  }),
  rest.post('/api/posts', async (req, res, ctx) => {
    const body = await req.json()
    const next = { id: Date.now(), ...body }
    posts.unshift(next)
    return res(ctx.status(201), ctx.json(next))
  }),
  rest.patch('/api/posts/:id', async (req, res, ctx) => {
    const id = Number(req.params.id)
    const body = await req.json()
    posts = posts.map(p => (p.id === id ? { ...p, ...body } : p))
    return res(ctx.status(200), ctx.json(posts.find(p=>p.id===id)))
  }),
  rest.delete('/api/posts/:id', (req, res, ctx) => {
    const id = Number(req.params.id)
    posts = posts.filter(p => p.id !== id)
    return res(ctx.status(204))
  }),

  // Market CRUD
  rest.get('/api/market', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ items: market }))
  }),
  rest.post('/api/market', async (req, res, ctx) => {
    const body = await req.json()
    const next = { id: Date.now(), ...body }
    market.unshift(next)
    return res(ctx.status(201), ctx.json(next))
  }),

  // Feed CRUD
  rest.get('/api/feed', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ feed }))
  }),
  rest.post('/api/feed', async (req, res, ctx) => {
    const body = await req.json()
    const next = { id: Date.now(), ...body }
    feed.unshift(next)
    return res(ctx.status(201), ctx.json(next))
  }),

  // Simple dday endpoint
  rest.get('/api/dday', (req, res, ctx) => {
    const enlist = req.url.searchParams.get('enlistmentDate') || ''
    const branch = (req.url.searchParams.get('branch') || 'army') as string
    return res(ctx.status(200), ctx.json({ enlistmentDate: enlist, branch, message: 'mocked dday endpoint' }))
  }),
]
