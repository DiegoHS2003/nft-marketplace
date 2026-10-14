import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/components/auth/AuthScreen'

export const Route = createFileRoute('/cadastro')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect:
      typeof s.redirect === 'string' && s.redirect.startsWith('/') && !s.redirect.startsWith('//')
        ? s.redirect
        : undefined,
  }),
  component: CadastroRoute,
})

function CadastroRoute() {
  const { redirect } = Route.useSearch()
  return <AuthScreen mode="register" redirect={redirect} />
}
