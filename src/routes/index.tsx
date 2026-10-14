import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { fetchNfts, type NftSearch } from '@/api/nfts'
import { CatalogFilters } from '@/components/CatalogFilters'

const SORTS = ['recent', 'price_asc', 'price_desc'] as const
const TABS = [
  ['all', 'Todos os NFTs'],
  ['new', 'Novos lançamentos'],
  ['trending', 'Em alta'],
] as const

const list = (v: unknown): string[] | undefined => {
  const items = (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).filter(
    (x): x is string => typeof x === 'string' && x !== '',
  )
  return items.length ? items : undefined
}

const eth = (v: unknown) => {
  const s = typeof v === 'number' ? String(v) : v
  return typeof s === 'string' && /^\d+(\.\d{1,18})?$/.test(s) ? s : undefined
}

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): Partial<NftSearch> => {
    const page = Number(s.page)
    const tab = TABS.find(([value]) => value === s.tab)?.[0]
    return {
      q: typeof s.q === 'string' && s.q ? s.q : undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
      sort: (SORTS as readonly unknown[]).includes(s.sort) && s.sort !== 'recent' ? (s.sort as NftSearch['sort']) : undefined,
      tab: tab && tab !== 'all' ? tab : undefined,
      collection: list(s.collection),
      network: list(s.network),
      minPrice: eth(s.minPrice),
      maxPrice: eth(s.maxPrice),
    }
  },
  component: Home,
})

function Home() {
  const { q, page = 1, sort = 'recent', tab = 'all', collection, network, minPrice, maxPrice } = Route.useSearch()
  const search: NftSearch = { q, page, sort, tab, collection, network, minPrice, maxPrice }
  const navigate = Route.useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['nfts', search],
    queryFn: ({ signal }) => fetchNfts(search, signal),
    placeholderData: keepPreviousData,
  })

  // qualquer mudança de filtro volta pra página 1; mudar de página sobrescreve isso
  const update = (patch: Partial<NftSearch>) =>
    navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }) })

  const goToPage = (p: number) => update({ page: p > 1 ? p : undefined })

  return (
    <main>
      <section className="border-b border-kurio-border bg-kurio-ink-soft">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
          <div>
            <p className="text-sm text-kurio-text-accent">Bem-vindo à Kurio</p>
            <h1 className="mt-3 text-3xl font-bold uppercase leading-tight text-kurio-foreground sm:text-4xl lg:text-5xl">
              Seja dono do futuro da arte digital
            </h1>
            <p className="mt-4 max-w-md text-sm text-kurio-text-secondary">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara,
              apoie artistas e tenha uma parte da cultura do amanhã.
            </p>
            <a
              href="#catalogo"
              className="mt-6 inline-block rounded bg-kurio-primary px-5 py-2 text-sm font-bold uppercase text-kurio-ink hover:bg-kurio-primary-light"
            >
              Explorar
            </a>
          </div>
          <img
            src="/nfts/macaco-1.png"
            alt="Macaco de óculos e jaqueta verde, NFT em destaque"
            className="aspect-square w-full max-w-md justify-self-center rounded-2xl object-cover md:justify-self-end"
          />
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[240px_1fr]">
        <aside aria-label="Filtros">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="catalog-filters"
            className="mb-3 inline-flex items-center gap-2 rounded border border-kurio-border px-3 py-2 text-sm md:hidden"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Filtros
          </button>
          <div id="catalog-filters" className={`${filtersOpen ? 'block' : 'hidden'} md:block`}>
            <CatalogFilters
              key={`${minPrice ?? ''}-${maxPrice ?? ''}`}
              search={search}
              onChange={update}
            />
          </div>
        </aside>

        <section id="catalogo" aria-label="Catálogo">
          <form
            key={q ?? ''}
            onSubmit={(e) => {
              e.preventDefault()
              const value = new FormData(e.currentTarget).get('q') as string
              update({ q: value.trim() || undefined })
            }}
            className="mb-4 flex gap-2"
          >
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar NFT"
              aria-label="Buscar NFT"
              className="min-w-0 flex-1 rounded border border-kurio-border bg-kurio-card px-3 py-2 text-sm"
            />
            <button className="rounded bg-kurio-primary px-4 py-2 text-sm font-bold text-kurio-ink hover:bg-kurio-primary-light">
              Buscar
            </button>
          </form>

          <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => update({ tab: value === 'all' ? undefined : value })}
                aria-pressed={tab === value}
                className={
                  tab === value
                    ? 'border-b-2 border-kurio-primary pb-1 text-kurio-primary'
                    : 'pb-1 text-kurio-text-secondary hover:text-kurio-text'
                }
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="sort" className="sr-only">Ordenar por</label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => update({ sort: e.target.value === 'recent' ? undefined : (e.target.value as NftSearch['sort']) })}
                className="rounded border border-kurio-border bg-kurio-card px-2 py-1.5"
              >
                <option value="recent">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
              </select>
            </div>
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
              <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {data.items.map((nft) => (
                  <li key={nft.id} className="rounded-lg bg-kurio-card p-3">
                    <Link to="/nfts/$id" params={{ id: nft.id }} className="block">
                      <img
                        src={nft.image}
                        alt={nft.name}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                      <p className="mt-3 text-sm text-kurio-foreground">{nft.name}</p>
                    </Link>
                    <p className="mt-1 text-sm font-bold text-kurio-primary">{nft.price} ETH</p>
                    {nft.editionsAvailable === 0 && <p className="text-xs text-kurio-coral">Esgotado</p>}
                  </li>
                ))}
              </ul>

              <nav aria-label="Paginação" className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
                <button
                  aria-label="Página anterior"
                  disabled={data.page <= 1}
                  onClick={() => goToPage(data.page - 1)}
                  className="rounded border border-kurio-border px-3 py-1 disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    aria-current={p === data.page ? 'page' : undefined}
                    className={
                      p === data.page
                        ? 'rounded bg-kurio-primary px-3 py-1 font-bold text-kurio-ink'
                        : 'rounded border border-kurio-border px-3 py-1'
                    }
                  >
                    {p}
                  </button>
                ))}
                <button
                  aria-label="Próxima página"
                  disabled={data.page >= data.totalPages}
                  onClick={() => goToPage(data.page + 1)}
                  className="rounded border border-kurio-border px-3 py-1 disabled:opacity-40"
                >
                  ›
                </button>
                <p className="w-full text-center text-xs text-kurio-muted">
                  Página {data.page} de {data.totalPages}
                </p>
              </nav>
            </>
          )}
        </section>
      </div>
    </main>
  )
}