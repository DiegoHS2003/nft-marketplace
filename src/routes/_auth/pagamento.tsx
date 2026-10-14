import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { cartQueryOptions } from '@/api/cart'
import { useCreateOrder, walletsQueryOptions } from '@/api/orders'
import { SESSION_EXPIRED_EVENT, useUser } from '@/lib/auth'
import type { ApiError, Cart, CreateOrderBody, Network } from '@/types/api'

export const Route = createFileRoute('/_auth/pagamento')({ component: Checkout })

const ATTEMPT_KEY = 'kurio:checkout-attempt'
const DRAFT_KEY = 'kurio:checkout-draft'

// Mesma chave enquanto o conteúdo do pedido for o mesmo (clique repetido, reenvio, refresh)
function keyFor(payload: string) {
  const raw = sessionStorage.getItem(ATTEMPT_KEY)
  const saved = raw ? (JSON.parse(raw) as { payload: string; key: string }) : null
  if (saved?.payload === payload) return saved.key
  const key = crypto.randomUUID()
  sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ payload, key }))
  return key
}

interface Draft {
  name: string
  email: string
  walletId: string
  network: Network | ''
}

// não é destrutivo: só a limpeza (em efeito) de fato consome o rascunho
function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

type QuoteChangedBody = ApiError & { cart?: Cart }

function Checkout() {
  const user = useUser()
  const router = useRouter()
  const qc = useQueryClient()
  const { data: cart } = useQuery(cartQueryOptions)
  const { data: wallets = [] } = useQuery(walletsQueryOptions)
  const create = useCreateOrder()

  const [draft] = useState(readDraft)
  useEffect(() => {
    if (draft) sessionStorage.removeItem(DRAFT_KEY)
  }, [draft])

  const [walletId, setWalletId] = useState(draft?.walletId ?? '')
  const [network, setNetwork] = useState<Network | ''>(draft?.network ?? '')
  const [name, setName] = useState(draft?.name ?? user?.name ?? '')
  const [email, setEmail] = useState(draft?.email ?? user?.email ?? '')

  // se a sessão expirar (ex.: ao confirmar a compra), salva o que já foi preenchido antes do
  // redirect pro login, pra restaurar quando o usuário voltar e concluir sem perder nada
  const formRef = useRef<Draft>({ name, email, walletId, network })
  formRef.current = { name, email, walletId, network }
  useEffect(() => {
    const saveDraft = () => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formRef.current))
    window.addEventListener(SESSION_EXPIRED_EVENT, saveDraft)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, saveDraft)
  }, [])

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
      <main className="mx-auto max-w-3xl p-6 text-center">
        <p>Seu carrinho está vazio. <Link to="/" className="text-kurio-text-accent underline">Ver catálogo</Link></p>
      </main>
    )
  }

  const input = 'rounded-lg border border-kurio-border bg-kurio-ink-soft px-3 py-2 text-sm'
  const card = 'rounded-2xl bg-kurio-card p-5'

  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 pt-4 sm:px-6 md:pt-8">
      <h1 className="mb-6 text-2xl font-bold text-kurio-text">Pagamento</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
        <form onSubmit={onSubmit} className="order-2 flex flex-col gap-6 md:order-1">
          <div className={card}>
            <h2 className="mb-4 text-lg font-bold text-kurio-text">Dados do colecionador</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="name" className="mb-1 block text-sm text-kurio-text-secondary">Nome do colecionador</label>
                <input id="name" required value={name} onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!fields.name} className={`w-full ${input}`} />
                {fields.name && <p role="alert" className="mt-1 text-sm text-kurio-coral">{fields.name}</p>}
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm text-kurio-text-secondary">E-mail</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!fields.email} className={`w-full ${input}`} />
                {fields.email && <p role="alert" className="mt-1 text-sm text-kurio-coral">{fields.email}</p>}
              </div>
            </div>
          </div>

          <div className={card}>
            <h2 className="mb-4 text-lg font-bold text-kurio-text">Carteira e rede</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="wallet" className="mb-1 block text-sm text-kurio-text-secondary">Carteira</label>
                <select id="wallet" required value={walletId} className={`w-full ${input}`}
                  onChange={(e) => { setWalletId(e.target.value); setNetwork('') }}>
                  <option value="">Selecione</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.label} ({w.address.slice(0, 8)}…)</option>
                  ))}
                </select>
                {fields.walletId && <p role="alert" className="mt-1 text-sm text-kurio-coral">{fields.walletId}</p>}
              </div>

              <div>
                <label htmlFor="network" className="mb-1 block text-sm text-kurio-text-secondary">Rede</label>
                <select id="network" required value={network} className={`w-full ${input}`} disabled={!wallet}
                  onChange={(e) => setNetwork(e.target.value as Network)}>
                  <option value="">Selecione</option>
                  {wallet?.networks.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                {fields.network && <p role="alert" className="mt-1 text-sm text-kurio-coral">{fields.network}</p>}
              </div>
            </div>
          </div>

          {stale && (
            <div role="alert" className="rounded-xl border border-kurio-primary bg-kurio-card p-4 text-sm">
              <p>Os valores do pedido mudaram desde a sua revisão. Confira o resumo e aceite os novos valores para continuar.</p>
              <button type="button" onClick={() => cart && setReviewedQuote(cart.quoteId)} className="mt-2 font-bold text-kurio-text-accent underline">
                Aceitar novos valores
              </button>
            </div>
          )}
          {apiError && !apiError.fields && apiError.code !== 'quote_changed' && (
            <p role="alert" className="text-sm text-kurio-coral">{apiError.message}</p>
          )}
          {networkFailure && (
            <p role="alert" className="text-sm text-kurio-coral">
              Falha de conexão ao enviar o pedido. Tente de novo: ele não será criado duas vezes.
            </p>
          )}

          <button disabled={create.isPending || !cart || stale}
            className="rounded-lg bg-kurio-accent px-4 py-3 font-bold text-kurio-bg transition-colors hover:bg-kurio-primary-light disabled:opacity-50">
            {create.isPending ? 'Enviando pedido...' : 'Confirmar compra'}
          </button>
        </form>

        <section aria-label="Resumo do pedido" className={`order-1 md:order-2 ${card}`}>
          <h2 className="mb-4 text-lg font-bold text-kurio-text">Resumo</h2>
          {cart && (
            <>
              <ul className="mb-4 flex flex-col gap-2 text-sm">
                {cart.items.map(({ nft, quantity }) => (
                  <li key={nft.id} className="flex justify-between gap-2">
                    <span className="text-kurio-text-secondary">{quantity}× {nft.name}</span>
                    <span>{nft.price} ETH</span>
                  </li>
                ))}
              </ul>
              <dl className="grid grid-cols-2 gap-y-1.5 border-t border-kurio-border-soft pt-4 text-sm">
                <dt className="text-kurio-text-secondary">Subtotal</dt><dd className="text-right">{cart.subtotal} ETH</dd>
                <dt className="text-kurio-text-secondary">Desconto</dt><dd className="text-right">−{cart.discount} ETH</dd>
                <dt className="text-kurio-text-secondary">Taxa de rede</dt><dd className="text-right">{cart.networkFee} ETH</dd>
                <dt className="mt-2 border-t border-kurio-border-soft pt-2 font-bold text-kurio-text">Total</dt>
                <dd className="mt-2 border-t border-kurio-border-soft pt-2 text-right font-bold text-kurio-text-accent">{cart.total} ETH</dd>
              </dl>
            </>
          )}
        </section>
      </div>
    </main>
  )
}