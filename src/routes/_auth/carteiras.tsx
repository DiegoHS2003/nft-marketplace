import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useAddWallet, useUpdateWallet, useWallets } from '@/api/wallets'
import { AccountSidebar } from '@/components/account/AccountSidebar'
import type { ApiError, Network, Wallet } from '@/types/api'

export const Route = createFileRoute('/_auth/carteiras')({ component: Carteiras })

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'solana', label: 'Solana' },
]

const card = 'rounded-2xl bg-kurio-card p-5'
const input = 'w-full rounded-lg border border-kurio-border bg-kurio-ink-soft px-3 py-2 text-sm'
const label = 'mb-1 block text-sm text-kurio-text-secondary'
const fieldError = 'mt-1 text-sm text-kurio-coral'

// endereço "parece" válido: mesmo padrão aceito pelo mock (alfanumérico, 6 a 64 caracteres)
function isValidAddress(v: string) {
  return /^[a-zA-Z0-9]{6,64}$/.test(v.trim())
}

function WalletForm({ kind, wallet }: { kind: 'primary' | 'secondary'; wallet?: Wallet }) {
  const title = kind === 'primary' ? 'principal' : 'secundária'
  const addWallet = useAddWallet()
  const updateWallet = useUpdateWallet()
  // decidido no submit (não a cada render): depois que o POST cria a carteira, a seção vira "editar"
  // e não pode perder o isSuccess do addWallet que acabou de disparar a mensagem de confirmação
  const [lastOp, setLastOp] = useState<'add' | 'update'>(wallet ? 'update' : 'add')
  const mutation = lastOp === 'update' ? updateWallet : addWallet

  const [walletLabel, setWalletLabel] = useState(wallet?.label ?? '')
  const [address, setAddress] = useState(wallet?.address ?? '')
  const [networks, setNetworks] = useState<Network[]>(wallet?.networks ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // se o PATCH/POST de outra seção devolver uma lista nova, mantém os campos em dia após salvar
  useEffect(() => {
    if (wallet) {
      setWalletLabel(wallet.label)
      setAddress(wallet.address)
      setNetworks(wallet.networks)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.label, wallet?.address, wallet?.networks.join(',')])

  function toggleNetwork(n: Network) {
    setNetworks((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!walletLabel.trim()) next.label = 'Informe um apelido para a carteira'
    if (!isValidAddress(address)) next.address = 'Endereço de carteira inválido'
    if (networks.length === 0) next.networks = 'Selecione ao menos uma rede'
    setErrors(next)
    if (Object.keys(next).length) return

    const body = { label: walletLabel.trim(), address: address.trim(), kind, networks }
    const onError = (error: unknown) => {
      if (isAxiosError<ApiError>(error) && error.response?.data.fields) setErrors(error.response.data.fields)
    }
    if (wallet) {
      setLastOp('update')
      updateWallet.mutate({ id: wallet.id, body }, { onError })
    } else {
      setLastOp('add')
      addWallet.mutate(body, { onError })
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={card}>
      <h2 className="mb-1 text-lg font-bold text-kurio-text">Carteira {title}</h2>
      <p className="mb-4 text-sm text-kurio-text-secondary">
        {kind === 'primary'
          ? 'Esta carteira fica disponível no pagamento e para receber NFTs comprados.'
          : wallet
            ? 'Uma segunda carteira para usar como alternativa no pagamento.'
            : 'Você ainda não cadastrou uma carteira secundária.'}
      </p>
      <div className="flex flex-col gap-3 sm:max-w-md">
        <div>
          <label htmlFor={`wallet-${kind}-label`} className={label}>Apelido da carteira {title}</label>
          <input
            id={`wallet-${kind}-label`}
            value={walletLabel}
            onChange={(e) => setWalletLabel(e.target.value)}
            aria-invalid={!!errors.label}
            aria-describedby={errors.label ? `wallet-${kind}-label-error` : undefined}
            className={input}
          />
          {errors.label && <p id={`wallet-${kind}-label-error`} role="alert" className={fieldError}>{errors.label}</p>}
        </div>

        <div>
          <label htmlFor={`wallet-${kind}-address`} className={label}>Endereço da carteira {title}</label>
          <input
            id={`wallet-${kind}-address`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-invalid={!!errors.address}
            aria-describedby={errors.address ? `wallet-${kind}-address-error` : undefined}
            className={input}
          />
          {errors.address && <p id={`wallet-${kind}-address-error`} role="alert" className={fieldError}>{errors.address}</p>}
        </div>

        <fieldset>
          <legend className={label}>Rede</legend>
          <div className="flex flex-wrap gap-3">
            {NETWORKS.map((n) => (
              <label key={n.value} htmlFor={`wallet-${kind}-network-${n.value}`} className="flex items-center gap-1.5 text-sm text-kurio-text">
                <input
                  id={`wallet-${kind}-network-${n.value}`}
                  type="checkbox"
                  checked={networks.includes(n.value)}
                  onChange={() => toggleNetwork(n.value)}
                  aria-invalid={!!errors.networks}
                />
                {n.label} ({title})
              </label>
            ))}
          </div>
          {errors.networks && <p role="alert" className={fieldError}>{errors.networks}</p>}
        </fieldset>

        {mutation.isError &&
          isAxiosError<ApiError>(mutation.error) &&
          !mutation.error.response?.data.fields && (
            <p role="alert" className={fieldError}>
              {mutation.error.response?.data.message ?? 'Não foi possível salvar a carteira. Tente de novo.'}
            </p>
          )}
        {mutation.isSuccess && <p role="status" className="text-sm text-kurio-success">Carteira salva.</p>}

        <button
          disabled={mutation.isPending}
          className="self-start rounded-lg bg-kurio-accent px-4 py-2 font-bold text-kurio-bg disabled:opacity-50"
        >
          {mutation.isPending ? 'Salvando...' : wallet ? `Salvar carteira ${title}` : `Adicionar carteira ${title}`}
        </button>
      </div>
    </form>
  )
}

function Carteiras() {
  const { data: wallets = [], isLoading } = useWallets()
  const primary = wallets.find((w) => w.kind === 'primary')
  const secondary = wallets.find((w) => w.kind === 'secondary')

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-6 md:pt-8">
      <h1 className="text-2xl font-bold text-kurio-text">Carteiras</h1>

      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
        <AccountSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {isLoading ? (
            <p className="text-sm text-kurio-text-secondary">Carregando carteiras...</p>
          ) : (
            <>
              <WalletForm kind="primary" wallet={primary} />
              <WalletForm kind="secondary" wallet={secondary} />
            </>
          )}
        </div>
      </div>
    </main>
  )
}
