import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@/lib/auth'

export const Route = createFileRoute('/_auth/conta')({ component: Conta })

function Conta() {
  const user = useUser()
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl">Minha conta</h1>
      <p className="mt-2">{user?.name} · {user?.email}</p>
    </main>
  )
}