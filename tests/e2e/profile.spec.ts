import { test, expect } from '@playwright/test'
import { login } from './helpers'

test('perfil: edita nome e persiste após refresh', async ({ page }) => {
  await login(page, '/conta')

  // espera o formulário carregar os dados atuais antes de sobrescrever (evita corrida com o GET /api/profile)
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Colecionadora')
  await page.getByLabel('Nome de exibição').fill('Ana Renomeada')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Dados atualizados.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ana Renomeada' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Renomeada')
})

test('perfil: e-mail já usado por outra conta volta erro 409 associado ao campo', async ({ page }) => {
  await login(page, '/conta')

  await expect(page.getByLabel('E-mail')).toHaveValue('ana@kurio.test')
  await page.getByLabel('E-mail').fill('bruno@kurio.test')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('E-mail já cadastrado')).toBeVisible()
  await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
})

test('perfil: senha atual errada bloqueia a troca', async ({ page }) => {
  await login(page, '/conta')

  await page.getByLabel('Senha atual').fill('senha-errada')
  await page.getByLabel('Nova senha', { exact: true }).fill('novaSenha123')
  await page.getByLabel('Confirmar nova senha').fill('novaSenha123')
  await page.getByRole('button', { name: 'Alterar senha' }).click()

  await expect(page.getByText('Senha atual incorreta')).toBeVisible()
})

test('perfil: troca de senha e login com a nova senha', async ({ page }) => {
  await login(page, '/conta')

  await page.getByLabel('Senha atual').fill('kurio123')
  await page.getByLabel('Nova senha', { exact: true }).fill('novaSenha123')
  await page.getByLabel('Confirmar nova senha').fill('novaSenha123')
  await page.getByRole('button', { name: 'Alterar senha' }).click()
  await expect(page.getByText('Senha alterada.')).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()

  await page.goto('/login?redirect=%2Fconta')
  await page.getByLabel('E-mail').fill('ana@kurio.test')
  await page.getByLabel('Senha').fill('novaSenha123')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/conta$/)
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()
})
