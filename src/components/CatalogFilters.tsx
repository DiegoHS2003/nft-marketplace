import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Slider } from '@base-ui/react/slider'
import { facetsQueryOptions, type NftSearch } from '@/api/nfts'

const COLLECTIONS = [
  ['arte-digital', 'Arte Digital'],
  ['fotografia', 'Fotografia'],
  ['musica', 'Música'],
  ['arte-3d', 'Arte 3D'],
  ['colecionaveis', 'Colecionáveis'],
  ['generativa', 'Generativa'],
  ['jogos', 'Jogos'],
  ['assinaturas', 'Assinaturas'],
  ['utilidade', 'Utilidade'],
] as const

const NETWORKS = [
  ['ethereum', 'Ethereum'],
  ['polygon', 'Polygon'],
  ['solana', 'Solana'],
] as const

function toggle(list: string[] | undefined, value: string) {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]
  return next.length ? next : undefined
}

const fmt = (n: number) => n.toFixed(2).replace('.', ',')

interface Props {
  search: NftSearch
  onChange: (patch: Partial<NftSearch>) => void
}

export function CatalogFilters({ search, onChange }: Props) {
  const { data: facets } = useQuery(facetsQueryOptions(search))

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-kurio-card p-4 text-sm">
      <fieldset>
        <legend className="mb-2 font-bold text-kurio-foreground">Coleções</legend>
        <ul className="flex flex-col gap-1.5">
          {COLLECTIONS.map(([value, label]) => (
            <li key={value}>
              <label className="flex cursor-pointer items-center justify-between gap-2 text-kurio-text-secondary">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={search.collection?.includes(value) ?? false}
                    onChange={() => onChange({ collection: toggle(search.collection, value) })}
                    className="accent-kurio-primary"
                  />
                  {label}
                </span>
                {facets ? (
                  <span className="text-kurio-muted">({facets.collections[value] ?? 0})</span>
                ) : (
                  <span aria-hidden="true" className="h-3 w-5 animate-pulse rounded bg-kurio-border" />
                )}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div>
        <h3 className="mb-2 font-bold text-kurio-foreground">Faixa de preço</h3>
        {facets ? (
          <PriceSlider
            bounds={facets.priceBounds}
            min={search.minPrice}
            max={search.maxPrice}
            onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
          />
        ) : (
          <div aria-hidden="true" className="flex flex-col gap-2">
            <div className="h-4 w-full animate-pulse rounded-full bg-kurio-border" />
            <div className="h-3 w-32 animate-pulse rounded bg-kurio-border" />
          </div>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 font-bold text-kurio-foreground">Rede</legend>
        <ul className="flex flex-col gap-1.5">
          {NETWORKS.map(([value, label]) => (
            <li key={value}>
              <label className="flex cursor-pointer items-center justify-between gap-2 text-kurio-text-secondary">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={search.network?.includes(value) ?? false}
                    onChange={() => onChange({ network: toggle(search.network, value) })}
                    className="accent-kurio-primary"
                  />
                  {label}
                </span>
                {facets ? (
                  <span className="text-kurio-muted">({facets.networks[value] ?? 0})</span>
                ) : (
                  <span aria-hidden="true" className="h-3 w-5 animate-pulse rounded bg-kurio-border" />
                )}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {(search.collection || search.network || search.minPrice || search.maxPrice) && (
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

interface PriceSliderProps {
  bounds: { min: string; max: string }
  min?: string
  max?: string
  onApply: (min: string | undefined, max: string | undefined) => void
}

// remonta quando min/max confirmados mudam (ver key em Home), então o estado inicial abaixo é sempre coerente com a URL
function PriceSlider({ bounds, min, max, onApply }: PriceSliderProps) {
  const domainMin = Number(bounds.min)
  const domainMax = Number(bounds.max)
  const [value, setValue] = useState<[number, number]>([
    min ? Number(min) : domainMin,
    max ? Number(max) : domainMax,
  ])

  return (
    <div className="flex flex-col gap-2">
      <Slider.Root
        min={domainMin}
        max={domainMax}
        step={0.01}
        value={value}
        onValueChange={(v) => setValue(v as [number, number])}
      >
        <Slider.Control className="relative flex h-4 w-full items-center">
          <Slider.Track className="h-1 w-full rounded-full bg-kurio-border">
            <Slider.Indicator className="h-full rounded-full bg-kurio-primary" />
          </Slider.Track>
          <Slider.Thumb
            index={0}
            aria-label="Preço mínimo"
            getAriaValueText={() => `${fmt(value[0])} ETH`}
            className="block size-4 rounded-full border-2 border-kurio-primary bg-kurio-foreground outline-none focus-visible:ring-2 focus-visible:ring-kurio-primary"
          />
          <Slider.Thumb
            index={1}
            aria-label="Preço máximo"
            getAriaValueText={() => `${fmt(value[1])} ETH`}
            className="block size-4 rounded-full border-2 border-kurio-primary bg-kurio-foreground outline-none focus-visible:ring-2 focus-visible:ring-kurio-primary"
          />
        </Slider.Control>
      </Slider.Root>
      <p className="text-kurio-text-secondary">
        Preço: {fmt(value[0])} - {fmt(value[1])} ETH
      </p>
      <button
        type="button"
        onClick={() =>
          onApply(
            value[0] > domainMin ? String(value[0]) : undefined,
            value[1] < domainMax ? String(value[1]) : undefined,
          )
        }
        className="mt-1 self-start rounded bg-kurio-primary px-3 py-1.5 font-bold text-kurio-ink hover:bg-kurio-primary-light"
      >
        Aplicar
      </button>
    </div>
  )
}
