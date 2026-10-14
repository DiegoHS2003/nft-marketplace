import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { mockControls, realtimeHandlers } from './realtime'
import { db, resetDb, saveSessions } from './db'

export const worker = setupWorker(...handlers, ...realtimeHandlers)

// Console de demonstração: window.__kurioMock
Object.assign(window, {
  __kurioMock: {
    ...mockControls,
    setScenario: (name: string | null) =>
      name ? localStorage.setItem('kurio:mock-scenario', name) : localStorage.removeItem('kurio:mock-scenario'),
    // apaga a sessão atual no "servidor": a próxima requisição autenticada responde 401 session_expired
    expireSession: () => {
      const token = localStorage.getItem('kurio:token')
      if (token) {
        db.sessions.delete(token)
        saveSessions()
      }
    },
    reset: async () => {
      await resetDb()
      for (const key of ['kurio:token', 'kurio:mock-scenario', 'kurio:guest-id']) localStorage.removeItem(key)
      location.reload()
    },
  },
})