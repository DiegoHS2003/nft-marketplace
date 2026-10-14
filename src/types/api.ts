export type Network = 'ethereum' | 'polygon' | 'solana'

export interface Nft {
  id: string
  name: string
  collection: string
  network: Network
  price: string // ETH como string decimal, nunca number
  editionsAvailable: number
  editionsTotal: number
  image: string
  tag: 'new' | 'trending' | null
  version: number
  createdAt: string
}

export interface NftListResponse {
  items: Nft[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface NftFacets {
  collections: Record<string, number>
  networks: Record<string, number>
  priceBounds: { min: string; max: string }
}

export interface User {
  id: string
  name: string
  email: string
}

export interface SessionResponse {
  user: User
  token: string
}

export interface ApiError {
  code: string
  message: string
  fields?: Record<string, string>
}

export interface CartLine {
  nft: Nft
  quantity: number
}

export interface Cart {
  items: CartLine[]
  coupon: string | null
  quoteId: string
  subtotal: string
  discount: string
  networkFee: string
  total: string
}

export interface Wallet {
  id: string
  label: string
  address: string
  kind: 'primary' | 'secondary'
  networks: Network[]
}

export interface OrderItem {
  nftId: string
  name: string
  image: string
  unitPrice: string
  quantity: number
}

export type OrderStatus = 'pending' | 'confirmed' | 'refused'

export interface Order {
  id: string
  status: OrderStatus
  items: OrderItem[]
  subtotal: string
  discount: string
  networkFee: string
  total: string
  network: Network
  walletAddress: string
  txHash: string | null
  refusalReason: string | null
  createdAt: string
  version: number
}

export interface CreateOrderBody {
  quoteId: string
  walletId: string
  network: Network
  collector: { name: string; email: string }
}

export interface RealtimeEvent<T> {
  id: string
  resource: { type: 'nft' | 'order'; id: string }
  version: number
  data: T
}

export interface NftUpdate {
  price: string
  editionsAvailable: number
}

export interface OrderUpdate {
  status: OrderStatus
  txHash: string | null
  refusalReason: string | null
}