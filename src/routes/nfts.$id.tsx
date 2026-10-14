import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ChevronLeft, Heart, Minus, Plus } from 'lucide-react'
import { fetchNft } from '@/api/nfts'
import { useAddToCart } from '@/api/cart'
import { useFavorites, useToggleFavorite } from '@/api/favorites'
import { useUser } from '@/lib/auth'
import { Skeleton } from '@/components/Skeleton'
import type { ApiError } from '@/types/api'

export const Route = createFileRoute('/nfts/$id')({ component: NftDetail })

const NETWORK_LABEL: Record<string, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

function NftDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const user = useUser()

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['nft', id],
    queryFn: ({ signal }) => fetchNft(id, signal),
    // 404 não adianta tentar de novo
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 1,
  })

  const add = useAddToCart()
  const { data: favorites } = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const isFavorite = favorites?.includes(id) ?? false

  const [quantity, setQuantity] = useState(1)

  const notFound = isError && isAxiosError(error) && error.response?.status === 404

  function onToggleFavorite() {
    if (!user) {
      navigate({ to: '/login', search: { redirect: `/nfts/${id}` } })
      return
    }
    toggleFavorite.mutate({ nftId: id, favorited: isFavorite })
  }

  const favoriteLabel = data && (isFavorite ? `Remover ${data.name} dos favoritos` : `Favoritar ${data.name}`)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-16 md:pt-8" aria-busy={isPending}>
      <nav aria-label="Trilha de navegação" className="mb-4 hidden items-center gap-2 text-sm text-kurio-text-secondary md:flex">
        <Link to="/" className="hover:text-kurio-text">Início</Link>
        <span aria-hidden="true">/</span>
        <span className="text-kurio-text">{data?.name ?? 'NFT'}</span>
      </nav>

      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-kurio-text-secondary md:hidden">
        <ChevronLeft aria-hidden="true" className="size-4" /> Voltar ao catálogo
      </Link>

      <p role="status" aria-live="polite" className="sr-only">
        {isPending ? 'Carregando NFT...' : data ? `${data.name} carregado` : ''}
      </p>

      {isPending && (
        <section aria-hidden="true" data-testid="nft-skeleton" className="grid gap-6 md:grid-cols-2 md:gap-12">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-3 h-8 w-2/3" />
            <Skeleton className="mt-4 h-9 w-1/3" />
            <Skeleton className="mt-3 h-6 w-1/2" />
            <Skeleton className="mt-8 h-12 w-full" />
          </div>
        </section>
      )}

      {notFound && (
        <div role="alert" className="mt-6 rounded-xl border border-kurio-border bg-kurio-card p-6">
          <p>Este NFT não existe.</p>
        </div>
      )}

      {isError && !notFound && (
        <div role="alert" className="mt-6 rounded-xl border border-kurio-border bg-kurio-card p-6">
          <p>Não foi possível carregar este NFT.</p>
          <button onClick={() => refetch()} className="mt-2 underline">Tentar de novo</button>
        </div>
      )}

      {data && (
        <section className="grid gap-6 md:grid-cols-2 md:gap-12">
          <div className="relative">
            <img
              src={data.image}
              alt={data.name}
              className="aspect-square w-full rounded-2xl border border-kurio-border object-cover"
            />
            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={toggleFavorite.isPending}
              aria-pressed={isFavorite}
              aria-label={favoriteLabel}
              className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-kurio-ink/80 text-kurio-text backdrop-blur disabled:opacity-50 md:hidden"
            >
              <Heart aria-hidden="true" className={isFavorite ? 'size-5 fill-kurio-coral text-kurio-coral' : 'size-5'} />
            </button>
          </div>

          <div className="flex flex-col">
            <p className="text-sm text-kurio-text-secondary">
              {data.collection} · {NETWORK_LABEL[data.network] ?? data.network}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-kurio-text md:text-3xl">{data.name}</h1>

            <p className="mt-4 text-3xl font-bold text-kurio-text-accent">{data.price} ETH</p>

            <span
              className={
                data.editionsAvailable > 0
                  ? 'mt-3 inline-block w-fit rounded-full border border-kurio-border-soft bg-kurio-card px-3 py-1 text-sm text-kurio-text-secondary'
                  : 'mt-3 inline-block w-fit rounded-full border border-kurio-coral/60 bg-kurio-card px-3 py-1 text-sm text-kurio-coral'
              }
            >
              {data.editionsAvailable > 0
                ? `${data.editionsAvailable} de ${data.editionsTotal} edições disponíveis`
                : 'Edição esgotada'}
            </span>

            {data.editionsAvailable > 0 && (
              <div className="mt-6 flex items-center gap-3">
                <span id="quantity-label" className="text-sm text-kurio-text-secondary">Quantidade</span>
                <div className="flex items-center gap-3 rounded-full border border-kurio-border px-3 py-1.5">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="disabled:opacity-40"
                  >
                    <Minus aria-hidden="true" className="size-4" />
                  </button>
                  <span aria-live="polite" aria-labelledby="quantity-label" className="w-6 text-center">{quantity}</span>
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    disabled={quantity >= data.editionsAvailable}
                    onClick={() => setQuantity((q) => Math.min(data.editionsAvailable, q + 1))}
                    className="disabled:opacity-40"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="fixed inset-x-0 bottom-0 z-10 mt-6 flex gap-3 border-t border-kurio-border bg-kurio-ink p-4 md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
              <button
                disabled={data.editionsAvailable === 0 || add.isPending}
                onClick={() => add.mutate({ nftId: data.id, quantity })}
                className="flex-1 rounded-lg bg-kurio-accent px-4 py-3 font-bold text-kurio-bg transition-colors hover:bg-kurio-primary-light disabled:opacity-50 md:flex-none md:px-8"
              >
                {add.isPending ? 'Adicionando...' : 'Adicionar ao carrinho'}
              </button>

              <button
                type="button"
                onClick={onToggleFavorite}
                disabled={toggleFavorite.isPending}
                aria-pressed={isFavorite}
                aria-label={favoriteLabel}
                className="hidden items-center gap-2 rounded-lg border border-kurio-border px-4 py-3 text-kurio-text-secondary transition-colors hover:border-kurio-primary hover:text-kurio-text disabled:opacity-50 md:inline-flex"
              >
                <Heart aria-hidden="true" className={isFavorite ? 'size-4 fill-kurio-coral text-kurio-coral' : 'size-4'} />
                {isFavorite ? 'Favoritado' : 'Favoritar'}
              </button>
            </div>

            {toggleFavorite.isError && (
              <p role="alert" className="mt-4 text-sm text-kurio-coral">
                Não foi possível salvar o favorito. Tente de novo.
              </p>
            )}

            {add.isSuccess && (
              <p role="status" className="mt-4 text-sm">
                Adicionado. <Link to="/carrinho" className="underline">Ver carrinho</Link>
              </p>
            )}
            {add.isError && (
              <p role="alert" className="mt-4 text-sm text-kurio-coral">
                {isAxiosError<ApiError>(add.error) ? add.error.response?.data?.message : 'Não foi possível adicionar.'}
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
