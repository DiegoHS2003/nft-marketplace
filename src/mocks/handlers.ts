import { http, HttpResponse, delay } from 'msw'
import type { ApiError, NftListResponse } from '@/types/api'
import { db, ready, saveSessions, sha256 } from './db'

const err = (status: number, code: string, message: string, fields?: Record<string, string>) =>
  HttpResponse.json<ApiError>({ code, message, fields }, { status })

// ETH decimal string -> inteiro em wei (BigInt), pra comparar sem perder precisão
const isEth = (v: string | null): v is string => !!v && /^\d+(\.\d{1,18})?$/.test(v)
const toUnits = (v: string) => {
  const [i, f = ''] = v.split('.')
  return BigInt(i + f.padEnd(18, '0'))
}

function currentUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  const userId = token ? db.sessions.get(token) : undefined
  const user = db.users.find((u) => u.id === userId)
  return user ? { user, token: token! } : null
}

const publicUser = ({ id, name, email }: { id: string; name: string; email: string }) => ({ id, name, email })

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await ready
    await delay(300)
    const { email, password } = (await request.json()) as { email: string; password: string }
    const user = db.users.find((u) => u.email === email?.trim().toLowerCase())
    if (!user || user.passwordHash !== (await sha256(password ?? ''))) {
      return err(401, 'invalid_credentials', 'E-mail ou senha inválidos')
    }
    const token = crypto.randomUUID()
    db.sessions.set(token, user.id)
    saveSessions()
    return HttpResponse.json({ user: publicUser(user), token })
  }),

  http.post('/api/auth/register', async ({ request }) => {
    await ready
    await delay(300)
    const { name, email, password } = (await request.json()) as { name: string; email: string; password: string }
    const fields: Record<string, string> = {}
    if (!name?.trim()) fields.name = 'Informe seu nome'
    if (!/^\S+@\S+\.\S+$/.test(email ?? '')) fields.email = 'E-mail inválido'
    if ((password ?? '').length < 8) fields.password = 'A senha precisa ter ao menos 8 caracteres'
    if (Object.keys(fields).length) return err(422, 'validation_error', 'Dados inválidos', fields)

    const normalized = email.trim().toLowerCase()
    if (db.users.some((u) => u.email === normalized)) {
      return err(409, 'email_taken', 'Este e-mail já está cadastrado', { email: 'E-mail já cadastrado' })
    }
    const user = { id: `u${db.users.length + 1}`, name: name.trim(), email: normalized, passwordHash: await sha256(password) }
    db.users.push(user)
    const token = crypto.randomUUID()
    db.sessions.set(token, user.id)
    saveSessions()
    return HttpResponse.json({ user: publicUser(user), token }, { status: 201 })
  }),

  http.get('/api/auth/session', async ({ request }) => {
    await ready
    await delay(150)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    return HttpResponse.json({ user: publicUser(auth.user) })
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    await ready
    const auth = currentUser(request)
    if (auth) {
      db.sessions.delete(auth.token)
      saveSessions()
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/nfts', async ({ request }) => {
    await ready
    await delay(300)
    const p = new URL(request.url).searchParams
    const q = (p.get('q') ?? '').trim().toLowerCase()
    const collections = p.getAll('collection')
    const networks = p.getAll('network')
    const minPrice = p.get('minPrice')
    const maxPrice = p.get('maxPrice')
    const tab = p.get('tab') ?? 'all'
    const sort = p.get('sort') ?? 'recent'
    const page = Math.max(1, Number(p.get('page') ?? 1))
    const pageSize = Math.min(24, Math.max(1, Number(p.get('pageSize') ?? 9)))

    let items = db.nfts.filter(
      (n) =>
        (!q || n.name.toLowerCase().includes(q)) &&
        (!collections.length || collections.includes(n.collection)) &&
        (!networks.length || networks.includes(n.network)) &&
        (!isEth(minPrice) || toUnits(n.price) >= toUnits(minPrice)) &&
        (!isEth(maxPrice) || toUnits(n.price) <= toUnits(maxPrice)) &&
        (tab === 'all' || n.tag === tab),
    )

    items = [...items].sort((a, b) => {
      if (sort === 'price_asc' || sort === 'price_desc') {
        const d = toUnits(a.price) - toUnits(b.price)
        const cmp = d < 0n ? -1 : d > 0n ? 1 : 0
        return sort === 'price_asc' ? cmp : -cmp
      }
      return b.createdAt.localeCompare(a.createdAt)
    })

    const total = items.length
    const body: NftListResponse = {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
    return HttpResponse.json(body)
  }),

  http.get('/api/nfts/:id', async ({ params }) => {
    await ready
    await delay(300)
    const nft = db.nfts.find((n) => n.id === params.id)
    return nft ? HttpResponse.json(nft) : err(404, 'not_found', 'NFT não encontrado')
  }),
]