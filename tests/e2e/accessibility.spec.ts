import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { addNft, login } from './helpers'

// serious/critical violações são bloqueantes; moderate/minor só informam (ex.: contraste em texto
// decorativo que o Figma já define assim) sem falhar o teste.
async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
}

test('início não tem violações sérias de acessibilidade', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Emerald Ape/ }).first()).toBeVisible()
  await expectNoSeriousViolations(page)
})

test('detalhe do NFT não tem violações sérias de acessibilidade', async ({ page }) => {
  await page.goto('/nfts/2')
  await expect(page.getByRole('heading', { name: 'Sage Nomad #237' })).toBeVisible()
  await expectNoSeriousViolations(page)
})

test('carrinho não tem violações sérias de acessibilidade', async ({ page }) => {
  await addNft(page)
  await page.goto('/carrinho')
  await expect(page.getByText('Sage Nomad')).toBeVisible()
  await expectNoSeriousViolations(page)
})

test('pagamento não tem violações sérias de acessibilidade', async ({ page }) => {
  await addNft(page)
  await login(page, '/carrinho')
  await page.getByRole('link', { name: 'Ir para pagamento' }).click()
  await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
  await expectNoSeriousViolations(page)
})

test('modal de login não tem violações sérias de acessibilidade', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expectNoSeriousViolations(page)
})

test('perfil e carteiras não têm violações sérias de acessibilidade', async ({ page }) => {
  await login(page)
  await page.goto('/conta')
  await expect(page.getByText('Perfil do colecionador')).toBeVisible()
  await expectNoSeriousViolations(page)

  await page.goto('/carteiras')
  await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  await expectNoSeriousViolations(page)
})
