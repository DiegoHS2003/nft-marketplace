import { test, expect } from '@playwright/test'

test('rota protegida vai pro login, erro de senha, retorno, refresh e logout', async ({ page }) => {
  await page.goto('/conta')
  await expect(page).toHaveURL(/\/login\?redirect=/)

  await page.getByLabel('E-mail').fill('ana@kurio.test')
  await page.getByLabel('Senha').fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha inválidos')).toBeVisible()

  await page.getByLabel('Senha').fill('kurio123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/conta$/)
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()

  // a sessão sobrevive ao refresh
  await page.reload()
  await expect(page.getByText('ana@kurio.test')).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  // espera o logout terminar antes de navegar, senão o teste corre contra a requisição
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  await page.goto('/conta')
  await expect(page).toHaveURL(/\/login/)
})
