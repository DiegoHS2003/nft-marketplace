import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import {
  useApplyCoupon, useCart, useRemoveCoupon, useRemoveItem, useUpdateQuantity,
} from '@/api/cart'
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

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl">Carrinho</h1>

      {isPending && <p>Carregando...</p>}
      {isError && (
        <div role="alert">
          <p>Não foi possível carregar o carrinho.</p>
          <button onClick={() => refetch()} className="underline">Tentar de novo</button>
        </div>
      )}

      {cart && cart.items.length === 0 && (
        <p>
          Seu carrinho está vazio. <Link to="/" className="underline">Ver catálogo</Link>
        </p>
      )}

      {cart && cart.items.length > 0 && (
        <>
          {update.isError && (
            <p role="alert" className="mb-3">{messageOf(update.error, 'Não foi possível alterar a quantidade.')}</p>
          )}

          <ul className="flex flex-col gap-3">
            {cart.items.map(({ nft, quantity }) => (
              <li key={nft.id} className="flex items-center gap-4 rounded bg-kurio-surface p-3">
                <img src={nft.image} alt={nft.name} className="size-16 rounded object-cover" />
                <div className="flex-1">
                  <p>{nft.name}</p>
                  <p className="text-kurio-accent">{nft.price} ETH</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={`Diminuir quantidade de ${nft.name}`}
                    disabled={quantity <= 1}
                    onClick={() => update.mutate({ nftId: nft.id, quantity: quantity - 1 })}
                  >
                    −
                  </button>
                  <span aria-live="polite">{quantity}</span>
                  <button
                    aria-label={`Aumentar quantidade de ${nft.name}`}
                    disabled={quantity >= nft.editionsAvailable}
                    onClick={() => update.mutate({ nftId: nft.id, quantity: quantity + 1 })}
                  >
                    +
                  </button>
                </div>
                <button onClick={() => remove.mutate(nft.id)} className="underline">Remover</button>
              </li>
            ))}
          </ul>

          <section className="mt-6" aria-label="Cupom">
            {cart.coupon ? (
              <p>
                Cupom {cart.coupon} aplicado.{' '}
                <button onClick={() => removeCoupon.mutate()} className="underline">Remover</button>
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
                  className="flex-1 rounded border border-kurio-border bg-kurio-surface px-3 py-2"
                />
                <button disabled={apply.isPending} className="rounded bg-kurio-accent px-4 py-2 text-kurio-bg">
                  Aplicar
                </button>
              </form>
            )}
            {apply.isError && <p role="alert" className="mt-2">{messageOf(apply.error, 'Não foi possível aplicar o cupom.')}</p>}
          </section>

          <dl className="mt-6 grid grid-cols-2 gap-1">
            <dt>Subtotal</dt><dd className="text-right">{cart.subtotal} ETH</dd>
            <dt>Desconto</dt><dd className="text-right">−{cart.discount} ETH</dd>
            <dt>Taxa de rede</dt><dd className="text-right">{cart.networkFee} ETH</dd>
            <dt className="font-bold">Total</dt><dd className="text-right font-bold text-kurio-accent">{cart.total} ETH</dd>
          </dl>
                    <Link to="/pagamento" className="mt-6 inline-block rounded bg-kurio-accent px-4 py-2 text-kurio-bg">
            Ir para pagamento
          </Link>
        </>
      )}
    </main>
  )
}