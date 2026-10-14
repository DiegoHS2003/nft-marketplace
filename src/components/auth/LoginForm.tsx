import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { login } from '@/api/auth'
import { mergeGuestCart } from '@/api/cart'
import { clearSessionExpiredNotice, hasSessionExpiredNotice, startSession } from '@/lib/auth'
import { SocialButtons } from './SocialButtons'
import type { ApiError } from '@/types/api'

interface Props {
  redirect?: string
}

export function LoginForm({ redirect }: Props) {
  const router = useRouter()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sessionExpired] = useState(hasSessionExpiredNotice)
  useEffect(() => {
    if (sessionExpired) clearSessionExpiredNotice()
  }, [sessionExpired])

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      startSession(qc, data)
      await mergeGuestCart().catch(() => undefined) // junta o carrinho do visitante com o da conta
      await qc.invalidateQueries({ queryKey: ['cart'] })
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {sessionExpired && (
        <p role="status" className="text-sm text-kurio-text-secondary">
          Sua sessão expirou. Entre novamente para continuar.
        </p>
      )}

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
      {errors.email && <p id="email-error" role="alert" className="text-sm text-kurio-coral">{errors.email}</p>}

      <label htmlFor="password">Senha</label>
      <div className="relative">
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className="w-full rounded border border-kurio-border bg-kurio-surface px-3 py-2 pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Ocultar caracteres digitados' : 'Mostrar caracteres digitados'}
          className="absolute inset-y-0 right-2 flex items-center text-kurio-text-secondary"
        >
          {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {errors.password && <p id="password-error" role="alert" className="text-sm text-kurio-coral">{errors.password}</p>}

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Fora do escopo do desafio"
        className="self-end text-sm text-kurio-text-secondary underline decoration-dotted disabled:cursor-not-allowed"
      >
        Esqueceu a senha?
      </button>

      {mutation.isError && (
        <p role="alert" className="text-sm text-kurio-coral">
          {apiError?.message ?? 'Não foi possível entrar. Tente de novo.'}
        </p>
      )}

      <button
        disabled={mutation.isPending}
        className="rounded bg-kurio-accent px-4 py-2 font-bold text-kurio-bg disabled:opacity-50"
      >
        {mutation.isPending ? 'Entrando...' : 'Entrar'}
      </button>

      <SocialButtons />
    </form>
  )
}
