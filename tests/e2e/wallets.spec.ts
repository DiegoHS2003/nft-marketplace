import { test, expect } from '@playwright/test'

test('carteiras: cadastra carteira secundária com endereço inválido e depois válido', async ({ page }) => {
  // bruno só tem carteira principal no mock — a seção secundária começa vazia (cadastro, não edição)
  await page.goto('/login?redirect=%2Fcarteiras')
  await page.getByLabel('E-mail').fill('bruno@kurio.test')
  await page.getByLabel('Senha').fill('kurio123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/carteiras$/)

  await page.getByLabel('Apelido da carteira secundária').fill('Carteira de testes')
  await page.getByLabel('Endereço da carteira secundária').fill('123')
  await page.getByLabel('Ethereum (secundária)').check()
  await page.getByRole('button', { name: 'Adicionar carteira secundária' }).click()

  await expect(page.getByText('Endereço de carteira inválido')).toBeVisible()

  await page.getByLabel('Endereço da carteira secundária').fill('0xFeedFace0000000000000000000000000001')
  await page.getByRole('button', { name: 'Adicionar carteira secundária' }).click()

  await expect(page.getByText('Carteira salva.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar carteira secundária' })).toBeVisible()

  // persiste após refresh
  await page.reload()
  await expect(page.getByLabel('Endereço da carteira secundária')).toHaveValue('0xFeedFace0000000000000000000000000001')
  await expect(page.getByLabel('Apelido da carteira secundária')).toHaveValue('Carteira de testes')
})
