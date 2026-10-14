import type { Nft } from '@/types/api'
import { seedNfts, seedUsers } from './fixtures'

interface StoredUser {
  id: string
  name: string
  email: string
  passwordHash: string
}

const SESSIONS_KEY = 'kurio:mock-sessions'

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function loadSessions(): Map<string, string> {
  try {
    return new Map(JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]'))
  } catch {
    return new Map()
  }
}

export const db = {
  nfts: [] as Nft[],
  users: [] as StoredUser[],
  sessions: loadSessions(), // token -> userId
}

export function saveSessions() {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([...db.sessions]))
}

export async function resetDb() {
  db.nfts = structuredClone(seedNfts)
  db.users = await Promise.all(
    seedUsers.map(async ({ password, ...u }) => ({ ...u, passwordHash: await sha256(password) })),
  )
  db.sessions = new Map()
  saveSessions()
}

export const ready = (async () => {
  db.nfts = structuredClone(seedNfts)
  db.users = await Promise.all(
    seedUsers.map(async ({ password, ...u }) => ({ ...u, passwordHash: await sha256(password) })),
  )
})()