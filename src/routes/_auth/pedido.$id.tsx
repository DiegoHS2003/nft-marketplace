import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { orderQueryOptions } from '@/api/orders'

export const Route = createFileRoute('/_auth/pedido/$id')({ component: OrderPage })

function OrderPage() {
  const { id } = Route.useParams()
  const { data: order, isPending, isError, error, refetch } = useQuery(orderQueryOptions(id))

  if (isPending) return <main className="mx-auto max-w-2xl p-6"><p>Carregando pedido...</p></main>

  if (isError) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    return (
      <main className="mx-auto max-w-2xl p-6" role="alert">
        <p>{status === 404 || status === 403 ? 'Pedido não encontrado.' : 'Não foi possível carregar o pedido.'}</p>
        {!status || status >= 500 ? <button onClick={() => refetch()} className="underline">Tentar de novo</button> : null}
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      {order.status === 'pending' && (
        <div role="status">
          <h1 className="text-2xl">Aguardando confirmação</h1>
          <p className="mt-2">Estamos confirmando seu pagamento. Pode atualizar a página, o pedido não se perde.</p>
        </div>
      )}

      {order.status === 'refused' && (
        <div role="alert">
          <h1 className="text-2xl">Pagamento recusado</h1>
          <p className="mt-2">{order.refusalReason}</p>
          <p className="mt-2">Seus itens continuam no carrinho.</p>
          <Link to="/carrinho" className="mt-4 inline-block underline">Voltar ao carrinho</Link>
        </div>
      )}

      {order.status === 'confirmed' && (
        <div>
          <h1 className="text-2xl">Pedido confirmado</h1>
          <p className="mt-2 break-all text-kurio-muted">Transação: {order.txHash}</p>
          <p className="text-kurio-muted">Rede: {order.network}</p>
          <ul className="my-4 flex flex-col gap-2">
            {order.items.map((i) => (
              <li key={i.nftId} className="flex items-center gap-3">
                <img src={i.image} alt={i.name} className="size-12 rounded object-cover" />
                <span className="flex-1">{i.quantity}× {i.name}</span>
                <span>{i.unitPrice} ETH</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-1">
            <dt>Subtotal</dt><dd className="text-right">{order.subtotal} ETH</dd>
            <dt>Desconto</dt><dd className="text-right">−{order.discount} ETH</dd>
            <dt>Taxa de rede</dt><dd className="text-right">{order.networkFee} ETH</dd>
            <dt className="font-bold">Total</dt>
            <dd className="text-right font-bold text-kurio-accent">{order.total} ETH</dd>
          </dl>
          <Link to="/" className="mt-6 inline-block underline">Continuar comprando</Link>
        </div>
      )}
    </main>
  )
}