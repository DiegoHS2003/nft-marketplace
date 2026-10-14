import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdate, OrderUpdate, RealtimeEvent } from '@/types/api'
import { db, saveNfts, type StoredOrder } from './db'

// O cliente conecta em /realtime (Socket.IO com path customizado)
const realtime = ws.link('*/realtime/')

interface Sock {
  io: ReturnType<typeof toSocketIo>
  userId: string | null
}

const sockets = new Set<Sock>()
let seq = 0
let lastNftEvent: RealtimeEvent<NftUpdate> | null = null

const nextId = () => `evt_${Date.now().toString(36)}_${++seq}`

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    // o binding ignora o pacote de autenticação do Socket.IO, então o token vai na query
    const token = new URL(connection.client.url).searchParams.get('token')
    const sock: Sock = { io, userId: token ? (db.sessions.get(token) ?? null) : null }
    sockets.add(sock)

    // O mock não implementa o ping do Engine.IO. Sem isso o cliente derruba a conexão após ~30 s.
    const ping = setInterval(() => connection.client.send('2'), 20_000)
    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      sockets.delete(sock)
    })
  }),
]

function send(filter: (s: Sock) => boolean, event: string, payload: unknown) {
  for (const s of sockets) {
    if (filter(s)) s.io.client.emit(event, payload)
  }
}

export function emitNftUpdated(nftId: string) {
  const nft = db.nfts.find((n) => n.id === nftId)
  if (!nft) return
  const event: RealtimeEvent<NftUpdate> = {
    id: nextId(),
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    data: { price: nft.price, editionsAvailable: nft.editionsAvailable },
  }
  lastNftEvent = event
  send(() => true, 'nft.updated', event)
}

// Evento de pedido só chega às conexões do dono do pedido
export function emitOrderUpdated(order: StoredOrder) {
  const event: RealtimeEvent<OrderUpdate> = {
    id: nextId(),
    resource: { type: 'order', id: order.id },
    version: order.version,
    data: { status: order.status, txHash: order.txHash, refusalReason: order.refusalReason },
  }
  send((s) => s.userId === order.userId, 'order.updated', event)
}

function mutateNft(id: string, patch: { price?: string; editionsAvailable?: number }) {
  const nft = db.nfts.find((n) => n.id === id)
  if (!nft) throw new Error(`NFT ${id} não existe`)
  Object.assign(nft, patch)
  nft.version += 1
  saveNfts()
  emitNftUpdated(id)
}

// Controles de demonstração e de teste: tudo passa pelo socket, nunca direto na interface
export const mockControls = {
  changePrice: (id: string, price: string) => mutateNft(id, { price }),
  setStock: (id: string, editionsAvailable: number) => mutateNft(id, { editionsAvailable }),
  repeatLastEvent: () => {
    if (lastNftEvent) send(() => true, 'nft.updated', lastNftEvent) // duplicata
  },
  sendStaleEvent: (id: string) =>
    send(() => true, 'nft.updated', {
      id: nextId(),
      resource: { type: 'nft', id },
      version: 0, // versão antiga: o cliente precisa ignorar
      data: { price: '999', editionsAvailable: 0 },
    }),
  dropConnections: () => realtime.clients.forEach((c) => c.close()),
}