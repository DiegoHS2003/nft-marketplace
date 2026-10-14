import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Header } from '@/components/Header'
import { useRealtime } from '@/lib/useRealtime'

function Root() {
  const notice = useRealtime()
  return (
    <>
      <Header />
      {/* região sempre presente, para o leitor de tela anunciar as mudanças */}
      <div
        role="status"
        aria-live="polite"
        className={notice ? 'border-b border-kurio-accent bg-kurio-surface px-6 py-2' : 'sr-only'}
      >
        {notice}
      </div>
      <Outlet />
    </>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl">Página não encontrada</h1>
      <Link to="/" className="mt-4 inline-block underline">Ir para o início</Link>
    </main>
  ),
})