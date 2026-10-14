import { queryOptions, useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import type { CreateOrderBody, Order, Wallet } from '@/types/api'

export const walletsQueryOptions = queryOptions({
  queryKey: ['wallets'],
  queryFn: async ({ signal }) => (await api.get<Wallet[]>('/wallets', { signal })).data,
})

export const orderQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['order', id],
    queryFn: async ({ signal }) => (await api.get<Order>(`/orders/${id}`, { signal })).data,
    // enquanto pendente, consulta de novo; confirmado e recusado são finais
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 1500 : false),
  })

export function useCreateOrder() {
  return useMutation({
    mutationFn: async ({ body, idempotencyKey }: { body: CreateOrderBody; idempotencyKey: string }) =>
      (await api.post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } })).data,
    // queda de conexão ou timeout: repete com a MESMA chave, então o servidor devolve o mesmo pedido
    retry: (count, error) => isAxiosError(error) && !error.response && count < 2,
    retryDelay: 800,
  })
}