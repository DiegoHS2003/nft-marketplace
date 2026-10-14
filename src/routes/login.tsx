import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { login } from '@/api/auth'
import { startSession } from '@/lib/auth'
import type { ApiError } from '@/types/api'

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    // só aceita caminhos internos, pra não virar redirecionamento aberto
    redirect:
      typeof s.redirect === 'string' && s.redirect.startsWith('/') && !s.redirect.startsWith('//')
        ? s.redirect
        : undefined,
  }),
  component: Login,
})

function Login() {
  const { redirect } = Route.useSearch()
  const router = useRouter()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      startSession(qc, data)
      router.history.push(redirect ?? '/')
    },
  })

  const apiError =
    mutation.error && isAxiosError<ApiError>(mutation.error) ? mutation.error.response?.data : undefined

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Informe um e-mail válido'
    if (!password) next.password = 'Informe sua senha'
    setErrors(next)
    if (Object.keys(next).length === 0) mutation.mutate({ email, password })
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl">Entrar</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="rounded border border-kurio-border bg-kurio-surface px-3 py-2"
        />
        {errors.email && <p id="email-error" role="alert" className="text-sm">{errors.email}</p>}

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className="rounded border border-kurio-border bg-kurio-surface px-3 py-2"
        />
        {errors.password && <p id="password-error" role="alert" className="text-sm">{errors.password}</p>}

        {mutation.isError && (
          <p role="alert" className="text-sm">
            {apiError?.message ?? 'Não foi possível entrar. Tente de novo.'}
          </p>
        )}

        <button
          disabled={mutation.isPending}
          className="rounded bg-kurio-accent px-4 py-2 text-kurio-bg disabled:opacity-50"
        >
          {mutation.isPending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}