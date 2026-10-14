import { http, HttpResponse, delay } from 'msw'
import type { ApiError, NftListResponse } from '@/types/api'
import { db, ready, saveCarts, saveSessions, sha256 } from './db'

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

const formatUnits = (v: bigint) => {
  const s = v.toString().padStart(19, '0')
  const int = s.slice(0, -18)
  const frac = s.slice(-18).replace(/0+$/, '')
  return frac ? `${int}.${frac}` : int
}

function cartKey(request: Request) {
  const auth = currentUser(request)
  if (auth) return `u:${auth.user.id}`
  const guest = request.headers.get('X-Guest-Id')
  return guest ? `g:${guest}` : null
}

const getRawCart = (key: string) => db.carts.get(key) ?? { items: [], coupon: null }

function buildCart(key: string) {
  const raw = getRawCart(key)
  const items = raw.items.flatMap((i) => {
    const nft = db.nfts.find((n) => n.id === i.nftId)
    return nft ? [{ nft, quantity: i.quantity }] : []
  })
  const subtotal = items.reduce((sum, i) => sum + toUnits(i.nft.price) * BigInt(i.quantity), 0n)
  const discount = raw.coupon ? (subtotal * 10n) / 100n : 0n
  const networkFee = items.length ? toUnits('0.002') : 0n
  return {
    items,
    coupon: raw.coupon,
    subtotal: formatUnits(subtotal),
    discount: formatUnits(discount),
    networkFee: formatUnits(networkFee),
    total: formatUnits(subtotal - discount + networkFee),
  }
}

const noIdentity = () => err(400, 'missing_identity', 'Identificação do carrinho ausente')

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
    http.get('/api/cart', async ({ request }) => {
    await ready
    await delay(200)
    const key = cartKey(request)
    if (!key) return noIdentity()
    return HttpResponse.json(buildCart(key))
  }),

  http.post('/api/cart/items', async ({ request }) => {
    await ready
    await delay(200)
    const key = cartKey(request)
    if (!key) return noIdentity()
    const { nftId, quantity } = (await request.json()) as { nftId: string; quantity: number }
    const nft = db.nfts.find((n) => n.id === nftId)
    if (!nft) return err(404, 'not_found', 'NFT não encontrado')
    if (!Number.isInteger(quantity) || quantity < 1) return err(422, 'validation_error', 'Quantidade inválida')
    const cart = getRawCart(key)
    const line = cart.items.find((i) => i.nftId === nftId)
    const next = (line?.quantity ?? 0) + quantity
    if (next > nft.editionsAvailable) {
      return err(409, 'stock_conflict', nft.editionsAvailable === 0 ? 'Edição esgotada' : `Só restam ${nft.editionsAvailable} edições`)
    }
    if (line) line.quantity = next
    else cart.items.push({ nftId, quantity })
    db.carts.set(key, cart)
    saveCarts()
    return HttpResponse.json(buildCart(key), { status: 201 })
  }),

  http.patch('/api/cart/items/:nftId', async ({ request, params }) => {
    await ready
    await delay(300)
    const key = cartKey(request)
    if (!key) return noIdentity()
    const { quantity } = (await request.json()) as { quantity: number }
    const nft = db.nfts.find((n) => n.id === params.nftId)
    const cart = getRawCart(key)
    const line = cart.items.find((i) => i.nftId === params.nftId)
    if (!nft || !line) return err(404, 'not_found', 'Item não está no carrinho')
    if (!Number.isInteger(quantity) || quantity < 1) return err(422, 'validation_error', 'Quantidade inválida')
    if (quantity > nft.editionsAvailable) {
      return err(409, 'stock_conflict', `Só restam ${nft.editionsAvailable} edições`)
    }
    line.quantity = quantity
    db.carts.set(key, cart)
    saveCarts()
    return HttpResponse.json(buildCart(key))
  }),

  http.delete('/api/cart/items/:nftId', async ({ request, params }) => {
    await ready
    await delay(200)
    const key = cartKey(request)
    if (!key) return noIdentity()
    const cart = getRawCart(key)
    cart.items = cart.items.filter((i) => i.nftId !== params.nftId)
    db.carts.set(key, cart)
    saveCarts()
    return HttpResponse.json(buildCart(key))
  }),

  http.post('/api/cart/coupon', async ({ request }) => {
    await ready
    await delay(300)
    const key = cartKey(request)
    if (!key) return noIdentity()
    const { code } = (await request.json()) as { code: string }
    const normalized = (code ?? '').trim().toUpperCase()
    if (normalized === 'EXPIRADO') return err(410, 'coupon_expired', 'Este cupom expirou')
    if (normalized !== 'KURIO10') return err(422, 'coupon_invalid', 'Cupom inválido')
    const cart = getRawCart(key)
    cart.coupon = normalized
    db.carts.set(key, cart)
    saveCarts()
    return HttpResponse.json(buildCart(key))
  }),

  http.delete('/api/cart/coupon', async ({ request }) => {
    await ready
    await delay(200)
    const key = cartKey(request)
    if (!key) return noIdentity()
    const cart = getRawCart(key)
    cart.coupon = null
    db.carts.set(key, cart)
    saveCarts()
    return HttpResponse.json(buildCart(key))
  }),

  http.post('/api/cart/merge', async ({ request }) => {
    await ready
    await delay(200)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const { guestId } = (await request.json()) as { guestId: string }
    const guestKey = `g:${guestId}`
    const userKey = `u:${auth.user.id}`
    const guest = db.carts.get(guestKey)
    if (guest) {
      const target = getRawCart(userKey)
      for (const g of guest.items) {
        const nft = db.nfts.find((n) => n.id === g.nftId)
        if (!nft) continue
        const line = target.items.find((i) => i.nftId === g.nftId)
        const qty = Math.min((line?.quantity ?? 0) + g.quantity, nft.editionsAvailable)
        if (qty < 1) continue
        if (line) line.quantity = qty
        else target.items.push({ nftId: g.nftId, quantity: qty })
      }
      db.carts.set(userKey, target)
      db.carts.delete(guestKey)
      saveCarts()
    }
    return HttpResponse.json(buildCart(userKey))
  }),
]