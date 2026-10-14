import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { register } from '@/api/auth'
import { mergeGuestCart } from '@/api/cart'
import { startSession } from '@/lib/auth'
import { SocialButtons } from './SocialButtons'
import type { ApiError } from '@/types/api'

interface Props {
  redirect?: string
}

export function RegisterForm({ redirect }: Props) {
  const router = useRouter()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: async (data) => {
      startSession(qc, data)
      await mergeGuestCart().catch(() => undefined) // junta o carrinho do visitante com o da conta
      await qc.invalidateQueries({ queryKey: ['cart'] })
      router.history.push(redirect ?? '/')
    },
    onError: (error) => {
      // 422 (validação) e 409 (e-mail repetido) vêm com fields por campo
      if (isAxiosError<ApiError>(error) && error.response?.data.fields) {
        setErrors(error.response.data.fields)
      }
    },
  })

  const apiError =
    mutation.error && isAxiosError<ApiError>(mutation.error) ? mutation.error.response?.data : undefined
  const topLevelError = apiError && !apiError.fields ? apiError.message : undefined

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Informe seu nome'
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Informe um e-mail válido'
    if (password.length < 8) next.password = 'A senha precisa ter ao menos 8 caracteres'
    if (confirmPassword !== password) next.confirmPassword = 'As senhas não coincidem'
    setErrors(next)
    if (Object.keys(next).length === 0) mutation.mutate({ name, email, password })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <label htmlFor="name">Nome de usuário</label>
      <input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-invalid={!!errors.name}
        aria-describedby={errors.name ? 'name-error' : undefined}
        className="rounded border border-kurio-border bg-kurio-surface px-3 py-2"
      />
      {errors.name && <p id="name-error" role="alert" className="text-sm text-kurio-coral">{errors.name}</p>}

      <label htmlFor="reg-email">E-mail</label>
      <input
        id="reg-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={!!errors.email}
        aria-describedby={errors.email ? 'reg-email-error' : undefined}
        className="rounded border border-kurio-border bg-kurio-surface px-3 py-2"
      />
      {errors.email && <p id="reg-email-error" role="alert" className="text-sm text-kurio-coral">{errors.email}</p>}

      <label htmlFor="reg-password">Senha</label>
      <div className="relative">
        <input
          id="reg-password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'reg-password-error' : undefined}
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
      {errors.password && <p id="reg-password-error" role="alert" className="text-sm text-kurio-coral">{errors.password}</p>}

      <label htmlFor="confirm-password">Confirmar senha</label>
      <input
        id="confirm-password"
        type={showPassword ? 'text' : 'password'}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        aria-invalid={!!errors.confirmPassword}
        aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
        className="rounded border border-kurio-border bg-kurio-surface px-3 py-2"
      />
      {errors.confirmPassword && (
        <p id="confirm-password-error" role="alert" className="text-sm text-kurio-coral">{errors.confirmPassword}</p>
      )}

      {topLevelError && <p role="alert" className="text-sm text-kurio-coral">{topLevelError}</p>}

      <button
        disabled={mutation.isPending}
        className="rounded bg-kurio-accent px-4 py-2 font-bold text-kurio-bg disabled:opacity-50"
      >
        {mutation.isPending ? 'Criando conta...' : 'Criar conta'}
      </button>

      <SocialButtons />
    </form>
  )
}
