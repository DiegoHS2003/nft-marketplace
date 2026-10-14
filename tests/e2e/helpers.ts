import { expect, type Page } from '@playwright/test'

export async function addNft(page: Page, id = '2') {
  await page.goto(`/nfts/${id}`)
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Adicionado' })).toBeVisible()
}

export async function login(page: Page, redirect = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await page.getByLabel('E-mail').fill('ana@kurio.test')
  await page.getByLabel('Senha').fill('kurio123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('link', { name: 'Ana Colecionadora' })).toBeVisible()
}

export async function fillCheckout(page: Page) {
  await page.getByLabel('Nome do colecionador').fill('Ana Colecionadora')
  await page.getByLabel('E-mail').fill('ana@kurio.test')
  await page.getByLabel('Carteira').selectOption('w1')
  await page.getByLabel('Rede').selectOption('ethereum')
}
