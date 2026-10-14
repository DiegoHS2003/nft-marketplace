import { test, expect } from '@playwright/test'
import { login } from './helpers'

test('favoritar um NFT autenticado persiste após refresh', async ({ page }) => {
  await login(page, '/nfts/4')

  await page.getByRole('button', { name: 'Favoritar' }).click()
  const favorited = page.getByRole('button', { name: 'dos favoritos' })
  await expect(favorited).toHaveAttribute('aria-pressed', 'true')
  // espera a mutation assentar (o mock tem um delay) antes de recarregar, senão o POST é cancelado pela navegação
  await expect(favorited).toBeEnabled()

  await page.reload()
  await expect(page.getByRole('button', { name: 'dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
})

test('desfavoritar remove o NFT dos favoritos', async ({ page }) => {
  await login(page, '/nfts/4')

  await page.getByRole('button', { name: 'Favoritar' }).click()
  const favorited = page.getByRole('button', { name: 'dos favoritos' })
  await expect(favorited).toHaveAttribute('aria-pressed', 'true')
  await expect(favorited).toBeEnabled()

  await favorited.click()
  const notFavorited = page.getByRole('button', { name: 'Favoritar' })
  await expect(notFavorited).toHaveAttribute('aria-pressed', 'false')
  await expect(notFavorited).toBeEnabled()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Favoritar' })).toHaveAttribute('aria-pressed', 'false')
})

test('falha ao favoritar reverte o estado com aviso acessível', async ({ page }) => {
  await login(page, '/nfts/4')
  await page.evaluate(() => (window as any).__kurioMock.setScenario('favorites_fail'))

  await page.getByRole('button', { name: 'Favoritar' }).click()

  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível salvar o favorito' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Favoritar' })).toHaveAttribute('aria-pressed', 'false')

  // o scenario só afeta a mutation: sem ele, favoritar funciona normalmente
  await page.evaluate(() => (window as any).__kurioMock.setScenario(null))
  await page.getByRole('button', { name: 'Favoritar' }).click()
  await expect(page.getByRole('button', { name: 'dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
})
