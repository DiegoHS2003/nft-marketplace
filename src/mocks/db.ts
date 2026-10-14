import type { Nft, Order, Wallet } from '@/types/api'
import { seedNfts, seedUsers, seedWallets } from './fixtures'

interface StoredUser {
  id: string
  name: string
  email: string
  passwordHash: string
}

interface StoredCart {
  items: { nftId: string; quantity: number }[]
  coupon: string | null
}

export interface StoredOrder extends Order {
  userId: string
  idempotencyKey: string
  payloadHash: string
  confirmAt: number
  outcome: 'confirmed' | 'refused'
  cartLines: { nftId: string; quantity: number }[]
}

const SESSIONS_KEY = 'kurio:mock-sessions'
const CARTS_KEY = 'kurio:mock-carts'
const ORDERS_KEY = 'kurio:mock-orders'
const NFTS_KEY = 'kurio:mock-nfts'
const USERS_KEY = 'kurio:mock-users'

function loadMap<T>(key: string): Map<string, T> {
  try {
    return new Map(JSON.parse(localStorage.getItem(key) ?? '[]'))
  } catch {
    return new Map()
  }
}

function loadNfts(): Nft[] {
  try {
    const raw = localStorage.getItem(NFTS_KEY)
    if (raw) return JSON.parse(raw) as Nft[]
  } catch {
    // ignora e cai no seed
  }
  return structuredClone(seedNfts)
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const db = {
  nfts: [] as Nft[],
  users: [] as StoredUser[],
  wallets: [] as (Wallet & { userId: string })[],
  sessions: loadMap<string>(SESSIONS_KEY), // token -> userId
  carts: loadMap<StoredCart>(CARTS_KEY), // 'u:<userId>' ou 'g:<guestId>'
  orders: loadMap<StoredOrder>(ORDERS_KEY), // orderId -> pedido
}

export const saveSessions = () => localStorage.setItem(SESSIONS_KEY, JSON.stringify([...db.sessions]))
export const saveCarts = () => localStorage.setItem(CARTS_KEY, JSON.stringify([...db.carts]))
export const saveOrders = () => localStorage.setItem(ORDERS_KEY, JSON.stringify([...db.orders]))
export const saveNfts = () => localStorage.setItem(NFTS_KEY, JSON.stringify(db.nfts))
export const saveUsers = () => localStorage.setItem(USERS_KEY, JSON.stringify(db.users))

function loadUsers(): StoredUser[] | null {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) return JSON.parse(raw) as StoredUser[]
  } catch {
    // ignora e cai no seed
  }
  return null
}

async function seed() {
  db.nfts = loadNfts()
  db.wallets = structuredClone(seedWallets)
  // usuários cadastrados em tempo de execução (POST /auth/register) são salvos aqui com a senha
  // já em hash; só os dois usuários semente precisam ser hasheados na primeira vez
  db.users =
    loadUsers() ??
    (await Promise.all(seedUsers.map(async ({ password, ...u }) => ({ ...u, passwordHash: await sha256(password) }))))
}

export const ready = seed()

// Restaura um cenário conhecido: estoque, carrinhos, pedidos e sessões
export async function resetDb() {
  localStorage.removeItem(NFTS_KEY)
  localStorage.removeItem(USERS_KEY)
  await seed()
  db.nfts = structuredClone(seedNfts)
  db.sessions = new Map()
  db.carts = new Map()
  db.orders = new Map()
  saveSessions()
  saveCarts()
  saveOrders()
}