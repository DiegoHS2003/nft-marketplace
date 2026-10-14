import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { fetchNft } from '@/api/nfts'

export const Route = createFileRoute('/nfts/$id')({ component: NftDetail })

function NftDetail() {
  const { id } = Route.useParams()

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['nft', id],
    queryFn: ({ signal }) => fetchNft(id, signal),
    // 404 não adianta tentar de novo
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 1,
  })

  const notFound = isError && isAxiosError(error) && error.response?.status === 404

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link to="/" className="text-kurio-muted underline">← Voltar ao catálogo</Link>

      {isPending && <p className="mt-6">Carregando...</p>}

      {notFound && (
        <div role="alert" className="mt-6">
          <p>Este NFT não existe.</p>
        </div>
      )}

      {isError && !notFound && (
        <div role="alert" className="mt-6">
          <p>Não foi possível carregar este NFT.</p>
          <button onClick={() => refetch()} className="underline">Tentar de novo</button>
        </div>
      )}

      {data && (
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <img src={data.image} alt={data.name} className="aspect-square w-full rounded object-cover" />
          <div>
            <h1 className="text-2xl">{data.name}</h1>
            <p className="mt-1 text-kurio-muted">{data.collection} · {data.network}</p>
            <p className="mt-4 text-3xl text-kurio-accent">{data.price} ETH</p>
            <p className="mt-2">
              {data.editionsAvailable > 0
                ? `${data.editionsAvailable} de ${data.editionsTotal} edições disponíveis`
                : 'Edição esgotada'}
            </p>
            <button
              disabled={data.editionsAvailable === 0}
              className="mt-6 rounded bg-kurio-accent px-4 py-2 text-kurio-bg disabled:opacity-50"
            >
              Adicionar ao carrinho
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
