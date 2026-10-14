import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/fora-do-escopo')({
  validateSearch: (s: Record<string, unknown>) => ({
    secao: typeof s.secao === 'string' ? s.secao : undefined,
  }),
  component: ForaDoEscopo,
})

function ForaDoEscopo() {
  const { secao } = Route.useSearch()

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-kurio-foreground">
        {secao ? `${secao} está fora do escopo do desafio` : 'Fora do escopo do desafio'}
      </h1>
      <p className="mt-3 text-kurio-text-secondary">
        Esta área não faz parte da entrega. Volte para o início para continuar explorando o catálogo.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded bg-kurio-primary px-5 py-2 text-sm font-bold uppercase text-kurio-ink hover:bg-kurio-primary-light"
      >
        Ir para o início
      </Link>
    </main>
  )
}
