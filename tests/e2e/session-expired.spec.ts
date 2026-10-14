import { test, expect } from '@playwright/test'
import { addNft, fillCheckout, login } from './helpers'

test('sessão expira navegando para /conta: loga de novo e volta pra rota de origem', async ({ page }) => {
  await login(page, '/conta')
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()

  await page.evaluate(() => (window as any).__kurioMock.expireSession())

  await page.goto('/conta')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()

  await page.getByLabel('E-mail').fill('ana@kurio.test')
  await page.getByLabel('Senha').fill('kurio123')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/conta$/)
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()
})

test('sessão expira no pagamento: formulário volta preenchido e a compra fecha com um único pedido', async ({ page }) => {
  await addNft(page)
  await login(page, '/carrinho')
  await page.getByRole('link', { name: 'Ir para pagamento' }).click()
  await fillCheckout(page)

  await page.evaluate(() => (window as any).__kurioMock.expireSession())
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()

  await page.getByLabel('E-mail').fill('ana@kurio.test')
  await page.getByLabel('Senha').fill('kurio123')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/pagamento$/)
  // os campos preenchidos antes da sessão cair voltam sem precisar digitar de novo
  await expect(page.getByLabel('Nome do colecionador')).toHaveValue('Ana Colecionadora')
  await expect(page.getByLabel('Carteira')).toHaveValue('w1')
  await expect(page.getByLabel('Rede')).toHaveValue('ethereum')

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/pedido\//)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible()

  // a tentativa que caiu com a sessão expirada não criou pedido: só existe este, reaproveitando a chave
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio:mock-orders') ?? '[]').length)
  expect(orders).toBe(1)
})
