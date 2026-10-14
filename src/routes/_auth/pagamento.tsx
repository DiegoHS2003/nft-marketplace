import { useEffect, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { cartQueryOptions } from '@/api/cart'
import { useCreateOrder, walletsQueryOptions } from '@/api/orders'
import { useUser } from '@/lib/auth'
import type { ApiError, Cart, CreateOrderBody, Network } from '@/types/api'

export const Route = createFileRoute('/_auth/pagamento')({ component: Checkout })

const ATTEMPT_KEY = 'kurio:checkout-attempt'

// Mesma chave enquanto o conteúdo do pedido for o mesmo (clique repetido, reenvio, refresh)
function keyFor(payload: string) {
  const raw = sessionStorage.getItem(ATTEMPT_KEY)
  const saved = raw ? (JSON.parse(raw) as { payload: string; key: string }) : null
  if (saved?.payload === payload) return saved.key
  const key = crypto.randomUUID()
  sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ payload, key }))
  return key
}

type QuoteChangedBody = ApiError & { cart?: Cart }

function Checkout() {
  const user = useUser()
  const router = useRouter()
  const qc = useQueryClient()
  const { data: cart } = useQuery(cartQueryOptions)
  const { data: wallets = [] } = useQuery(walletsQueryOptions)
  const create = useCreateOrder()

  const [walletId, setWalletId] = useState('')
  const [network, setNetwork] = useState<Network | ''>('')
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')

  // cotação que o usuário revisou: congela na primeira carga e só muda quando ele aceita
  const [reviewedQuote, setReviewedQuote] = useState<string | null>(null)
  useEffect(() => {
    if (cart && reviewedQuote === null) setReviewedQuote(cart.quoteId)
  }, [cart, reviewedQuote])
  const stale = !!cart && reviewedQuote !== null && cart.quoteId !== reviewedQuote

  const wallet = wallets.find((w) => w.id === walletId)
  const apiError = isAxiosError<QuoteChangedBody>(create.error) ? create.error.response?.data : undefined
  const fields = apiError?.fields ?? {}
  const networkFailure = isAxiosError(create.error) && !create.error.response

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cart || !network || !reviewedQuote || stale || create.isPending) return
    const body: CreateOrderBody = {
      quoteId: reviewedQuote,
      walletId,
      network,
      collector: { name: name.trim(), email: email.trim() },
    }
    create.mutate(
      { body, idempotencyKey: keyFor(JSON.stringify(body)) },
      {
        onSuccess: (order) => {
          sessionStorage.removeItem(ATTEMPT_KEY)
          router.history.push(`/pedido/${order.id}`)
        },
        onError: (error) => {
          const data = isAxiosError<QuoteChangedBody>(error) ? error.response?.data : undefined
          // o servidor recusou a cotação: o carrinho novo entra e o aviso de "valores mudaram" aparece
          if (data?.code === 'quote_changed' && data.cart) {
            qc.setQueryData(cartQueryOptions.queryKey, data.cart)
          }
        },
      },
    )
  }

  if (cart && cart.items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p>Seu carrinho está vazio. <Link to="/" className="underline">Ver catálogo</Link></p>
      </main>
    )
  }

  const input = 'rounded border border-kurio-border bg-kurio-surface px-3 py-2'

  return (
    <main className="mx-auto grid max-w-4xl gap-8 p-6 md:grid-cols-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <h1 className="text-2xl">Pagamento</h1>

        <label htmlFor="name">Nome do colecionador</label>
        <input id="name" required value={name} onChange={(e) => setName(e.target.value)}
          aria-invalid={!!fields.name} className={input} />
        {fields.name && <p role="alert" className="text-sm">{fields.name}</p>}

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fields.email} className={input} />
        {fields.email && <p role="alert" className="text-sm">{fields.email}</p>}

        <label htmlFor="wallet">Carteira</label>
        <select id="wallet" required value={walletId} className={input}
          onChange={(e) => { setWalletId(e.target.value); setNetwork('') }}>
          <option value="">Selecione</option>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>{w.label} ({w.address.slice(0, 8)}…)</option>
          ))}
        </select>
        {fields.walletId && <p role="alert" className="text-sm">{fields.walletId}</p>}

        <label htmlFor="network">Rede</label>
        <select id="network" required value={network} className={input} disabled={!wallet}
          onChange={(e) => setNetwork(e.target.value as Network)}>
          <option value="">Selecione</option>
          {wallet?.networks.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {fields.network && <p role="alert" className="text-sm">{fields.network}</p>}

        {stale && (
          <div role="alert" className="rounded border border-kurio-accent p-3">
            <p>Os valores do pedido mudaram desde a sua revisão. Confira o resumo e aceite os novos valores para continuar.</p>
            <button type="button" onClick={() => cart && setReviewedQuote(cart.quoteId)} className="mt-2 underline">
              Aceitar novos valores
            </button>
          </div>
        )}
        {apiError && !apiError.fields && apiError.code !== 'quote_changed' && (
          <p role="alert">{apiError.message}</p>
        )}
        {networkFailure && (
          <p role="alert">
            Falha de conexão ao enviar o pedido. Tente de novo: ele não será criado duas vezes.
          </p>
        )}

        <button disabled={create.isPending || !cart || stale}
          className="rounded bg-kurio-accent px-4 py-2 text-kurio-bg disabled:opacity-50">
          {create.isPending ? 'Enviando pedido...' : 'Confirmar compra'}
        </button>
      </form>

      <section aria-label="Resumo do pedido">
        <h2 className="mb-3 text-xl">Resumo</h2>
        {cart && (
          <>
            <ul className="mb-4 flex flex-col gap-2">
              {cart.items.map(({ nft, quantity }) => (
                <li key={nft.id} className="flex justify-between">
                  <span>{quantity}× {nft.name}</span>
                  <span>{nft.price} ETH</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-1">
              <dt>Subtotal</dt><dd className="text-right">{cart.subtotal} ETH</dd>
              <dt>Desconto</dt><dd className="text-right">−{cart.discount} ETH</dd>
              <dt>Taxa de rede</dt><dd className="text-right">{cart.networkFee} ETH</dd>
              <dt className="font-bold">Total</dt>
              <dd className="text-right font-bold text-kurio-accent">{cart.total} ETH</dd>
            </dl>
          </>
        )}
      </section>
    </main>
  )
}