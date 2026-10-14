import { api } from '@/lib/api'
import type { Nft, NftListResponse } from '@/types/api'

export interface NftSearch {
  q?: string
  page: number
  sort: 'recent' | 'price_asc' | 'price_desc'
  tab: 'all' | 'new' | 'trending'
  collection?: string[]
  network?: string[]
  minPrice?: string
  maxPrice?: string
}

export async function fetchNfts(search: NftSearch, signal?: AbortSignal) {
  const { data } = await api.get<NftListResponse>('/nfts', {
    params: search,
    paramsSerializer: { indexes: null }, // listas viram collection=a&collection=b
    signal,
  })
  return data
}

export async function fetchNft(id: string, signal?: AbortSignal) {
  const { data } = await api.get<Nft>(`/nfts/${id}`, { signal })
  return data
}