import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal } from 'lucide-react'
import { fetchNfts, type NftSearch } from '@/api/nfts'
import { CatalogFilters } from '@/components/CatalogFilters'
import { HeroCarousel } from '@/components/HeroCarousel'
import { Skeleton } from '@/components/Skeleton'

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
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-4 md:hidden">
        <form
          key={q ?? ''}
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            const value = new FormData(e.currentTarget).get('q') as string
            update({ q: value.trim() || undefined })
          }}
          className="flex-1"
        >
          <label htmlFor="mobile-search" className="sr-only">Buscar NFT</label>
          <div className="flex items-center gap-2 rounded-xl border border-kurio-border bg-kurio-ink-soft px-3 py-2">
            <Search aria-hidden="true" className="size-4 shrink-0 text-kurio-text-secondary" />
            <input
              id="mobile-search"
              name="q"
              defaultValue={q}
              placeholder="Explorar coleções"
              className="w-full bg-transparent text-sm outline-none placeholder:text-kurio-text-secondary"
            />
          </div>
          <button type="submit" className="sr-only">Buscar</button>
        </form>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          aria-label="Filtros"
          className="shrink-0 rounded-xl border border-kurio-border bg-kurio-ink-soft p-2.5"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
        </button>
      </div>

      <HeroCarousel />

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[240px_1fr]">
        <aside aria-label="Filtros">
          <div id="catalog-filters" className={`${filtersOpen ? 'block' : 'hidden'} md:block`}>
            <CatalogFilters
              key={`${minPrice ?? ''}-${maxPrice ?? ''}`}
              search={search}
              onChange={update}
            />
          </div>
        </aside>

        <section id="catalogo" aria-label="Catálogo" aria-busy={isPending}>
          <p role="status" aria-live="polite" className="sr-only">
            {isPending ? 'Carregando NFTs...' : data ? `${data.total} NFTs encontrados` : ''}
          </p>

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
              <label htmlFor="sort" className="text-kurio-text-secondary">Ordenar por:</label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => update({ sort: e.target.value === 'recent' ? undefined : (e.target.value as NftSearch['sort']) })}
                className="rounded border border-kurio-border bg-kurio-card px-2 py-1.5"
              >
                <option value="recent">Listados recentemente</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
              </select>
            </div>
          </div>

          {isPending && (
            <ul aria-hidden="true" data-testid="catalogo-skeleton" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => (
                <li key={i} className="rounded-lg bg-kurio-card p-3">
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="mt-3 h-4 w-3/4" />
                  <Skeleton className="mt-2 h-4 w-1/3" />
                </li>
              ))}
            </ul>
          )}

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
                        loading="lazy"
                        decoding="async"
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