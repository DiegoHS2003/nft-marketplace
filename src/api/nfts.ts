import { api } from '@/lib/api'
import type { Nft, NftListResponse } from '@/types/api'

export interface NftSearch {
  q?: string
  page: number
  sort: 'recent' | 'price_asc' | 'price_desc'
  tab: 'all' | 'new' | 'trending'
}

export async function fetchNfts(search: NftSearch, signal?: AbortSignal) {
  const { data } = await api.get<NftListResponse>('/nfts', { params: search, signal })
  return data
}

export async function fetchNft(id: string, signal?: AbortSignal) {
  const { data } = await api.get<Nft>(`/nfts/${id}`, { signal })
  return data
}