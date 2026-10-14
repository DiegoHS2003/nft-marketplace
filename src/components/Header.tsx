import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { logout } from '@/api/auth'
import { endSession, useUser } from '@/lib/auth'

export function Header() {
  const user = useUser()
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
