import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import '@fontsource-variable/roboto-mono'
import './index.css'
import { routeTree } from './routeTree.gen'
import { setSessionExpiredHandler } from './lib/api'
import { endSession, notifySessionExpired } from './lib/auth'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

const router = createRouter({ routeTree, context: { queryClient } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// sessão expirada em qualquer chamada autenticada: encerra, avisa quem precisa salvar contexto
// (ex.: o formulário de pagamento) e manda pro login preservando a rota atual
setSessionExpiredHandler(() => {
  if (window.location.pathname.startsWith('/login')) return
  const redirectTo = window.location.pathname + window.location.search
  endSession(queryClient)
  notifySessionExpired()
  router.navigate({ to: '/login', search: { redirect: redirectTo } })
})

async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})