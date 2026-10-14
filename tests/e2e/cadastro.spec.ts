import { test, expect } from '@playwright/test'
import { addNft } from './helpers'

test('cadastro: erro de validação mostra mensagens associadas aos campos', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Nome de usuário').fill('Nova Colecionadora')
  await page.getByLabel('E-mail').fill('nova@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('123')
  await page.getByLabel('Confirmar senha').fill('456')
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page.getByText('A senha precisa ter ao menos 8 caracteres')).toBeVisible()
  await expect(page.getByText('As senhas não coincidem')).toBeVisible()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Confirmar senha')).toHaveAttribute('aria-invalid', 'true')
})

test('cadastro: e-mail já cadastrado volta erro 409 associado ao campo', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Nome de usuário').fill('Ana Duplicada')
  await page.getByLabel('E-mail').fill('ana@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByLabel('Confirmar senha').fill('senha1234')
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page.getByText('E-mail já cadastrado')).toBeVisible()
  await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
})

test('cadastro com sucesso: fica logado, carrinho do visitante é mesclado e volta ao fluxo anterior', async ({ page }) => {
  await addNft(page) // Sage Nomad no carrinho, ainda como visitante

  await page.goto('/conta')
  await expect(page).toHaveURL(/\/login\?redirect=/)

  await page.getByRole('link', { name: /criar conta|crie uma conta/i }).click()
  await expect(page).toHaveURL(/\/cadastro\?redirect=/)

  await page.getByLabel('Nome de usuário').fill('Nova Colecionadora')
  await page.getByLabel('E-mail').fill('nova@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByLabel('Confirmar senha').fill('senha1234')
  await page.getByRole('button', { name: 'Criar conta' }).click()

  // volta pro /conta, que era o fluxo que o usuário estava tentando acessar
  await expect(page).toHaveURL(/\/conta$/)
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nova Colecionadora' })).toBeVisible()

  await page.goto('/carrinho')
  await expect(page.getByText('Sage Nomad')).toBeVisible()
})

test('diálogo de login: foco fica preso dentro e Esc fecha devolvendo o foco', async ({ page }) => {
  await page.goto('/')
  const viewport = page.viewportSize()
  test.skip(!viewport || viewport.width < 768, 'login vira diálogo só em telas md+ (>= 768px)')

  await page.getByRole('link', { name: 'Entrar' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // tabula bastante: mesmo passando do último elemento, o foco não pode escapar do diálogo
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(30)
  }
  const stillInsideDialog = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    return !!dialog && dialog.contains(document.activeElement)
  })
  expect(stillInsideDialog).toBe(true)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL('/')
  // o foco volta pro link que abriu o diálogo
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeFocused()
})
