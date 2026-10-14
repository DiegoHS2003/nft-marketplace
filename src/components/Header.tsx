import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { logout } from '@/api/auth'
import { endSession, useUser } from '@/lib/auth'
import { useCart } from '@/api/cart'

export function Header() {
  const user = useUser()
    const { data: cart } = useCart()
  const count = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0
  const qc = useQueryClient()
  const router = useRouter()

  async function onLogout() {
    try {
      await logout()
    } finally {
      endSession(qc)
      router.history.push('/')
    }
  }

  return (
    <header className="flex items-center gap-4 border-b border-kurio-border px-6 py-3">
      <Link to="/" className="font-bold text-kurio-accent">KURIO</Link>
      <nav className="ml-auto flex items-center gap-4">
                <Link to="/carrinho">Carrinho ({count})</Link>
        {user ? (
          <>
            <Link to="/conta" className="underline">{user.name}</Link>
            <button onClick={onLogout}>Sair</button>
          </>
        ) : (
          <Link to="/login" className="rounded bg-kurio-accent px-3 py-1 text-kurio-bg">Entrar</Link>
        )}
      </nav>
    </header>
  )
}
