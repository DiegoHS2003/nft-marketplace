import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogIn, ShoppingCart } from 'lucide-react'
import { logout } from '@/api/auth'
import { useCart } from '@/api/cart'
import { endSession, useUser } from '@/lib/auth'

const OUT_OF_SCOPE = ['Mercado', 'Criadores', 'Aprenda']

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
            <span
              key={label}
              aria-disabled="true"
              title="Fora do escopo do desafio"
              className="cursor-not-allowed text-kurio-text-secondary opacity-60"
            >
              {label}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm sm:gap-4">
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