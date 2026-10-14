import { test, expect } from '@playwright/test'
import { addNft, fillCheckout, login } from './helpers'

test('compra completa: carrinho do visitante, cupom, clique repetido e recibo', async ({ page }) => {
  await addNft(page)
  await login(page, '/carrinho')
  // o item do visitante foi mesclado ao carrinho da conta
  await expect(page.getByText('Sage Nomad')).toBeVisible()

  await page.getByRole('textbox', { name: 'Cupom' }).fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Cupom KURIO10 aplicado')).toBeVisible()

  await page.getByRole('link', { name: 'Ir para pagamento' }).click()
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).dblclick()

  await expect(page).toHaveURL(/\/pedido\//)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible()
  await expect(page.getByText('Transação: 0x')).toBeVisible()

  // clique repetido não duplica o pedido
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio:mock-orders') ?? '[]').length)
  expect(orders).toBe(1)

  // só o que foi comprado sai do carrinho
  await page.goto('/carrinho')
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})

test('pagamento recusado mantém os itens no carrinho', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kurio:mock-scenario', 'payment_refused'))

  await addNft(page)
  await login(page, '/carrinho')
  await page.getByRole('link', { name: 'Ir para pagamento' }).click()
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
  await page.goto('/carrinho')
  await expect(page.getByText('Sage Nomad')).toBeVisible()
})
