import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: [['html', { open: 'never' }], ['list']],
  expect: {
    timeout: 10_000,
    // regressão visual (tests/e2e/visual.spec.ts): sem animação, sem caret, com pequena tolerância
    // pra diferenças de antialiasing entre execuções na mesma máquina
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  // testa o build de produção, igual ao que vai pra Vercel
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
