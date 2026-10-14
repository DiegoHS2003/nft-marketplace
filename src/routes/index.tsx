import { createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchNfts, type NftSearch } from '@/api/nfts'

const sorts = ['recent', 'price_asc', 'price_desc'] as const
const tabs = ['all', 'new', 'trending'] as const

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): NftSearch => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    page: Math.max(1, Number(s.page) || 1),
    sort: (sorts as readonly unknown[]).includes(s.sort) ? (s.sort as NftSearch['sort']) : 'recent',
    tab: (tabs as readonly unknown[]).includes(s.tab) ? (s.tab as NftSearch['tab']) : 'all',
  }),
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['nfts', search],
    queryFn: ({ signal }) => fetchNfts(search, signal),
    placeholderData: keepPreviousData,
  })

  // qualquer mudança de filtro volta pra página 1; mudar de página sobrescreve isso
  const update = (patch: Partial<NftSearch>) =>
    navigate({ search: (prev) => ({ ...prev, page: 1, ...patch }) })

  return (
    <main className="mx-auto max-w-5xl p-6">
      <form
        key={search.q ?? ''}
        onSubmit={(e) => {
          e.preventDefault()
          const q = new FormData(e.currentTarget).get('q') as string
          update({ q: q.trim() || undefined })
        }}
        className="mb-4 flex gap-2"
      >
        <input
          name="q"
          defaultValue={search.q}
          placeholder="Buscar NFT"
          aria-label="Buscar NFT"
          className="flex-1 rounded border border-kurio-border bg-kurio-surface px-3 py-2"
        />
        <button className="rounded bg-kurio-accent px-4 py-2 text-kurio-bg">Buscar</button>
      </form>

      <div className="mb-4 flex items-center gap-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => update({ tab: t })}
            aria-pressed={search.tab === t}
            className={search.tab === t ? 'text-kurio-accent underline' : 'text-kurio-muted'}
          >
            {t}
          </button>
        ))}
        <select
          aria-label="Ordenar por"
          value={search.sort}
          onChange={(e) => update({ sort: e.target.value as NftSearch['sort'] })}
          className="ml-auto rounded border border-kurio-border bg-kurio-surface px-2 py-1"
        >
          <option value="recent">Mais recentes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
        </select>
      </div>

      {isPending && <p>Carregando...</p>}

      {isError && (
        <div role="alert">
          <p>Não foi possível carregar os NFTs.</p>
          <button onClick={() => refetch()} className="underline">Tentar de novo</button>
        </div>
      )}

      {data && data.items.length === 0 && <p>Nenhum NFT encontrado.</p>}

      {data && data.items.length > 0 && (
        <>
          <ul className="grid grid-cols-3 gap-4">
            {data.items.map((nft) => (
              <li key={nft.id} className="rounded bg-kurio-surface p-3">
                <img src={nft.image} alt={nft.name} className="aspect-square w-full rounded object-cover" />
                <p className="mt-2">{nft.name}</p>
                <p className="text-kurio-accent">{nft.price} ETH</p>
              </li>
            ))}
          </ul>

          <nav className="mt-6 flex items-center justify-center gap-4" aria-label="Paginação">
            <button disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>Anterior</button>
            <span>Página {data.page} de {data.totalPages}</span>
            <button disabled={data.page >= data.totalPages} onClick={() => update({ page: data.page + 1 })}>Próxima</button>
          </nav>
        </>
      )}
    </main>
  )
}