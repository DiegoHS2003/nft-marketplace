import { test, expect } from '@playwright/test'
import { addNft, fillCheckout, login } from './helpers'

test('mudança de preço pelo socket trava o checkout até o usuário aceitar', async ({ page }) => {
  await addNft(page)
  await login(page, '/carrinho')
  await page.getByRole('link', { name: 'Ir para pagamento' }).click()
  await fillCheckout(page)

  // o evento passa pelo socket.io-client. Repete até a conexão estar de pé.
  await expect(async () => {
    await page.evaluate(() => (window as any).__kurioMock.changePrice('2', '3.33'))
    await expect(page.getByText('Os valores do pedido mudaram')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })

  const summary = page.getByRole('region', { name: 'Resumo do pedido' })
  await expect(summary).toContainText('3.33 ETH')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()

  // evento duplicado e evento antigo não mudam nada
  await page.evaluate(() => {
    const mock = (window as any).__kurioMock
    mock.repeatLastEvent()
    mock.sendStaleEvent('2')
  })
  await page.waitForTimeout(500)
  await expect(summary).toContainText('3.33 ETH')
  await expect(summary).not.toContainText('999')

  await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible()
})
