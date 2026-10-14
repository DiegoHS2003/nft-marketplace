import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getGuestId } from '@/lib/api'
import type { Cart } from '@/types/api'

export const cartQueryOptions = queryOptions({
  queryKey: ['cart'],
  queryFn: async ({ signal }) => (await api.get<Cart>('/cart', { signal })).data,
})

export const useCart = () => useQuery(cartQueryOptions)

export async function mergeGuestCart() {
  await api.post('/cart/merge', { guestId: getGuestId() })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { nftId: string; quantity: number }) => (await api.post<Cart>('/cart/items', v)).data,
    onSuccess: (cart) => qc.setQueryData(cartQueryOptions.queryKey, cart),
  })
}

// Atualização otimista: a quantidade muda na hora e volta atrás se a API recusar
export function useUpdateQuantity() {
  const qc = useQueryClient()
  const key = cartQueryOptions.queryKey
  return useMutation({
    mutationFn: async (v: { nftId: string; quantity: number }) =>
      (await api.patch<Cart>(`/cart/items/${v.nftId}`, { quantity: v.quantity })).data,
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Cart>(key)
      if (previous) {
        qc.setQueryData<Cart>(key, {
          ...previous,
          items: previous.items.map((i) => (i.nft.id === v.nftId ? { ...i, quantity: v.quantity } : i)),
        })
      }
      return { previous }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useRemoveItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nftId: string) => (await api.delete<Cart>(`/cart/items/${nftId}`)).data,
    onSuccess: (cart) => qc.setQueryData(cartQueryOptions.queryKey, cart),
  })
}

export function useApplyCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => (await api.post<Cart>('/cart/coupon', { code })).data,
    onSuccess: (cart) => qc.setQueryData(cartQueryOptions.queryKey, cart),
  })
}

export function useRemoveCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.delete<Cart>('/cart/coupon')).data,
    onSuccess: (cart) => qc.setQueryData(cartQueryOptions.queryKey, cart),
  })
}