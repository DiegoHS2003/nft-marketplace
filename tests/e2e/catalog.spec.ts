import { test, expect } from '@playwright/test'

test('ordenação e paginação ficam na URL e sobrevivem ao histórico', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Página 1 de 3')).toBeVisible()

  await page.getByRole('button', { name: 'Próxima' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText('Página 2 de 3')).toBeVisible()

  // mudar o filtro reinicia a paginação
  await page.getByLabel('Ordenar por').selectOption('price_asc')
  await expect(page).toHaveURL(/sort=price_asc/)
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.getByText('Página 1 de 3')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await page.reload()
  await expect(page.getByText('Página 2 de 3')).toBeVisible()
})

test('busca por nome e resultado vazio', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Buscar NFT').fill('Ape')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page).toHaveURL(/q=Ape/)
  await expect(page.getByRole('link', { name: /Emerald Ape/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Sage Nomad/ })).toHaveCount(0)

  await page.getByLabel('Buscar NFT').fill('zzzz')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
})

test('NFT inexistente e rota desconhecida', async ({ page }) => {
  await page.goto('/nfts/999')
  await expect(page.getByText('Este NFT não existe.')).toBeVisible()

  await page.goto('/qualquer-coisa')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
