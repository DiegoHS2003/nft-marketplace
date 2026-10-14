import { test, expect, type Page } from '@playwright/test'

// no desktop a busca fica atrás de uma lupa no header (precisa abrir); no mobile já vem visível no topo da Início
async function search(page: Page, term: string) {
  // espera a hidratação terminar antes de checar se a lupa está visível, senão a checagem corre antes do React montar
  await expect(page.getByRole('button', { name: 'Todos os NFTs' })).toBeVisible()
  const openButton = page.getByRole('button', { name: 'Abrir busca' })
  if (await openButton.isVisible()) await openButton.click()
  // no desktop a lupa do header e a barra do mobile convivem no DOM; só uma fica visível por vez
  const field = page.getByLabel('Buscar NFT').and(page.locator(':visible'))
  await field.fill(term)
  await field.press('Enter')
}

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
  await search(page, 'Ape')
  await expect(page).toHaveURL(/q=Ape/)
  await expect(page.getByRole('link', { name: /Emerald Ape/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Sage Nomad/ })).toHaveCount(0)

  await search(page, 'zzzz')
  await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
})

test('NFT inexistente e rota desconhecida', async ({ page }) => {
  await page.goto('/nfts/999')
  await expect(page.getByText('Este NFT não existe.')).toBeVisible()

  await page.goto('/qualquer-coisa')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
