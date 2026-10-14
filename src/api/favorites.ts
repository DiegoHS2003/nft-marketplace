import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUser } from '@/lib/auth'

export const favoritesQueryOptions = queryOptions({
  queryKey: ['favorites'],
  queryFn: async ({ signal }) => (await api.get<string[]>('/favorites', { signal })).data,
})

// só autenticado tem favoritos; visitante nunca dispara a consulta
export function useFavorites() {
  const user = useUser()
  return useQuery({ ...favoritesQueryOptions, enabled: !!user })
}

// Atualização otimista: marca/desmarca na hora e volta atrás se a API recusar
export function useToggleFavorite() {
  const qc = useQueryClient()
  const key = favoritesQueryOptions.queryKey
  return useMutation({
    mutationFn: async ({ nftId, favorited }: { nftId: string; favorited: boolean }) =>
      favorited
        ? (await api.delete<string[]>(`/favorites/${nftId}`)).data
        : (await api.post<string[]>('/favorites', { nftId })).data,
    onMutate: async ({ nftId, favorited }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<string[]>(key) ?? []
      const next = favorited ? previous.filter((id) => id !== nftId) : [...previous, nftId]
      qc.setQueryData<string[]>(key, next)
      return { previous }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
