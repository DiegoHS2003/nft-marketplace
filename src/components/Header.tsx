import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { logout } from '@/api/auth'
import { useCart } from '@/api/cart'
import { endSession, useUser } from '@/lib/auth'

const OUT_OF_SCOPE = ['Mercado', 'Criadores', 'Aprenda']

function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir busca" className="p-1">
        <Search aria-hidden="true" className="size-5" />
      </button>
    )
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const value = (new FormData(e.currentTarget).get('q') as string).trim()
        navigate({ to: '/', search: { q: value || undefined } })
        setOpen(false)
      }}
      className="flex items-center gap-1"
    >
      <label htmlFor="header-search" className="sr-only">Buscar NFT</label>
      <input
        id="header-search"
        ref={inputRef}
        name="q"
        placeholder="Buscar NFT"
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="w-32 rounded border border-kurio-border bg-kurio-ink-soft px-2 py-1 text-sm transition-[width] duration-200 motion-reduce:transition-none sm:w-48"
      />
      <button type="submit" aria-label="Buscar" className="p-1">
        <Search aria-hidden="true" className="size-4" />
      </button>
    </form>
  )
}

export function Header() {
  const user = useUser()
  const { data: cart } = useCart()
  const qc = useQueryClient()
  const router = useRouter()
  const count = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0

  async function onLogout() {
    try {
      await logout()
    } finally {
      endSession(qc)
      router.history.push('/')
    }
  }

  return (
    <header className="border-b border-kurio-border bg-kurio-ink-deep">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-8 sm:px-6">
        <Link to="/" className="text-lg font-bold tracking-[0.3em] text-kurio-primary">KURIO</Link>

        <nav aria-label="Principal" className="hidden items-center gap-6 text-sm md:flex">
          <Link to="/" className="border-b-2 border-kurio-primary pb-1 text-kurio-primary">Início</Link>
          {OUT_OF_SCOPE.map((label) => (
            <Link
              key={label}
              to="/fora-do-escopo"
              search={{ secao: label }}
              className="text-kurio-text-secondary hover:text-kurio-text"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm sm:gap-4">
          <div className="hidden md:block">
            <HeaderSearch />
          </div>

          <Link
            to="/carrinho"
            aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
            className="relative p-1"
          >
            <ShoppingCart aria-hidden="true" className="size-5" />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-kurio-primary text-[10px] font-bold text-kurio-ink"
              >
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <>
              <Link to="/conta" className="max-w-[7rem] truncate underline sm:max-w-none">{user.name}</Link>
              <button onClick={onLogout}>Sair</button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1 rounded border border-kurio-primary px-3 py-1 text-kurio-primary"
            >
              <LogIn aria-hidden="true" className="size-4" />
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}