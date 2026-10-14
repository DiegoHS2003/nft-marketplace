import { api } from '@/lib/api'
import type { SessionResponse, User } from '@/types/api'

export async function login(body: { email: string; password: string }) {
  return (await api.post<SessionResponse>('/auth/login', body)).data
}

export async function register(body: { name: string; email: string; password: string }) {
  return (await api.post<SessionResponse>('/auth/register', body)).data
}

export async function fetchSession(signal?: AbortSignal) {
  return (await api.get<{ user: User }>('/auth/session', { signal })).data.user
}

export function logout() {
  return api.post('/auth/logout')
}