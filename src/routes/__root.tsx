import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Header } from '@/components/Header'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Header />
      <Outlet />
    </>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl">Página não encontrada</h1>
      <Link to="/" className="mt-4 inline-block underline">Ir para o início</Link>
    </main>
  ),
})