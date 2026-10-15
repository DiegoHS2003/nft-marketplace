# Kurio — Marketplace de NFTs

Marketplace de NFTs (React + TypeScript) construído como teste técnico. Cobre descoberta de catálogo, favoritos, carrinho, checkout com carteira simulada, confirmação de pedido, conta/sessão e perfil/carteiras — tudo contra uma API 100% simulada (sem backend real).

Não há blockchain, carteira ou gateway de pagamento de verdade: tudo é mock. Ver `ARCHITECTURE.md` para os contratos, decisões e limitações.

## Stack

- **Interface**: React 19 + TypeScript
- **Build**: Vite
- **Roteamento**: TanStack Router (file-based, em `src/routes`)
- **Estado remoto**: TanStack Query
- **HTTP**: Axios
- **Tempo real**: Socket.IO (`socket.io-client`)
- **Estilo**: Tailwind CSS v4 + shadcn/ui, fonte Roboto Mono
- **Mocking**: MSW v2 (REST) + `@mswjs/socket.io-binding` (WebSocket/Socket.IO)
- **Testes**: Playwright (E2E + regressão visual + `@axe-core/playwright` para acessibilidade)
- **Performance**: Lighthouse (script próprio em `lighthouse/`)

Não existe backend real: toda a API (REST e tempo real) é servida pelo MSW no próprio navegador. O "banco de dados" é `localStorage`.

## Instalação

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173` (porta padrão do Vite). Os mocks ficam ativos por padrão — não é preciso configurar nada para desenvolver ou demonstrar a aplicação.

> Se você criar um arquivo novo em `src/routes`, rode `npm run dev` por alguns segundos antes de buildar: isso regenera `src/routeTree.gen.ts`, que precisa estar versionado.

## Variáveis de ambiente

Só existe uma variável de ambiente usada no código (`src/main.tsx`):

| Variável | Default | Efeito |
|---|---|---|
| `VITE_ENABLE_MOCKS` | ativado (qualquer valor diferente de `"false"`) | Se definida como `false`, o MSW **não** é ativado e a aplicação monta sem nenhum mock — todas as chamadas de API vão falhar, pois não há backend real. Não defina isso a menos que você tenha um backend real para apontar. |

Não há arquivo `.env` no repositório. Para desativar os mocks (não recomendado, pois nada vai funcionar sem backend), crie um `.env.local` com:

```
VITE_ENABLE_MOCKS=false
```

## Credenciais fictícias

Dois usuários já vêm cadastrados no mock (seed em `src/mocks/fixtures.ts`):

| E-mail | Senha | Nome |
|---|---|---|
| `ana@kurio.test` | `kurio123` | Ana Colecionadora |
| `bruno@kurio.test` | `kurio123` | Bruno Colecionador |

As senhas não são guardadas em claro: o mock salva um hash SHA-256 (`src/mocks/db.ts`). Você também pode criar uma conta nova pela tela de Cadastro — ela é persistida em `localStorage` e sobrevive a refresh.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o Vite em modo desenvolvimento, com os mocks ativos. |
| `npm run build` | `tsc -b` (type-check) seguido de `vite build` — gera `dist/`. |
| `npm run preview` | Serve o build de `dist/` localmente (`vite preview`). |
| `npm run typecheck` | Só type-check (`tsc -b --noEmit`), sem build. |
| `npm run lint` | `oxlint` sobre o código. |
| `npm run test:e2e` | Roda a suíte Playwright (builda e serve a produção sozinho, ver abaixo). |
| `npm run test:report` | Abre o relatório HTML da última execução do Playwright. |
| `npm run lighthouse` | Audita Início e Detalhe do NFT com Lighthouse (mobile + desktop), ver abaixo. |

## Cenários de mock

A camada de mock (`src/mocks/`) simula o "servidor": banco em `localStorage`, latências, falhas e eventos de tempo real. O cenário ativo fica em `localStorage['kurio:mock-scenario']` e é lido a cada requisição — pode ser trocado em qualquer momento, inclusive com a aplicação já aberta (sem precisar de reload, exceto onde indicado).

Em qualquer página com os mocks ativos, o console do navegador expõe `window.__kurioMock` (definido em `src/mocks/browser.ts`):

```js
// trocar/limpar o cenário de falha ativo
window.__kurioMock.setScenario('payment_refused') // ou 'order_timeout', 'favorites_fail', 'slow_network'
window.__kurioMock.setScenario(null) // volta ao cenário padrão (sucesso)

// forçar a sessão atual a expirar na próxima chamada autenticada
window.__kurioMock.expireSession()

// resetar completamente o mock (banco + localStorage) e recarregar a página
window.__kurioMock.reset()

// controles de tempo real (ver seção de eventos duplicados/antigos/queda de conexão abaixo)
window.__kurioMock.changePrice(nftId, '1.23')
window.__kurioMock.setStock(nftId, 0)
window.__kurioMock.repeatLastEvent()
window.__kurioMock.sendStaleEvent(nftId)
window.__kurioMock.dropConnections()
```

### Como resetar

`window.__kurioMock.reset()` é a forma recomendada: limpa o cenário de falha, o banco mock (NFTs, usuários — volta aos dois usuários semente —, favoritos, carteiras, sessões, carrinhos e pedidos), o token de sessão e o guest id, e recarrega a página num estado limpo e conhecido.

Alternativa manual: limpar todo o `localStorage` do site e recarregar tem o mesmo efeito (os dados do mock são recriados a partir dos fixtures na primeira leitura).

Os testes E2E e de regressão visual não precisam de reset manual: cada teste do Playwright roda num contexto de navegador novo, então já começa com `localStorage` vazio.

### Como reproduzir cada falha

| Cenário | Como ativar | O que observar |
|---|---|---|
| **Pagamento recusado** | `window.__kurioMock.setScenario('payment_refused')`, depois complete um checkout normalmente. | O pedido fica "Aguardando confirmação" por ~2,5s e depois vira "Pagamento recusado" (evento `order.updated` via socket). Os itens voltam a aparecer no carrinho — nada é removido em pedido recusado. |
| **Timeout de pedido** | `window.__kurioMock.setScenario('order_timeout')`, envie um pedido. | A chamada `POST /api/orders` falha como erro de rede no cliente (a tela mostra "Falha de conexão... ele não será criado duas vezes"), mas o pedido **já foi criado no servidor simulado**. O cliente reenvia automaticamente (até 2 tentativas) com a mesma `Idempotency-Key`, recuperando o mesmo pedido em vez de duplicar. Reabrir a página com a URL do pedido (`/pedido/:id`) também recupera o estado. |
| **Favoritos falhando** | `window.__kurioMock.setScenario('favorites_fail')`, logado, clique para favoritar/desfavoritar um NFT. | O coração muda na hora (otimista) e volta ao estado anterior quando a API recusa (500), com um aviso acessível (`role="alert"`). |
| **Sessão expirada** | `window.__kurioMock.expireSession()` enquanto estiver logado, depois navegue ou envie qualquer requisição autenticada (ex.: ir para `/conta` ou submeter o checkout). | Você é redirecionado para `/login?redirect=<rota atual>` com o aviso "Sua sessão expirou". Se estava no checkout, os campos preenchidos (nome, e-mail, carteira, rede, observação) são restaurados depois do login. |
| **Preço/estoque mudando** | Com um NFT no carrinho, em outra aba/console: `window.__kurioMock.changePrice(nftId, '9.99')` ou `window.__kurioMock.setStock(nftId, 0)`. | Catálogo, detalhe e carrinho atualizam o preço/disponibilidade em tempo real via `nft.updated`, com um aviso. Se a tela de pagamento estiver aberta com aquele item, o botão de confirmar fica bloqueado ("cotação desatualizada") até clicar em "Aceitar novos valores". |
| **Evento duplicado** | `window.__kurioMock.repeatLastEvent()` depois de qualquer mudança de preço/estoque. | Reenvia o último evento `nft.updated` — a interface ignora (já visto, deduplicado por id) e nada muda de novo. |
| **Evento antigo (stale)** | `window.__kurioMock.sendStaleEvent(nftId)`. | Envia um evento com versão `0` (preço `999`, zero edições). O cliente descarta porque a versão é mais antiga que a que já conhece — preço/estoque na tela não mudam. |
| **Queda de conexão** | `window.__kurioMock.dropConnections()`. | Fecha a conexão WebSocket de todas as abas abertas. O `socket.io-client` reconecta automaticamente (comportamento padrão da lib); ao reconectar, carrinho, NFTs e pedidos são revalidados contra a API REST (reconciliação), cobrindo qualquer evento perdido enquanto desconectado. |
| **Carregamento lento (skeletons)** | `window.__kurioMock.setScenario('slow_network')`. | Catálogo, detalhe do NFT e carrinho ganham +3s de latência nas respostas — dá tempo de ver os skeletons com shimmer. |
| **Cupom inválido/expirado** | No carrinho, aplique o código `QUALQUERCOISA` (inválido) ou `EXPIRADO` (expirado). O único cupom válido é `KURIO10` (10% de desconto). | Mensagem de erro correspondente, sem aplicar desconto. |
| **Estoque esgotado / quantidade inválida** | Adicione mais unidades de um NFT do que `editionsAvailable`, ou peça uma quantidade inválida. | 409 (`stock_conflict`) ou 422 (`validation_error`), mostrado perto do controle de quantidade. |
| **Cadastro com e-mail já usado** | Tente se cadastrar com `ana@kurio.test` ou `bruno@kurio.test`. | 409 (`email_taken`), erro associado ao campo de e-mail. |
| **Acesso a rota inexistente / NFT inexistente** | Acesse `/nfts/id-que-nao-existe` ou qualquer URL fora do roteamento. | Mensagens dedicadas ("Este NFT não existe." / "Página não encontrada"), sem crash. |

## Testes E2E e regressão visual

```bash
npm run test:e2e      # roda tudo (Chromium, projetos desktop 1440x900 e mobile 390x844)
npm run test:report   # abre o relatório HTML da última execução
```

O `webServer` do Playwright (`playwright.config.ts`) builda a aplicação e sobe `vite preview` na porta 4173 automaticamente — os testes rodam contra o **build de produção**, igual ao que vai para o deploy, e reaproveitam um servidor já no ar se houver um (`reuseExistingServer: true`).

Specs em `tests/e2e/`: autenticação, cadastro, catálogo (busca/filtros/ordenação/paginação/histórico), checkout completo e pagamento recusado, favoritos (incluindo falha), skeletons de carregamento lento, perfil, tempo real (preço mudando, evento duplicado, evento antigo), sessão expirada (navegação e durante o checkout), regressão visual e carteiras. Acessibilidade (`accessibility.spec.ts`) roda `axe-core` (regras WCAG 2A/2AA) nas principais telas, em desktop e mobile.

### Regressão visual

`tests/e2e/visual.spec.ts` tira screenshot de Início, Detalhe, Carrinho e Pagamento, em desktop e mobile (8 baselines versionadas em `tests/e2e/visual.spec.ts-snapshots/`). Cada teste roda num contexto de navegador novo (localStorage vazio → mock sempre no cenário semente) e desliga animações (`prefers-reduced-motion`), por isso é determinístico sem precisar mascarar nada.

Para atualizar os baselines (só depois de confirmar visualmente que a mudança é intencional):

```bash
npx playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Depois, rode a suíte normal (sem `--update-snapshots`) duas vezes seguidas para confirmar que o novo baseline não oscila, e comite os `.png` atualizados junto com a mudança que os motivou. Detalhes em `tests/e2e/README.md`.

## Lighthouse

```bash
npm run lighthouse
```

Builda a aplicação (ou reaproveita um `vite preview` já rodando na porta 4173), audita **Início** (`/`) e **Detalhe do NFT** (`/nfts/2`), nos perfis **mobile** e **desktop**, 3 execuções por combinação, e reporta a mediana de Performance/Accessibility/Best Practices/SEO/LCP/CLS/TBT. Config versionada em `lighthouse/config.mjs`; relatórios (HTML + JSON por execução, mais `summary.md`/`summary.json`) em `lighthouse/reports/`.

Resultado mais recente (`lighthouse/reports/summary.md`, ambiente: macOS arm64, Node 24.19.0, Lighthouse 13.5.0, Chrome 155, build de produção local com MSW ativo):

| Página | Perfil | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| Início | mobile | 90 | 100 | 100 | 100 |
| Início | desktop | 100 | 100 | 100 | 100 |
| Detalhe do NFT | mobile | 89 | 100 | 100 | 100 |
| Detalhe do NFT | desktop | 99 | 100 | 100 | 100 |

Único resultado abaixo da meta: Detalhe do NFT em mobile, Performance 89 (meta 90) — a causa (SPA sem SSR + mocks no caminho crítico + throttling de laboratório) está documentada e justificada em `ARCHITECTURE.md` e em `lighthouse/config.mjs`.

## Deploy

URL pública (Vercel): **TODO — preencher com o link do deploy**.

Repositório: configuração de SPA já incluída em `vercel.json` (rewrite de qualquer rota para `index.html`, necessário para refresh/acesso direto funcionar com o TanStack Router). Não há variáveis de ambiente obrigatórias para o deploy — os mocks continuam ativos no build de produção por padrão.
