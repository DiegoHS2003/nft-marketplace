import { http, HttpResponse, delay } from 'msw'
import type {
  ApiError,
  CreateOrderBody,
  Network,
  Nft,
  NftFacets,
  NftListResponse,
  Order,
  PasswordChangeBody,
  ProfileUpdateBody,
  WalletInput,
} from '@/types/api'
import {
  db,
  ready,
  saveCarts,
  saveFavorites,
  saveNfts,
  saveOrders,
  saveSessions,
  saveUsers,
  saveWallets,
  sha256,
  type StoredOrder,
} from './db'
import { emitNftUpdated, emitOrderUpdated } from './realtime'

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

const publicUser = ({ id, name, email, avatar }: { id: string; name: string; email: string; avatar?: string | null }) => ({
  id,
  name,
  email,
  avatar: avatar ?? null,
})

const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']
const MAX_AVATAR_BYTES = 200 * 1024

// aceita endereços no formato usado pelas fixtures (0x... ou base58), sem exigir um checksum real
const isValidAddress = (v: string) => /^[a-zA-Z0-9]{6,64}$/.test(v.trim())

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
  const quoteId = [
    ...items.map((i) => `${i.nft.id}:${i.nft.price}:${i.nft.version}:${i.quantity}`),
    raw.coupon ?? '-',
  ].join('|')
  return {
    items,
    coupon: raw.coupon,
    quoteId,
    subtotal: formatUnits(subtotal),
    discount: formatUnits(discount),
    networkFee: formatUnits(networkFee),
    total: formatUnits(subtotal - discount + networkFee),
  }
}

const noIdentity = () => err(400, 'missing_identity', 'Identificação do carrinho ausente')

const scenario = () => localStorage.getItem('kurio:mock-scenario') ?? 'default'

// atraso extra pra testar skeletons: liga com window.__kurioMock.setScenario('slow_network')
const slowDelay = () => delay(scenario() === 'slow_network' ? 3000 : 0)

function toOrder(stored: StoredOrder): Order {
  const { userId: _userId, idempotencyKey: _idempotencyKey, payloadHash: _payloadHash, confirmAt: _confirmAt, outcome: _outcome, cartLines: _cartLines, ...order } = stored
  return order
}

// Resolve o pedido pendente quando chega a hora; só na confirmação mexe em estoque e carrinho
function settleOrder(order: StoredOrder) {
  if (order.status !== 'pending' || Date.now() < order.confirmAt) return

  if (order.outcome === 'confirmed') {
    order.status = 'confirmed'
    order.txHash = '0x' + order.id.replace(/-/g, '').padEnd(64, '0')
    for (const line of order.cartLines) {
      const nft = db.nfts.find((n) => n.id === line.nftId)
      if (nft) {
        nft.editionsAvailable = Math.max(0, nft.editionsAvailable - line.quantity)
        nft.version += 1
      }
    }
    const cartId = `u:${order.userId}`
    const cart = db.carts.get(cartId)
    if (cart) {
      cart.items = cart.items.flatMap((i) => {
        const bought = order.cartLines.find((l) => l.nftId === i.nftId)
        if (!bought) return [i]
        const left = i.quantity - bought.quantity
        return left > 0 ? [{ ...i, quantity: left }] : []
      })
      if (cart.items.length === 0) cart.coupon = null
      db.carts.set(cartId, cart)
    }
    saveNfts()
    saveCarts()
    for (const line of order.cartLines) emitNftUpdated(line.nftId)
  } else {
    order.status = 'refused'
    order.refusalReason = 'Pagamento recusado pela carteira'
  }
  order.version += 1
  saveOrders()
  emitOrderUpdated(order)
}

function scheduleSettle(order: StoredOrder) {
  if (order.status !== 'pending') return
  setTimeout(() => settleOrder(order), Math.max(0, order.confirmAt - Date.now()) + 50)
}

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
    saveUsers()
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

  http.get('/api/profile', async ({ request }) => {
    await ready
    await delay(200)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    return HttpResponse.json(publicUser(auth.user))
  }),

  http.patch('/api/profile', async ({ request }) => {
    await ready
    await delay(300)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const body = (await request.json()) as ProfileUpdateBody

    const fields: Record<string, string> = {}
    if (!body.name?.trim()) fields.name = 'Informe seu nome'
    if (!/^\S+@\S+\.\S+$/.test(body.email ?? '')) fields.email = 'E-mail inválido'
    if (Object.keys(fields).length) return err(422, 'validation_error', 'Dados inválidos', fields)

    const normalizedEmail = body.email.trim().toLowerCase()
    if (db.users.some((u) => u.id !== auth.user.id && u.email === normalizedEmail)) {
      return err(409, 'email_taken', 'Este e-mail já está cadastrado', { email: 'E-mail já cadastrado' })
    }

    if (body.avatar) {
      if (!/^data:image\//.test(body.avatar)) return err(422, 'validation_error', 'Dados inválidos', { avatar: 'Formato de imagem inválido' })
      if (body.avatar.length > MAX_AVATAR_BYTES) {
        return err(422, 'validation_error', 'Dados inválidos', { avatar: 'A imagem precisa ter até 200 KB' })
      }
      auth.user.avatar = body.avatar
    } else if (body.avatar === null) {
      auth.user.avatar = null
    }

    auth.user.name = body.name.trim()
    auth.user.email = normalizedEmail
    saveUsers()
    return HttpResponse.json(publicUser(auth.user))
  }),

  http.post('/api/profile/password', async ({ request }) => {
    await ready
    await delay(300)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const { currentPassword, newPassword } = (await request.json()) as PasswordChangeBody

    const fields: Record<string, string> = {}
    if (auth.user.passwordHash !== (await sha256(currentPassword ?? ''))) fields.currentPassword = 'Senha atual incorreta'
    if ((newPassword ?? '').length < 8) fields.newPassword = 'A nova senha precisa ter ao menos 8 caracteres'
    if (Object.keys(fields).length) return err(422, 'validation_error', 'Dados inválidos', fields)

    auth.user.passwordHash = await sha256(newPassword)
    saveUsers()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/nfts', async ({ request }) => {
    await ready
    await delay(300)
    await slowDelay()
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

  // contagens para a sidebar de filtros: cada faceta ignora o próprio filtro (coleção não filtra por coleção, rede não filtra por rede)
  http.get('/api/nfts/facets', async ({ request }) => {
    await ready
    await delay(200)
    const p = new URL(request.url).searchParams
    const q = (p.get('q') ?? '').trim().toLowerCase()
    const collections = p.getAll('collection')
    const networks = p.getAll('network')
    const minPrice = p.get('minPrice')
    const maxPrice = p.get('maxPrice')
    const tab = p.get('tab') ?? 'all'

    const matchesCommon = (n: Nft) =>
      (!q || n.name.toLowerCase().includes(q)) &&
      (!isEth(minPrice) || toUnits(n.price) >= toUnits(minPrice)) &&
      (!isEth(maxPrice) || toUnits(n.price) <= toUnits(maxPrice)) &&
      (tab === 'all' || n.tag === tab)

    const count = (items: Nft[], key: 'collection' | 'network') => {
      const out: Record<string, number> = {}
      for (const n of items) out[n[key]] = (out[n[key]] ?? 0) + 1
      return out
    }

    const forCollections = db.nfts.filter((n) => matchesCommon(n) && (!networks.length || networks.includes(n.network)))
    const forNetworks = db.nfts.filter((n) => matchesCommon(n) && (!collections.length || collections.includes(n.collection)))

    const prices = db.nfts.map((n) => toUnits(n.price))
    const priceBounds = prices.length
      ? { min: formatUnits(prices.reduce((a, b) => (b < a ? b : a))), max: formatUnits(prices.reduce((a, b) => (b > a ? b : a))) }
      : { min: '0', max: '0' }

    const body: NftFacets = {
      collections: count(forCollections, 'collection'),
      networks: count(forNetworks, 'network'),
      priceBounds,
    }
    return HttpResponse.json(body)
  }),

  http.get('/api/nfts/:id', async ({ params }) => {
    await ready
    await delay(300)
    await slowDelay()
    const nft = db.nfts.find((n) => n.id === params.id)
    return nft ? HttpResponse.json(nft) : err(404, 'not_found', 'NFT não encontrado')
  }),
    http.get('/api/cart', async ({ request }) => {
    await ready
    await delay(200)
    await slowDelay()
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
    http.get('/api/wallets', async ({ request }) => {
    await ready
    await delay(200)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const wallets = db.wallets.filter((w) => w.userId === auth.user.id).map(({ userId: _userId, ...w }) => w)
    return HttpResponse.json(wallets)
  }),

  http.post('/api/wallets', async ({ request }) => {
    await ready
    await delay(300)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const body = (await request.json()) as WalletInput

    const fields: Record<string, string> = {}
    if (!body.label?.trim()) fields.label = 'Informe um apelido para a carteira'
    if (!isValidAddress(body.address ?? '')) fields.address = 'Endereço de carteira inválido'
    if (body.kind !== 'primary' && body.kind !== 'secondary') fields.kind = 'Selecione o tipo de carteira'
    if (!body.networks?.length || !body.networks.every((n) => NETWORKS.includes(n))) {
      fields.networks = 'Selecione ao menos uma rede'
    }
    if (Object.keys(fields).length) return err(422, 'validation_error', 'Dados inválidos', fields)

    if (body.kind === 'primary' && db.wallets.some((w) => w.userId === auth.user.id && w.kind === 'primary')) {
      return err(409, 'wallet_primary_conflict', 'Você já tem uma carteira principal', {
        kind: 'Você já tem uma carteira principal. Edite-a ou cadastre esta como secundária.',
      })
    }

    db.wallets.push({
      id: crypto.randomUUID(),
      userId: auth.user.id,
      label: body.label.trim(),
      address: body.address.trim(),
      kind: body.kind,
      networks: body.networks,
    })
    saveWallets()
    const wallets = db.wallets.filter((w) => w.userId === auth.user.id).map(({ userId: _userId, ...w }) => w)
    return HttpResponse.json(wallets, { status: 201 })
  }),

  http.patch('/api/wallets/:id', async ({ request, params }) => {
    await ready
    await delay(300)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const wallet = db.wallets.find((w) => w.id === params.id && w.userId === auth.user.id)
    if (!wallet) return err(404, 'not_found', 'Carteira não encontrada')

    const body = (await request.json()) as WalletInput
    const fields: Record<string, string> = {}
    if (!body.label?.trim()) fields.label = 'Informe um apelido para a carteira'
    if (!isValidAddress(body.address ?? '')) fields.address = 'Endereço de carteira inválido'
    if (body.kind !== 'primary' && body.kind !== 'secondary') fields.kind = 'Selecione o tipo de carteira'
    if (!body.networks?.length || !body.networks.every((n) => NETWORKS.includes(n))) {
      fields.networks = 'Selecione ao menos uma rede'
    }
    if (Object.keys(fields).length) return err(422, 'validation_error', 'Dados inválidos', fields)

    if (
      body.kind === 'primary' &&
      db.wallets.some((w) => w.userId === auth.user.id && w.kind === 'primary' && w.id !== wallet.id)
    ) {
      return err(409, 'wallet_primary_conflict', 'Você já tem uma carteira principal', {
        kind: 'Você já tem uma carteira principal. Edite-a ou cadastre esta como secundária.',
      })
    }

    wallet.label = body.label.trim()
    wallet.address = body.address.trim()
    wallet.kind = body.kind
    wallet.networks = body.networks
    saveWallets()
    const wallets = db.wallets.filter((w) => w.userId === auth.user.id).map(({ userId: _userId, ...w }) => w)
    return HttpResponse.json(wallets)
  }),

  http.post('/api/orders', async ({ request }) => {
    await ready
    await delay(400)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const key = request.headers.get('Idempotency-Key')
    if (!key) return err(400, 'missing_idempotency_key', 'Chave de idempotência ausente')

    const body = (await request.json()) as CreateOrderBody
    const payloadHash = await sha256(JSON.stringify(body))

    // mesma chave + mesmo conteúdo = mesmo pedido; mesma chave + conteúdo diferente = conflito
    const existing = [...db.orders.values()].find((o) => o.userId === auth.user.id && o.idempotencyKey === key)
        if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return err(409, 'idempotency_conflict', 'Esta chave já foi usada com outro conteúdo')
      }
      settleOrder(existing)
      scheduleSettle(existing)
      return HttpResponse.json(toOrder(existing))
    }

    const wallet = db.wallets.find((w) => w.id === body.walletId && w.userId === auth.user.id)
    const fields: Record<string, string> = {}
    if (!body.collector?.name?.trim()) fields.name = 'Informe seu nome'
    if (!/^\S+@\S+\.\S+$/.test(body.collector?.email ?? '')) fields.email = 'E-mail inválido'
    if (!wallet) fields.walletId = 'Selecione uma carteira'
    else if (!wallet.networks.includes(body.network)) fields.network = 'Rede não suportada por esta carteira'
    if (Object.keys(fields).length || !wallet) return err(422, 'validation_error', 'Dados inválidos', fields)

    const cart = buildCart(`u:${auth.user.id}`)
    if (cart.items.length === 0) return err(422, 'empty_cart', 'Seu carrinho está vazio')

    // cotação desatualizada: devolve o carrinho novo e o usuário precisa confirmar de novo
    if (body.quoteId !== cart.quoteId) {
      return HttpResponse.json(
        { code: 'quote_changed', message: 'Preços ou quantidades mudaram. Revise e confirme novamente.', cart },
        { status: 409 },
      )
    }
    const soldOut = cart.items.find((i) => i.quantity > i.nft.editionsAvailable)
    if (soldOut) return err(409, 'stock_conflict', `${soldOut.nft.name}: edição indisponível`)

    const id = crypto.randomUUID()
    const order: StoredOrder = {
      id,
      status: 'pending',
      userId: auth.user.id,
      idempotencyKey: key,
      payloadHash,
      items: cart.items.map((i) => ({
        nftId: i.nft.id,
        name: i.nft.name,
        image: i.nft.image,
        unitPrice: i.nft.price,
        quantity: i.quantity,
      })),
      subtotal: cart.subtotal,
      discount: cart.discount,
      networkFee: cart.networkFee,
      total: cart.total,
      network: body.network,
      walletAddress: wallet.address,
      txHash: null,
      refusalReason: null,
      createdAt: new Date().toISOString(),
      version: 1,
      confirmAt: Date.now() + 2500,
      outcome: scenario() === 'payment_refused' ? 'refused' : 'confirmed',
      cartLines: cart.items.map((i) => ({ nftId: i.nft.id, quantity: i.quantity })),
    }
    db.orders.set(id, order)
    saveOrders()
    scheduleSettle(order)

    // o pedido foi criado, mas a resposta "se perde": o cliente repete com a mesma chave
    if (scenario() === 'order_timeout') return HttpResponse.error()

    // o pedido foi criado, mas a resposta "se perde": o cliente repete com a mesma chave
    if (scenario() === 'order_timeout') return HttpResponse.error()

    return HttpResponse.json(toOrder(order), { status: 201 })
  }),

  http.get('/api/favorites', async ({ request }) => {
    await ready
    await delay(200)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    return HttpResponse.json(db.favorites.get(auth.user.id) ?? [])
  }),

  http.post('/api/favorites', async ({ request }) => {
    await ready
    await delay(300)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const { nftId } = (await request.json()) as { nftId: string }
    if (!db.nfts.some((n) => n.id === nftId)) return err(404, 'not_found', 'NFT não encontrado')
    if (scenario() === 'favorites_fail') return err(500, 'favorites_failed', 'Não foi possível salvar o favorito')
    const current = db.favorites.get(auth.user.id) ?? []
    if (!current.includes(nftId)) db.favorites.set(auth.user.id, [...current, nftId])
    saveFavorites()
    return HttpResponse.json(db.favorites.get(auth.user.id) ?? [], { status: 201 })
  }),

  http.delete('/api/favorites/:nftId', async ({ request, params }) => {
    await ready
    await delay(300)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    if (scenario() === 'favorites_fail') return err(500, 'favorites_failed', 'Não foi possível remover o favorito')
    const current = db.favorites.get(auth.user.id) ?? []
    db.favorites.set(auth.user.id, current.filter((id) => id !== params.nftId))
    saveFavorites()
    return HttpResponse.json(db.favorites.get(auth.user.id) ?? [])
  }),

  http.get('/api/orders/:id', async ({ request, params }) => {
    await ready
    await delay(200)
    const auth = currentUser(request)
    if (!auth) return err(401, 'session_expired', 'Sessão inválida ou expirada')
    const order = db.orders.get(params.id as string)
    if (!order) return err(404, 'not_found', 'Pedido não encontrado')
        if (order.userId !== auth.user.id) return err(403, 'forbidden', 'Você não tem acesso a este pedido')
    settleOrder(order)
    scheduleSettle(order)
    return HttpResponse.json(toOrder(order))
  }),
]