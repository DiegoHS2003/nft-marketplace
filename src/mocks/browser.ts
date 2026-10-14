import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { mockControls, realtimeHandlers } from './realtime'
import { resetDb } from './db'

export const worker = setupWorker(...handlers, ...realtimeHandlers)

// Console de demonstração: window.__kurioMock
Object.assign(window, {
  __kurioMock: {
    ...mockControls,
    setScenario: (name: string | null) =>
      name ? localStorage.setItem('kurio:mock-scenario', name) : localStorage.removeItem('kurio:mock-scenario'),
    reset: async () => {
      await resetDb()
      for (const key of ['kurio:token', 'kurio:mock-scenario', 'kurio:guest-id']) localStorage.removeItem(key)
      location.reload()
    },
  },
})