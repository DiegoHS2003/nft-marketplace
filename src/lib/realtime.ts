import { io } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import type { Cart, Nft, NftListResponse, NftUpdate, Order, OrderUpdate, RealtimeEvent } from '@/types/api'

// Maior versão do NFT que a interface já conhece (detalhe, listas e carrinho)
function knownVersion(qc: QueryClient, id: string) {
  const versions: number[] = []
  const nft = qc.getQueryData<Nft>(['nft', id])
  if (nft) versions.push(nft.version)
  for (const [, list] of qc.getQueriesData<NftListResponse>({ queryKey: ['nfts'] })) {
    for (const n of list?.items ?? []) if (n.id === id) versions.push(n.version)
  }
  for (const line of qc.getQueryData<Cart>(['cart'])?.items ?? []) {
    if (line.nft.id === id) versions.push(line.nft.version)
  }
  return versions.length ? Math.max(...versions) : 0
}

export function connectRealtime(qc: QueryClient, token: string | null, onNotice: (message: string) => void) {
  const seen = new Set<string>()
  const isNew = (id: string) => {
    if (seen.has(id)) return false // duplicata
    seen.add(id)
    if (seen.size > 200) seen.delete(seen.values().next().value as string)
    return true
  }

  const socket = io({ path: '/realtime', transports: ['websocket'], query: token ? { token } : {} })

  // Depois de reconectar, tudo que está na tela é reconciliado com a API REST
  let connectedBefore = false
  socket.on('connect', () => {
    if (connectedBefore) {
      for (const key of ['cart', 'nfts', 'nft', 'order']) qc.invalidateQueries({ queryKey: [key] })
    }
    connectedBefore = true
  })

  socket.on('nft.updated', (event: RealtimeEvent<NftUpdate>) => {
    if (!isNew(event.id)) return
    const id = event.resource.id
    // evento antigo nunca regride um estado mais recente
    if (event.version <= knownVersion(qc, id)) return

    const apply = (n: Nft): Nft =>
      n.id === id && event.version > n.version
        ? { ...n, version: event.version, price: event.data.price, editionsAvailable: event.data.editionsAvailable }
        : n

    const inCart = qc.getQueryData<Cart>(['cart'])?.items.find((l) => l.nft.id === id)

    qc.setQueryData<Nft>(['nft', id], (old) => (old ? apply(old) : old))
    qc.setQueriesData<NftListResponse>({ queryKey: ['nfts'] }, (old) =>
      old && { ...old, items: old.items.map(apply) },
    )
    // subtotal, taxa e total vêm da API, então o carrinho é buscado de novo
    qc.invalidateQueries({ queryKey: ['cart'] })

    if (inCart) onNotice(`${inCart.nft.name}: o preço ou a disponibilidade mudou. O resumo foi atualizado.`)
  })

  socket.on('order.updated', (event: RealtimeEvent<OrderUpdate>) => {
    if (!isNew(event.id)) return
    const id = event.resource.id
    const current = qc.getQueryData<Order>(['order', id])
    // confirmado e recusado são finais, e versão antiga é ignorada
    if (current && (current.status !== 'pending' || event.version <= current.version)) return

    if (current) qc.setQueryData<Order>(['order', id], { ...current, ...event.data, version: event.version })
    qc.invalidateQueries({ queryKey: ['order', id] }) // traz o recibo completo pela API
    qc.invalidateQueries({ queryKey: ['cart'] })
    onNotice(event.data.status === 'confirmed' ? 'Pedido confirmado.' : 'Pagamento recusado.')
  })

  // libera listeners e conexão quando a sessão muda ou o app desmonta
  return () => {
    socket.off()
    socket.disconnect()
  }
}