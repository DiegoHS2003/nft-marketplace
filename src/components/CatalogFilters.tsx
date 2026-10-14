import { useState } from 'react'
import type { NftSearch } from '@/api/nfts'

const COLLECTIONS = [
  ['arte-digital', 'Arte Digital'],
  ['fotografia', 'Fotografia'],
  ['musica', 'Música'],
  ['arte-3d', 'Arte 3D'],
  ['colecionaveis', 'Colecionáveis'],
  ['generativa', 'Generativa'],
  ['jogos', 'Jogos'],
  ['avatares', 'Avatares'],
  ['utilidade', 'Utilidade'],
] as const

const NETWORKS = [
  ['ethereum', 'Ethereum'],
  ['polygon', 'Polygon'],
  ['solana', 'Solana'],
] as const

const ETH = /^\d+(\.\d{1,18})?$/

function toggle(list: string[] | undefined, value: string) {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]
  return next.length ? next : undefined
}

interface Props {
  search: NftSearch
  onChange: (patch: Partial<NftSearch>) => void
}

export function CatalogFilters({ search, onChange }: Props) {
  const [min, setMin] = useState(search.minPrice ?? '')
  const [max, setMax] = useState(search.maxPrice ?? '')
  const [error, setError] = useState('')

  const hasFilters = !!(search.collection || search.network || search.minPrice || search.maxPrice)

  function applyPrice(e: React.FormEvent) {
    e.preventDefault()
    const lo = min.trim()
    const hi = max.trim()
    if ((lo && !ETH.test(lo)) || (hi && !ETH.test(hi))) {
      setError('Use valores decimais, como 0.5')
      return
    }
    if (lo && hi && Number(lo) > Number(hi)) {
      setError('O mínimo não pode ser maior que o máximo')
      return
    }
    setError('')
    onChange({ minPrice: lo || undefined, maxPrice: hi || undefined })
  }

  const field = 'w-full rounded border border-kurio-border bg-kurio-ink-soft px-2 py-1.5'

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-kurio-card p-4 text-sm">
      <fieldset>
        <legend className="mb-2 font-bold text-kurio-foreground">Coleções</legend>
        <ul className="flex flex-col gap-1.5">
          {COLLECTIONS.map(([value, label]) => (
            <li key={value}>
              <label className="flex cursor-pointer items-center gap-2 text-kurio-text-secondary">
                <input
                  type="checkbox"
                  checked={search.collection?.includes(value) ?? false}
                  onChange={() => onChange({ collection: toggle(search.collection, value) })}
                  className="accent-kurio-primary"
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <form onSubmit={applyPrice} aria-label="Faixa de preço" className="flex flex-col gap-2">
        <h3 className="font-bold text-kurio-foreground">Faixa de preço</h3>
        <label htmlFor="min-price" className="text-kurio-text-secondary">Preço mínimo (ETH)</label>
        <input
          id="min-price"
          inputMode="decimal"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'price-error' : undefined}
          className={field}
        />
        <label htmlFor="max-price" className="text-kurio-text-secondary">Preço máximo (ETH)</label>
        <input
          id="max-price"
          inputMode="decimal"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'price-error' : undefined}
          className={field}
        />
        {error && <p id="price-error" role="alert" className="text-kurio-coral">{error}</p>}
        <button className="mt-1 rounded bg-kurio-primary px-3 py-1.5 font-bold text-kurio-ink hover:bg-kurio-primary-light">
          Aplicar
        </button>
      </form>

      <fieldset>
        <legend className="mb-2 font-bold text-kurio-foreground">Rede</legend>
        <ul className="flex flex-col gap-1.5">
          {NETWORKS.map(([value, label]) => (
            <li key={value}>
              <label className="flex cursor-pointer items-center gap-2 text-kurio-text-secondary">
                <input
                  type="checkbox"
                  checked={search.network?.includes(value) ?? false}
                  onChange={() => onChange({ network: toggle(search.network, value) })}
                  className="accent-kurio-primary"
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {hasFilters && (
        <button
          onClick={() =>
            onChange({ collection: undefined, network: undefined, minPrice: undefined, maxPrice: undefined })
          }
          className="text-left text-kurio-text-accent underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}