import { test, expect } from '@playwright/test'
import { addNft, login } from './helpers'

// Cada teste roda numa página/contexto novo do Playwright (sem storageState compartilhado),
// então localStorage começa vazio e o mock cai sempre no mesmo cenário semente (ver src/mocks/db.ts) —
// não precisa de reset manual. prefers-reduced-motion desliga o autoplay do carrossel (HeroCarousel
// lê isso via useReducedMotion) e, junto com animations:'disabled'/caret:'hide' (playwright.config.ts),
// deixa a captura determinística.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('início', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Emerald Ape/ }).first()).toBeVisible()
  await expect(page.getByTestId('catalogo-skeleton')).toHaveCount(0)
  await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
})

test('detalhe do NFT', async ({ page }) => {
  await page.goto('/nfts/2')
  await expect(page.getByRole('heading', { name: 'Sage Nomad #237' })).toBeVisible()
  await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
})

test('carrinho', async ({ page }) => {
  await addNft(page)
  await page.goto('/carrinho')
  await expect(page.getByText('Sage Nomad')).toBeVisible()
  await expect(page.getByTestId('carrinho-skeleton')).toHaveCount(0)
  await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
})

test('pagamento', async ({ page }) => {
  await addNft(page)
  await login(page, '/carrinho')
  await page.getByRole('link', { name: 'Ir para pagamento' }).click()
  await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
  await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
})
