import { useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { hasPreviousPage } from '@/lib/navigationHistory'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

type Mode = 'login' | 'register'

interface Props {
  mode: Mode
  redirect?: string
}

const TITLES: Record<Mode, string> = { login: 'Entrar', register: 'Criar conta' }

function FormBody({ mode, redirect }: Props) {
  return mode === 'login' ? <LoginForm redirect={redirect} /> : <RegisterForm redirect={redirect} />
}

function Tabs({ mode, redirect }: Props) {
  const tabClass = (active: boolean) =>
    active
      ? 'border-b-2 border-kurio-primary pb-1 text-kurio-primary'
      : 'pb-1 text-kurio-text-secondary hover:text-kurio-text'
  return (
    <nav aria-label="Alternar entre entrar e criar conta" className="mb-6 flex items-center justify-center gap-6 text-lg">
      <Link to="/login" search={{ redirect }} className={tabClass(mode === 'login')}>Entrar</Link>
      <Link to="/cadastro" search={{ redirect }} className={tabClass(mode === 'register')}>Criar conta</Link>
    </nav>
  )
}

export function AuthScreen({ mode, redirect }: Props) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) return <AuthDialog mode={mode} redirect={redirect} />

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center p-6">
      <p className="text-center text-xl font-bold tracking-[0.3em] text-kurio-primary">KURIO</p>
      <h1 className="mb-4 mt-10 text-center text-2xl">{TITLES[mode]}</h1>
      <FormBody mode={mode} redirect={redirect} />
      <p className="mt-4 text-center text-sm text-kurio-text-secondary">
        {mode === 'login' ? (
          <>
            Novo na Kurio?{' '}
            <Link to="/cadastro" search={{ redirect }} className="text-kurio-text-accent underline">
              Crie uma conta
            </Link>
          </>
        ) : (
          <>
            Já tem uma conta?{' '}
            <Link to="/login" search={{ redirect }} className="text-kurio-text-accent underline">
              Entre
            </Link>
          </>
        )}
      </p>
    </main>
  )
}

// No Figma desktop, login/cadastro aparecem como um diálogo sobre a Início. Como as rotas trocam a
// tela inteira (sem manter a Início montada atrás), o fundo é um overlay escuro sólido, não a Início
// desfocada — ver ARCHITECTURE.md.
function AuthDialog({ mode, redirect }: Props) {
  const [open, setOpen] = useState(true)
  const router = useRouter()
  const closingRef = useRef(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next && !closingRef.current) {
      closingRef.current = true
      // só volta no histórico se veio de outra página do próprio app; senão (acesso direto à
      // rota) voltar cairia numa aba em branco, então manda pra Início
      if (hasPreviousPage()) router.history.back()
      else router.navigate({ to: '/' })
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Popup
          aria-modal="true"
          className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-kurio-border bg-kurio-card p-6 shadow-xl"
        >
          <Dialog.Title className="sr-only">{TITLES[mode]}</Dialog.Title>
          <Tabs mode={mode} redirect={redirect} />
          <FormBody mode={mode} redirect={redirect} />
          <Dialog.Close
            aria-label="Fechar"
            className="absolute right-4 top-4 text-kurio-text-secondary hover:text-kurio-text"
          >
            <X aria-hidden="true" className="size-5" />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
