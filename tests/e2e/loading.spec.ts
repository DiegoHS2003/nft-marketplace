import { test, expect } from '@playwright/test'
import { addNft } from './helpers'

// cenário 'slow_network' adiciona um atraso extra nos GETs do mock (ver src/mocks/handlers.ts),
// só pra dar tempo de ver o skeleton antes do conteúdo real chegar

test('skeleton do catálogo aparece durante carregamento lento e depois some para o conteúdo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kurio:mock-scenario', 'slow_network'))
  await page.goto('/')

  await expect(page.getByTestId('catalogo-skeleton')).toBeVisible()
  await expect(page.getByRole('link', { name: /Emerald Ape/ }).first()).toBeVisible()
  await expect(page.getByTestId('catalogo-skeleton')).toHaveCount(0)
})

test('skeleton do detalhe do NFT aparece durante carregamento lento e depois some para o conteúdo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kurio:mock-scenario', 'slow_network'))
  await page.goto('/nfts/1')

  await expect(page.getByTestId('nft-skeleton')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Emerald Ape/ })).toBeVisible()
  await expect(page.getByTestId('nft-skeleton')).toHaveCount(0)
})

test('skeleton do resumo do carrinho aparece durante carregamento lento e depois some para o conteúdo', async ({ page }) => {
  await addNft(page) // adiciona o Sage Nomad com a rede normal, sem atraso
  await page.evaluate(() => (window as any).__kurioMock.setScenario('slow_network'))
  await page.goto('/carrinho')

  await expect(page.getByTestId('carrinho-skeleton')).toBeVisible()
  await expect(page.getByText('Sage Nomad')).toBeVisible()
  await expect(page.getByTestId('carrinho-skeleton')).toHaveCount(0)
})
