import type { Nft, Network, Wallet } from '@/types/api'

const names = ['Emerald Ape', 'Sage Nomad', 'Neon Vessel', 'Cosmic Bloom', 'Violet Nomad', 'Ivory Baron', 'Golden Beat', 'Golden Signal']
const collections = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'avatares', 'utilidade']
const networks: Network[] = ['ethereum', 'polygon', 'solana']

export const seedNfts: Nft[] = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  name: `${names[i % names.length]} #${100 + ((i * 137) % 900)}`,
  collection: collections[i % collections.length],
  network: networks[Math.floor(i / 3) % 3],
  price: (((i * 37) % 300) / 100 + 0.5).toFixed(2),
  editionsTotal: 10,
  editionsAvailable: i % 7 === 0 ? 0 : 3 + (i % 5),
  image: `/nfts/macaco-${(i % 4) + 1}.png`,
  tag: i < 6 ? 'new' : i % 3 === 0 ? 'trending' : null,
  version: 1,
  createdAt: new Date(Date.UTC(2026, 8, 30) - i * 86_400_000).toISOString(),
}))

// Credenciais fictícias. No banco do mock a senha é guardada só como hash.
export const seedUsers = [
  { id: 'u1', name: 'Ana Colecionadora', email: 'ana@kurio.test', password: 'kurio123' },
  { id: 'u2', name: 'Bruno Colecionador', email: 'bruno@kurio.test', password: 'kurio123' },
]

export const seedWallets: (Wallet & { userId: string })[] = [
  { id: 'w1', userId: 'u1', label: 'Carteira principal', address: '0xA11ce00000000000000000000000000000000001', kind: 'primary', networks: ['ethereum', 'polygon'] },
  { id: 'w2', userId: 'u1', label: 'Carteira secundária', address: 'So1Ana000000000000000000000000000000000002', kind: 'secondary', networks: ['solana'] },
  { id: 'w3', userId: 'u2', label: 'Carteira principal', address: '0xB0b0000000000000000000000000000000000003', kind: 'primary', networks: ['ethereum', 'polygon', 'solana'] },
]