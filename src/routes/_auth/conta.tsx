import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { useChangePassword, useProfile, useUpdateProfile } from '@/api/profile'
import { useUser } from '@/lib/auth'
import { AccountSidebar } from '@/components/account/AccountSidebar'
import type { ApiError } from '@/types/api'

export const Route = createFileRoute('/_auth/conta')({ component: Conta })

const MAX_AVATAR_BYTES = 200 * 1024

const card = 'rounded-2xl bg-kurio-card p-5'
const input = 'w-full rounded-lg border border-kurio-border bg-kurio-ink-soft px-3 py-2 text-sm'
const label = 'mb-1 block text-sm text-kurio-text-secondary'
const fieldError = 'mt-1 text-sm text-kurio-coral'

function ProfileForm() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [initialized, setInitialized] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (profile && !initialized) {
      setName(profile.name)
      setEmail(profile.email)
      setInitialized(true)
    }
  }, [profile, initialized])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Informe seu nome'
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Informe um e-mail válido'
    setErrors(next)
    if (Object.keys(next).length) return
    updateProfile.mutate(
      { name, email },
      {
        onError: (error) => {
          if (isAxiosError<ApiError>(error) && error.response?.data.fields) setErrors(error.response.data.fields)
        },
      },
    )
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (dataUrl.length > MAX_AVATAR_BYTES) {
        setErrors((prev) => ({ ...prev, avatar: 'A imagem precisa ter até 200 KB.' }))
        return
      }
      setErrors((prev) => ({ ...prev, avatar: '' }))
      // usa os dados já salvos (não o rascunho do formulário), pra não gravar uma edição de nome/e-mail
      // ainda não confirmada só porque o avatar mudou
      updateProfile.mutate({ name: profile?.name ?? name, email: profile?.email ?? email, avatar: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  return (
    <form onSubmit={onSubmit} noValidate className={card}>
      <h2 className="mb-4 text-lg font-bold text-kurio-text">Perfil do colecionador</h2>
      <div className="flex flex-col gap-3 sm:max-w-md">
        <div>
          <label htmlFor="profile-name" className={label}>Nome de exibição</label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'profile-name-error' : undefined}
            className={input}
          />
          {errors.name && <p id="profile-name-error" role="alert" className={fieldError}>{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="profile-email" className={label}>E-mail</label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'profile-email-error' : undefined}
            className={input}
          />
          {errors.email && <p id="profile-email-error" role="alert" className={fieldError}>{errors.email}</p>}
        </div>

        <div>
          <span className={label}>Avatar</span>
          <div className="flex items-center gap-3">
            {profile?.avatar ? (
              <img src={profile.avatar} alt="Avatar do colecionador" className="size-12 rounded-full object-cover" />
            ) : (
              <div aria-hidden="true" className="size-12 rounded-full bg-kurio-ink-soft" />
            )}
            <label className="cursor-pointer rounded-lg border border-kurio-border px-3 py-1.5 text-sm text-kurio-text hover:bg-kurio-ink-soft">
              Alterar
              <input type="file" accept="image/*" onChange={onAvatarChange} className="sr-only" />
            </label>
            {profile?.avatar && (
              <button
                type="button"
                onClick={() => updateProfile.mutate({ name: profile?.name ?? name, email: profile?.email ?? email, avatar: null })}
                className="text-sm text-kurio-text-secondary underline"
              >
                Remover
              </button>
            )}
          </div>
          {errors.avatar && <p role="alert" className={fieldError}>{errors.avatar}</p>}
        </div>

        {updateProfile.isError &&
          isAxiosError<ApiError>(updateProfile.error) &&
          !updateProfile.error.response?.data.fields && (
            <p role="alert" className={fieldError}>
              {updateProfile.error.response?.data.message ?? 'Não foi possível salvar. Tente de novo.'}
            </p>
          )}
        {updateProfile.isSuccess && (
          <p role="status" className="text-sm text-kurio-success">Dados atualizados.</p>
        )}

        <button
          disabled={updateProfile.isPending}
          className="self-start rounded-lg bg-kurio-accent px-4 py-2 font-bold text-kurio-bg disabled:opacity-50"
        >
          {updateProfile.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

function PasswordField({
  id,
  labelText,
  value,
  onChange,
  error,
}: {
  id: string
  labelText: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={label}>{labelText}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${input} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ocultar caracteres digitados' : 'Mostrar caracteres digitados'}
          className="absolute inset-y-0 right-2 flex items-center text-kurio-text-secondary"
        >
          {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className={fieldError}>{error}</p>}
    </div>
  )
}

function PasswordForm() {
  const changePassword = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!currentPassword) next.currentPassword = 'Informe sua senha atual'
    if (newPassword.length < 8) next.newPassword = 'A nova senha precisa ter ao menos 8 caracteres'
    if (confirmPassword !== newPassword) next.confirmPassword = 'As senhas não coincidem'
    setErrors(next)
    if (Object.keys(next).length) return
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        },
        onError: (error) => {
          if (isAxiosError<ApiError>(error) && error.response?.data.fields) setErrors(error.response.data.fields)
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className={card}>
      <h2 className="mb-4 text-lg font-bold text-kurio-text">Alterar senha</h2>
      <div className="flex flex-col gap-3 sm:max-w-md">
        <PasswordField
          id="current-password"
          labelText="Senha atual"
          value={currentPassword}
          onChange={setCurrentPassword}
          error={errors.currentPassword}
        />
        <PasswordField
          id="new-password"
          labelText="Nova senha"
          value={newPassword}
          onChange={setNewPassword}
          error={errors.newPassword}
        />
        <PasswordField
          id="confirm-new-password"
          labelText="Confirmar nova senha"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirmPassword}
        />

        {changePassword.isError &&
          isAxiosError<ApiError>(changePassword.error) &&
          !changePassword.error.response?.data.fields && (
            <p role="alert" className={fieldError}>
              {changePassword.error.response?.data.message ?? 'Não foi possível alterar a senha. Tente de novo.'}
            </p>
          )}
        {changePassword.isSuccess && (
          <p role="status" className="text-sm text-kurio-success">Senha alterada.</p>
        )}

        <button
          disabled={changePassword.isPending}
          className="self-start rounded-lg bg-kurio-accent px-4 py-2 font-bold text-kurio-bg disabled:opacity-50"
        >
          {changePassword.isPending ? 'Alterando...' : 'Alterar senha'}
        </button>
      </div>
    </form>
  )
}

function Conta() {
  const user = useUser()
  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-6 md:pt-8">
      <h1 className="text-2xl font-bold text-kurio-text">Minha conta</h1>
      <p className="mt-1 text-sm text-kurio-text-secondary">{user?.email}</p>

      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
        <AccountSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <ProfileForm />
          <PasswordForm />
        </div>
      </div>
    </main>
  )
}
