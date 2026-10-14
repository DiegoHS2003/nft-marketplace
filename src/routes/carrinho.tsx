import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { Minus, Plus, Trash2 } from 'lucide-react'
import {
  useApplyCoupon, useCart, useRemoveCoupon, useRemoveItem, useUpdateQuantity,
} from '@/api/cart'
import { Skeleton } from '@/components/Skeleton'
import type { ApiError } from '@/types/api'

export const Route = createFileRoute('/carrinho')({ component: CartPage })

const messageOf = (error: unknown, fallback: string) =>
  isAxiosError<ApiError>(error) ? (error.response?.data?.message ?? fallback) : fallback

function CartPage() {
  const { data: cart, isPending, isError, refetch } = useCart()
  const update = useUpdateQuantity()
  const remove = useRemoveItem()
  const apply = useApplyCoupon()
  const removeCoupon = useRemoveCoupon()
  const [code, setCode] = useState('')

  const input = 'rounded-lg border border-kurio-border bg-kurio-ink-soft px-3 py-2 text-sm placeholder:text-kurio-text-secondary'

  return (
    <main className="mx-auto max-w-6xl px-4 pb-6 pt-4 sm:px-6 md:pt-8" aria-busy={isPending}>
      <nav aria-label="Trilha de navegação" className="mb-4 hidden items-center gap-2 text-sm text-kurio-text-secondary md:flex">
        <Link to="/" className="hover:text-kurio-text">Início</Link>
        <span aria-hidden="true">/</span>
        <span className="text-kurio-text">Carrinho</span>
      </nav>

      <h1 className="mb-6 text-center text-2xl font-bold text-kurio-text md:text-left">Carrinho de NFTs</h1>

      <p role="status" aria-live="polite" className="sr-only">
        {isPending ? 'Carregando carrinho...' : cart ? 'Carrinho carregado' : ''}
      </p>

      {isPending && (
        <div aria-hidden="true" data-testid="carrinho-skeleton" className="grid gap-6 md:grid-cols-[1fr_320px]">
          <ul className="flex flex-col gap-3">
            {Array.from({ length: 2 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 rounded-xl bg-kurio-card p-3">
                <Skeleton className="size-16 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-4 w-1/4" />
                </div>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl bg-kurio-card p-5">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16 justify-self-end" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16 justify-self-end" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16 justify-self-end" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20 justify-self-end" />
            </div>
          </div>
        </div>
      )}
      {isError && (
        <div role="alert" className="rounded-xl border border-kurio-border bg-kurio-card p-6">
          <p>Não foi possível carregar o carrinho.</p>
          <button onClick={() => refetch()} className="mt-2 underline">Tentar de novo</button>
        </div>
      )}

      {cart && cart.items.length === 0 && (
        <p className="rounded-xl border border-kurio-border bg-kurio-card p-6 text-center">
          Seu carrinho está vazio. <Link to="/" className="text-kurio-text-accent underline">Ver catálogo</Link>
        </p>
      )}

      {cart && cart.items.length > 0 && (
        <div className="grid gap-6 md:grid-cols-[1fr_320px] md:items-start lg:grid-cols-[1fr_360px]">
          <div>
            {update.isError && (
              <p role="alert" className="mb-3 text-sm text-kurio-coral">
                {messageOf(update.error, 'Não foi possível alterar a quantidade.')}
              </p>
            )}

            <div className="mb-2 hidden items-center gap-4 px-3 text-sm text-kurio-text-secondary md:flex">
              <span className="flex-1">NFTs</span>
              <span className="w-20">Preço</span>
              <span className="w-28 text-center">Edições</span>
              <span className="w-24 text-right">Total</span>
              <span className="w-20 text-right sr-only">Ações</span>
            </div>

            <ul className="flex flex-col gap-3">
              {cart.items.map(({ nft, quantity }) => (
                <li
                  key={nft.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-kurio-card p-3 md:flex-nowrap md:gap-4"
                >
                  <div className="flex basis-full items-center gap-4 md:basis-0 md:flex-1">
                    <img src={nft.image} alt={nft.name} className="size-16 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-kurio-text">{nft.name}</p>
                      <p className="text-kurio-text-accent md:hidden">{nft.price} ETH</p>
                    </div>
                  </div>

                  <p className="hidden w-20 text-kurio-text-accent md:block">{nft.price} ETH</p>

                  <div className="flex items-center gap-2 md:w-28 md:justify-center">
                    <button
                      aria-label={`Diminuir quantidade de ${nft.name}`}
                      disabled={quantity <= 1}
                      onClick={() => update.mutate({ nftId: nft.id, quantity: quantity - 1 })}
                      className="flex size-7 items-center justify-center rounded-full border border-kurio-border disabled:opacity-40"
                    >
                      <Minus aria-hidden="true" className="size-3.5" />
                    </button>
                    <span aria-live="polite" className="w-5 text-center text-sm">{quantity}</span>
                    <button
                      aria-label={`Aumentar quantidade de ${nft.name}`}
                      disabled={quantity >= nft.editionsAvailable}
                      onClick={() => update.mutate({ nftId: nft.id, quantity: quantity + 1 })}
                      className="flex size-7 items-center justify-center rounded-full border border-kurio-border disabled:opacity-40"
                    >
                      <Plus aria-hidden="true" className="size-3.5" />
                    </button>
                  </div>

                  <p className="hidden w-24 text-right font-bold text-kurio-text md:block">
                    {(Number(nft.price) * quantity).toFixed(2)} ETH
                  </p>

                  <button
                    onClick={() => remove.mutate(nft.id)}
                    aria-label={`Remover ${nft.name} do carrinho`}
                    className="ml-auto flex items-center gap-1 text-sm text-kurio-text-secondary underline md:ml-0 md:w-20 md:justify-end"
                  >
                    <Trash2 aria-hidden="true" className="size-4 md:hidden" />
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-2xl bg-kurio-card p-5">
            <h2 className="mb-4 text-lg font-bold text-kurio-text">Resumo da carteira</h2>

            <section aria-label="Cupom" className="mb-4">
              {cart.coupon ? (
                <p className="text-sm">
                  Cupom {cart.coupon} aplicado.{' '}
                  <button onClick={() => removeCoupon.mutate()} className="text-kurio-text-accent underline">Remover</button>
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (code.trim()) apply.mutate(code, { onSuccess: () => setCode('') })
                  }}
                  className="flex gap-2"
                >
                  <label htmlFor="coupon" className="sr-only">Cupom</label>
                  <input
                    id="coupon"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Cupom de desconto"
                    className={`flex-1 ${input}`}
                  />
                  <button disabled={apply.isPending} className="rounded-lg bg-kurio-accent px-4 py-2 text-sm font-bold text-kurio-bg disabled:opacity-50">
                    Aplicar
                  </button>
                </form>
              )}
              {apply.isError && (
                <p role="alert" className="mt-2 text-sm text-kurio-coral">
                  {messageOf(apply.error, 'Não foi possível aplicar o cupom.')}
                </p>
              )}
            </section>

            <dl className="grid grid-cols-2 gap-y-1.5 border-t border-kurio-border-soft pt-4 text-sm">
              <dt className="text-kurio-text-secondary">Subtotal</dt><dd className="text-right">{cart.subtotal} ETH</dd>
              <dt className="text-kurio-text-secondary">Desconto</dt><dd className="text-right">−{cart.discount} ETH</dd>
              <dt className="text-kurio-text-secondary">Taxa de rede</dt><dd className="text-right">{cart.networkFee} ETH</dd>
              <dt className="mt-2 border-t border-kurio-border-soft pt-2 font-bold text-kurio-text">Total</dt>
              <dd className="mt-2 border-t border-kurio-border-soft pt-2 text-right font-bold text-kurio-text-accent">{cart.total} ETH</dd>
            </dl>

            <Link
              to="/pagamento"
              className="mt-5 block rounded-lg bg-kurio-accent px-4 py-3 text-center font-bold text-kurio-bg transition-colors hover:bg-kurio-primary-light"
            >
              Ir para pagamento
            </Link>
            <Link to="/" className="mt-3 block text-center text-sm text-kurio-text-secondary underline">
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}
    </main>
  )
}
