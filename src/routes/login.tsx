import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/components/auth/AuthScreen'

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    // só aceita caminhos internos, pra não virar redirecionamento aberto
    redirect:
      typeof s.redirect === 'string' && s.redirect.startsWith('/') && !s.redirect.startsWith('//')
        ? s.redirect
        : undefined,
  }),
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect } = Route.useSearch()
  return <AuthScreen mode="login" redirect={redirect} />
}
