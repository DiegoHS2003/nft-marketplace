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
  subtotal: string
  discount: string
  networkFee: string
  total: string
}