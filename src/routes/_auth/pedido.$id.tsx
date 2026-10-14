import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { X } from 'lucide-react'
import { orderQueryOptions } from '@/api/orders'

export const Route = createFileRoute('/_auth/pedido/$id')({ component: OrderPage })

const NETWORK_LABEL: Record<string, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const truncate = (s: string) => `${s.slice(0, 10)}…${s.slice(-6)}`

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-2xl border border-kurio-border-soft bg-kurio-card p-6 sm:p-8">
        <div className="-mx-6 -mt-6 mb-6 h-1 rounded-t-2xl bg-kurio-primary sm:-mx-8 sm:-mt-8" />
        {children}
      </div>
    </main>
  )
}

function OrderPage() {
  const { id } = Route.useParams()
  const { data: order, isPending, isError, error, refetch } = useQuery(orderQueryOptions(id))

  if (isPending) {
    return (
      <Card>
        <p>Carregando pedido...</p>
      </Card>
    )
  }

  if (isError) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    return (
      <Card>
        <div role="alert">
          <p>{status === 404 || status === 403 ? 'Pedido não encontrado.' : 'Não foi possível carregar o pedido.'}</p>
          {!status || status >= 500 ? (
            <button onClick={() => refetch()} className="mt-2 underline">Tentar de novo</button>
          ) : null}
        </div>
      </Card>
    )
  }

  if (order.status === 'pending') {
    return (
      <Card>
        <div role="status">
          <h1 className="text-2xl font-bold text-kurio-text">Aguardando confirmação</h1>
          <p className="mt-2 text-kurio-text-secondary">
            Estamos confirmando seu pagamento. Pode atualizar a página, o pedido não se perde.
          </p>
        </div>
      </Card>
    )
  }

  if (order.status === 'refused') {
    return (
      <Card>
        <div role="alert">
          <h1 className="text-2xl font-bold text-kurio-text">Pagamento recusado</h1>
          <p className="mt-2 text-kurio-text-secondary">{order.refusalReason}</p>
          <p className="mt-2 text-kurio-text-secondary">Seus itens continuam no carrinho.</p>
          <Link to="/carrinho" className="mt-4 inline-block text-kurio-text-accent underline">Voltar ao carrinho</Link>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="relative">
        <Link
          to="/"
          aria-label="Fechar e continuar comprando"
          className="absolute -right-1 -top-1 rounded-full p-1 text-kurio-text-secondary hover:text-kurio-text"
        >
          <X aria-hidden="true" className="size-5" />
        </Link>

        <h1 className="text-2xl font-bold text-kurio-text sm:text-3xl">Pedido confirmado</h1>
        <p className="mt-1 text-kurio-text-secondary">Seus NFTs agora estão na sua carteira.</p>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-kurio-border-soft py-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-kurio-text-secondary">ID da transação</dt>
            <dd className="mt-1 break-all">{order.txHash ? truncate(order.txHash) : '—'}</dd>
          </div>
          <div>
            <dt className="text-kurio-text-secondary">Data</dt>
            <dd className="mt-1">{fmtDate(order.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-kurio-text-secondary">Total</dt>
            <dd className="mt-1 font-bold text-kurio-text-accent">{order.total} ETH</dd>
          </div>
          <div>
            <dt className="text-kurio-text-secondary">Carteira</dt>
            <dd className="mt-1 break-all">{truncate(order.walletAddress)}</dd>
          </div>
        </dl>

        <p className="sr-only">Transação: {order.txHash}</p>
        <p className="mt-2 text-xs text-kurio-text-secondary">Rede: {NETWORK_LABEL[order.network] ?? order.network}</p>

        <h2 className="mt-6 text-lg font-bold text-kurio-text">Detalhes da transação</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {order.items.map((i) => (
            <li key={i.nftId} className="flex items-center gap-3">
              <img src={i.image} alt={i.name} className="size-12 shrink-0 rounded-lg object-cover" />
              <span className="flex-1 truncate">{i.name}</span>
              <span className="w-16 text-center text-kurio-text-secondary">{i.quantity}×</span>
              <span className="w-20 text-right">{(Number(i.unitPrice) * i.quantity).toFixed(2)} ETH</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 grid grid-cols-2 gap-y-1.5 border-t border-kurio-border-soft pt-4 text-sm">
          <dt className="text-kurio-text-secondary">Subtotal</dt><dd className="text-right">{order.subtotal} ETH</dd>
          <dt className="text-kurio-text-secondary">Desconto</dt><dd className="text-right">−{order.discount} ETH</dd>
          <dt className="text-kurio-text-secondary">Taxa de rede</dt><dd className="text-right">{order.networkFee} ETH</dd>
          <dt className="mt-2 border-t border-kurio-border-soft pt-2 font-bold text-kurio-text">Total</dt>
          <dd className="mt-2 border-t border-kurio-border-soft pt-2 text-right font-bold text-kurio-text-accent">{order.total} ETH</dd>
        </dl>

        <p className="mt-4 text-xs text-kurio-text-secondary">
          Este recibo é um retrato do pedido no momento da confirmação: mudanças futuras no catálogo não alteram os valores acima.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Simulação: não há rede blockchain real por trás deste pedido"
            className="flex-1 rounded-lg border border-kurio-border px-4 py-2.5 text-center text-sm text-kurio-text-secondary disabled:cursor-not-allowed"
          >
            Ver no Etherscan
          </button>
          <Link
            to="/"
            className="flex-1 rounded-lg bg-kurio-accent px-4 py-2.5 text-center text-sm font-bold text-kurio-bg transition-colors hover:bg-kurio-primary-light"
          >
            Continuar comprando
          </Link>
        </div>
      </div>
    </Card>
  )
}