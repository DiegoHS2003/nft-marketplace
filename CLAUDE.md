# Kurio - Teste técnico Jungle Gaming

Prazo: quinta, 15/10, 15h. O enunciado completo está em ENUNCIADO.md: consulte-o antes de cada etapa.

## Stack
React, TypeScript, Vite, TanStack Router (file-based) e Query, Axios, socket.io-client, Tailwind v4, shadcn/ui, MSW v2 (com @mswjs/socket.io-binding) e Playwright.

## Comandos
- npm run dev, npm run build, npm run test:e2e
- Ao criar um arquivo em src/routes, rode npm run dev por alguns segundos para gerar src/routeTree.gen.ts antes do build, e versione esse arquivo.

## Regras
- Os testes E2E existentes devem continuar passando. Rode build e test:e2e ao fim de cada etapa.
- Se mudar de propósito um texto usado por um teste, atualize o teste e avise.
- Nada de resposta fictícia em componentes, hooks ou no cliente Axios: dados simulados só no MSW (src/mocks).
- Valores em ETH sempre como string decimal (o mock compara com BigInt).
- Fidelidade ao Figma: prints em design/, paleta em design/paleta.txt, fonte Roboto Mono. Todo desvio vai para ARCHITECTURE.md.
- Acessibilidade: labels, foco visível, erros associados aos campos, prefers-reduced-motion.
- Uma etapa por vez, commit e push ao fim de cada uma. Se travar após 2 tentativas, pare e explique o bloqueio.
- Explique em linguagem simples o que mudou: o autor é júnior e vai defender este código.

## Decisões que não devem ser desfeitas
- socket.io-client é importado dinamicamente em src/lib/realtime.ts, depois do MSW ativar (o engine.io captura o WebSocket global no import).
- Socket.IO usa o path /realtime. Eventos: nft.updated e order.updated, com id, versão e deduplicação.
- Pedido: header Idempotency-Key e quoteId; a tela de pagamento guarda a cotação revisada.
- Carrinho: visitante identificado por X-Guest-Id e mesclado no login; o cache privado é limpo na troca de sessão.
- Cenários do mock: localStorage 'kurio:mock-scenario' (payment_refused, order_timeout); controles em window.__kurioMock.
