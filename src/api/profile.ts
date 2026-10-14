import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { sessionQueryOptions, useUser } from '@/lib/auth'
import type { PasswordChangeBody, ProfileUpdateBody, User } from '@/types/api'

export const profileQueryOptions = queryOptions({
  queryKey: ['profile'],
  queryFn: async ({ signal }) => (await api.get<User>('/profile', { signal })).data,
})

export function useProfile() {
  const user = useUser()
  return useQuery({ ...profileQueryOptions, enabled: !!user })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: ProfileUpdateBody) => (await api.patch<User>('/profile', body)).data,
    onSuccess: (user) => {
      qc.setQueryData(profileQueryOptions.queryKey, user)
      // o cabeçalho e o resto do app leem a sessão; mantém nome/e-mail sincronizados ali também
      qc.setQueryData(sessionQueryOptions.queryKey, user)
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: PasswordChangeBody) => {
      await api.post('/profile/password', body)
    },
  })
}
