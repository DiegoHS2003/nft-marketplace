# Testes E2E

`npm run test:e2e` roda tudo (Chromium, projetos `desktop` 1440×900 e `mobile` 390×844) contra o build de
produção servido por `vite preview` (o `webServer` do `playwright.config.ts` builda e sobe sozinho).
`npm run test:report` abre o relatório HTML da última execução.

## Regressão visual (`visual.spec.ts`)

Cobre início, detalhe do NFT, carrinho e pagamento, nos dois viewports (8 baselines em
`visual.spec.ts-snapshots/`).

Por que é determinístico:

- Cada teste do Playwright roda num contexto de navegador novo (sem `storageState` compartilhado), então
  `localStorage` começa vazio e o mock (`src/mocks/db.ts`) sempre cai no mesmo cenário semente — não é
  preciso resetar nada manualmente.
- `page.emulateMedia({ reducedMotion: 'reduce' })` no `beforeEach` desliga o autoplay do carrossel da Início
  (`HeroCarousel` lê `prefers-reduced-motion` via `useReducedMotion`) e para as transições CSS (ver a regra
  `@media (prefers-reduced-motion: reduce)` em `src/index.css`).
- `animations: 'disabled'`, `caret: 'hide'` e `maxDiffPixelRatio: 0.01` (tolerância pra antialiasing) estão
  configurados uma vez em `playwright.config.ts` (`expect.toHaveScreenshot`), valendo pra todo `toHaveScreenshot`.
- Cada teste espera um elemento-chave da tela carregada (ex.: heading do NFT, ausência do skeleton) antes de
  tirar o print, pra nunca capturar um estado intermediário de loading.
- As 4 páginas não mostram nada derivado do relógio (data/hora reais) nem de `Math.random()` — os valores
  vêm todos dos fixtures semente (`src/mocks/fixtures.ts`), por isso não há necessidade de mascarar nada com
  `mask: [...]`. Se uma tela nova passar a mostrar algo assim, mascare o elemento em vez de aceitar o diff.

### Como atualizar os baselines

Só depois de confirmar visualmente que a mudança é intencional (não é regressão):

```bash
npx playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Rode a suíte normal (sem `--update-snapshots`) pelo menos duas vezes em seguida depois de atualizar, pra
confirmar que o novo baseline não oscila:

```bash
npx playwright test tests/e2e/visual.spec.ts
npx playwright test tests/e2e/visual.spec.ts
```

Comite os `.png` atualizados junto com a mudança que os motivou.
