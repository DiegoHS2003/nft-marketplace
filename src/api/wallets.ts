import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Wallet, WalletInput } from '@/types/api'

export const walletsQueryOptions = queryOptions({
  queryKey: ['wallets'],
  queryFn: async ({ signal }) => (await api.get<Wallet[]>('/wallets', { signal })).data,
})

export const useWallets = () => useQuery(walletsQueryOptions)

export function useAddWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: WalletInput) => (await api.post<Wallet[]>('/wallets', body)).data,
    onSuccess: (wallets) => qc.setQueryData(walletsQueryOptions.queryKey, wallets),
  })
}

export function useUpdateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: WalletInput }) =>
      (await api.patch<Wallet[]>(`/wallets/${id}`, body)).data,
    onSuccess: (wallets) => qc.setQueryData(walletsQueryOptions.queryKey, wallets),
  })
}
