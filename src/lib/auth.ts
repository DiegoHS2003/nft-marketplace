import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import { fetchSession } from '@/api/auth'
import type { User } from '@/types/api'

const TOKEN_KEY = 'kurio:token'
const PUBLIC_KEYS = ['nfts', 'nft', 'session'] // não apagar: o Header escuta a sessão

export const sessionQueryOptions = queryOptions<User | null>({
  queryKey: ['session'],
  queryFn: ({ signal }) => fetchSession(signal),
  retry: false,
  staleTime: 60_000,
})

function clearPrivateCache(qc: QueryClient) {
  qc.resetQueries({ predicate: (q) => !PUBLIC_KEYS.includes(q.queryKey[0] as string) })
}

export function startSession(qc: QueryClient, { token, user }: { token: string; user: User }) {
  clearPrivateCache(qc) // nada do usuário anterior fica no cache
  localStorage.setItem(TOKEN_KEY, token)
  qc.setQueryData(sessionQueryOptions.queryKey, user)
}

export function endSession(qc: QueryClient) {
  localStorage.removeItem(TOKEN_KEY)
  clearPrivateCache(qc)
  qc.setQueryData(sessionQueryOptions.queryKey, null)
}

export async function getCurrentUser(qc: QueryClient) {
  if (!localStorage.getItem(TOKEN_KEY)) return null
  try {
    return await qc.ensureQueryData(sessionQueryOptions)
  } catch {
    endSession(qc)
    return null
  }
}

export function useUser() {
  const { data } = useQuery({ ...sessionQueryOptions, enabled: !!localStorage.getItem(TOKEN_KEY) })
  return data ?? null
}