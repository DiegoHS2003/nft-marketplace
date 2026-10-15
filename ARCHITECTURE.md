# ARCHITECTURE.md

Decisões de arquitetura, limitações conhecidas e desvios em relação ao Figma. Atualizado a cada etapa.

Este documento tem duas partes: primeiro os **contratos e a arquitetura vigentes** (como o código funciona hoje), depois o **histórico por etapa** (o que mudou e por quê, incluindo desvios do Figma e o resultado do Lighthouse). Desvios de UX/Figma específicos de cada tela ficam só no histórico, pra não duplicar.

## Contratos e arquitetura

### Visão geral

Não existe backend real. Toda a API (REST e tempo real) é servida por MSW (`src/mocks/`) dentro do próprio navegador; o "banco" é `localStorage`. O cliente HTTP é um axios único (`src/lib/api.ts`) com `baseURL: '/api'`; o cliente de tempo real é o `socket.io-client`, consumido só em `src/lib/realtime.ts`.

### Contratos REST

Todas as rotas abaixo são handlers do MSW em `src/mocks/handlers.ts`, prefixadas por `/api`. O corpo de erro padrão (`ApiError`, `src/types/api.ts`) é `{ code, message, fields? }`; `fields` aparece nos 422 para associar a mensagem a um campo do formulário. A única resposta que desvia desse shape é o 409 `quote_changed` de `POST /orders`, que inclui também `cart` (ver "Idempotência de pedido").

**Sessão e conta**
- `POST /auth/register` — `{ name, email, password }` → 201 `{ user, token }`. 422 `validation_error` (campos `name`/`email`/`password`); 409 `email_taken` (campo `email`) se o e-mail (normalizado, trim+lowercase) já existe.
- `POST /auth/login` — `{ email, password }` → 200 `{ user, token }`. 401 `invalid_credentials` se não bate.
- `GET /auth/session` — sem corpo, lê `Authorization: Bearer <token>` → 200 `{ user }`. 401 `session_expired` se token ausente/inválido.
- `POST /auth/logout` — sempre 204, mesmo sem sessão válida.

**Perfil**
- `GET /profile` → 200 `User`. 401 `session_expired`.
- `PATCH /profile` — `{ name, email, avatar?: string | null }` → 200 `User`. 401; 422 `validation_error` (`name`/`email`); 409 `email_taken` se outro usuário já usa o e-mail; 422 em `avatar` se não for `data:image/...` ou passar de 200 KB. `avatar: null` remove o avatar; campo ausente não altera.
- `POST /profile/password` — `{ currentPassword, newPassword }` → 204. 401; 422 `validation_error` (`currentPassword` se não bate, `newPassword` se tiver menos de 8 caracteres). Só o hash da nova senha é persistido.

**NFTs**
- `GET /nfts` — query: `q`, `collection[]`, `network[]`, `minPrice`, `maxPrice` (strings decimais ETH), `tab` (`all|new|trending`, default `all`), `sort` (`recent|price_asc|price_desc`, default `recent`), `page` (default 1), `pageSize` (default 9, máx 24) → 200 `{ items, total, page, pageSize, totalPages }`. Sempre 200, mesmo resultado vazio.
- `GET /nfts/facets` — mesmos filtros (exceto paginação/ordenação) → 200 `{ collections: Record<slug,count>, networks: Record<network,count>, priceBounds: {min,max} }`. Contagem "self-excluding": a faceta de coleção ignora o filtro de coleção atual (mas aplica os outros), e vice-versa para rede; `priceBounds` é sempre sobre o catálogo inteiro, não filtrado.
- `GET /nfts/:id` → 200 `Nft`. 404 `not_found` se não existe.

**Favoritos** (por usuário, exige sessão)
- `GET /favorites` → 200 `string[]` (ids). 401 `session_expired`.
- `POST /favorites` — `{ nftId }` → 201 `string[]`. 401; 404 `not_found` se o NFT não existe; 500 `favorites_failed` se o cenário `favorites_fail` estiver ativo.
- `DELETE /favorites/:nftId` → 200 `string[]`. 401; 500 `favorites_failed` no mesmo cenário.

**Carrinho** — identidade por `u:<userId>` (autenticado) ou `g:<guestId>` (header `X-Guest-Id`); sem nenhum dos dois, 400 `missing_identity`.
- `GET /cart` → 200 `Cart` (`{ items: {nft, quantity}[], coupon, quoteId, subtotal, discount, networkFee, total }`).
- `POST /cart/items` — `{ nftId, quantity }` → 201 `Cart`. 404 `not_found`; 422 `validation_error` (quantidade não é inteiro ≥1); 409 `stock_conflict` se a soma com o que já está no carrinho passar de `editionsAvailable`.
- `PATCH /cart/items/:nftId` — `{ quantity }` → 200 `Cart`. 404 se item não está no carrinho; 422/409 iguais ao POST (aqui comparando a quantidade absoluta).
- `DELETE /cart/items/:nftId` → 200 `Cart` (idempotente — não erra se o item não existir).
- `POST /cart/coupon` — `{ code }` (normalizado para maiúsculas) → 200 `Cart` com `coupon: "KURIO10"`. 410 `coupon_expired` para o código `EXPIRADO`; 422 `coupon_invalid` para qualquer outro código que não seja `KURIO10`.
- `DELETE /cart/coupon` → 200 `Cart`, sempre sucesso.
- `POST /cart/merge` — `{ guestId }`, exige sessão → 200 `Cart` do usuário. Soma as quantidades do carrinho de visitante no carrinho do usuário, limitando ao estoque disponível; descarta linhas que ficariam com quantidade zero; apaga o carrinho de visitante.

**Carteiras** (por usuário, exige sessão) — não há `DELETE /wallets/:id`.
- `GET /wallets` → 200 `Wallet[]`.
- `POST /wallets` — `WalletInput { label, address, kind: 'primary'|'secondary', networks: Network[] }` → 201 `Wallet[]` (lista completa do usuário). 422 `validation_error` por campo (`label` vazio, `address` fora do padrão `/^[a-zA-Z0-9]{6,64}$/`, `kind` ausente, `networks` vazio ou com rede desconhecida); 409 `wallet_primary_conflict` (campo `kind`) se já existir uma `primary` e a nova também for.
- `PATCH /wallets/:id` — mesmo body → 200 `Wallet[]`. 404 `not_found` se o id não pertence ao usuário; mesmas validações 422/409 do POST.

**Pedidos** — ver "Idempotência de pedido" para o contrato completo de `POST /orders`.
- `GET /orders/:id` → 200 `Order`. 401 `session_expired`; 404 `not_found`; 403 `forbidden` se o pedido pertence a outro usuário. Toda consulta também resolve o pedido se já passou do tempo de confirmação simulado (rede de segurança caso o `setTimeout` original tenha se perdido, ex. reload).

### Eventos Socket.IO

Transporte: `@mswjs/socket.io-binding` sobre um handler de WebSocket do MSW (`ws.link('*/realtime/')`, `src/mocks/realtime.ts`). No cliente (`src/lib/realtime.ts`), a conexão usa `path: '/realtime'`, `transports: ['websocket']` e token na **query string** (`io({ query: { token } })`) — o binding do MSW não propaga o pacote de auth nativo do Socket.IO, então o "servidor" lê o token da URL da conexão.

Dois eventos, ambos `RealtimeEvent<T> = { id, resource: { type, id }, version, data }`:
- **`nft.updated`** — `data: { price, editionsAvailable }`. Emitido para **todas** as conexões (broadcast) sempre que um NFT muda de preço/estoque — por controle manual (`window.__kurioMock`), ou automaticamente quando um pedido é confirmado (decrementa `editionsAvailable`).
- **`order.updated`** — `data: { status, txHash, refusalReason }`. Emitido **só** para as conexões cujo `userId` (resolvido a partir do token) é o dono do pedido — nunca broadcast geral.

`id` é gerado sequencialmente por processo (`evt_<timestamp36>_<seq>`) e `version` é a versão do recurso (`Nft.version` / `Order.version`) no momento do envio.

**Dedupe e versão no cliente** (`src/lib/realtime.ts`):
- Um `Set<string>` de até 200 ids já vistos descarta duplicatas exatas (`isNew`).
- Para `nft.updated`, o cliente calcula a maior versão já conhecida daquele NFT entre `['nft', id]`, todas as listas `['nfts', ...]` em cache e os itens do `['cart']`; um evento com `version` menor ou igual é ignorado — nunca regride um estado mais novo que o próprio cliente já tem.
- Para `order.updated`, um pedido já em estado final (`status !== 'pending'`) ou um evento com versão menor/igual à já conhecida é ignorado — `confirmed`/`refused` são terminais e nunca são revertidos por um evento atrasado.

### Política de sessão

Token em `localStorage['kurio:token']`, lido pelo interceptor de requisição do axios (`src/lib/api.ts`) e enviado como `Authorization: Bearer <token>`. `src/lib/auth.ts` concentra o resto:

- **Recuperação após refresh**: `getCurrentUser(qc)` — usado no `beforeLoad` do layout protegido `/_auth` (`src/routes/_auth.tsx`) — só chama a API se houver token no localStorage; usa `qc.ensureQueryData` sobre a query `['session']` (`staleTime: 60s`, `retry: false`); se a API recusar, encerra a sessão e trata como visitante.
- **401 em qualquer chamada autenticada**: o interceptor de resposta do axios detecta `401` com `code: 'session_expired'` e aciona um handler registrado em `src/main.tsx`, que: ignora se já está em `/login`; monta `redirect = pathname + search`; encerra a sessão; dispara um evento (`kurio:session-expired`, com uma notificação em `sessionStorage` lida pela tela de login); navega para `/login?redirect=<rota atual>`. A rota de login só aceita `redirect` que comece com `/` e não `//`, para não virar um open redirect.
- **Expiração durante o checkout**: a tela de pagamento escuta esse mesmo evento e salva o formulário em edição (`sessionStorage['kurio:checkout-draft']`) antes do redirect; ao voltar depois do login, o rascunho é restaurado e descartado.
- **Logout / troca de usuário**: `endSession` remove o token, zera a query `['session']` e chama `clearPrivateCache`, que faz `resetQueries` em toda query cuja chave **não** esteja em `PUBLIC_KEYS = ['nfts', 'nft', 'session']` — isto é, `cart`, `favorites`, `wallets`, `profile`, `order` somem do cache. `startSession` (login/registro) faz a mesma limpeza **antes** de gravar o token novo, pra garantir que nada do visitante/usuário anterior vaze pro usuário que está entrando.
- **Visitante e guest id**: todo request leva `X-Guest-Id` (`src/lib/api.ts`), um UUID gerado uma vez e persistido em `localStorage['kurio:guest-id']` — não é limpo no logout (o carrinho de visitante da máquina continua existindo depois que alguém desloga). No login/registro, `POST /cart/merge` mescla o carrinho desse guest id no carrinho do usuário que acabou de entrar, e `['cart']` é invalidado.

### Estado do carrinho

O carrinho não guarda estado no cliente além do cache do TanStack Query — toda mutação (adicionar, alterar quantidade, remover, cupom) manda a operação para a API e recebe o `Cart` inteiro de volta. `quoteId` (ver "Idempotência de pedido") é recalculado no servidor a cada leitura, a partir do preço/versão atual de cada NFT, da quantidade de cada linha e do cupom — qualquer mudança em qualquer um desses três invalida a cotação.

Enquanto o carrinho está "aberto" (cacheado), eventos `nft.updated` atualizam preço/estoque do item diretamente no cache de `['nft', id]` e `['nfts', ...]`, e **sempre invalidam `['cart']`** — porque subtotal/desconto/taxa/total são derivados no servidor, não recalculados no cliente. Se o item afetado está no carrinho, aparece um aviso de que o resumo foi atualizado.

### Estratégia de cache do TanStack Query

Configuração global (`src/main.tsx`): `staleTime: 30_000`, `retry: 1`.

Principais `queryKey`s e particularidades:

| Key | Particularidade |
|---|---|
| `['session']` | `staleTime: 60_000`, `retry: false` — é a única query pública que sobrevive à limpeza de cache privado (ver sessão). |
| `['cart']` | Sem `staleTime` próprio; sempre reescrita via `setQueryData` depois de qualquer mutation do carrinho. |
| `['nfts', search]` / `['nfts', 'facets', search]` | A de facetas usa `placeholderData: keepPreviousData`, pra não mostrar a sidebar de filtros "pulando" enquanto troca de filtro/página. |
| `['nft', id]` | `retry` customizado: não insiste em 404. |
| `['favorites']` / `['wallets']` / `['profile']` | `enabled: !!user` — nunca disparam para visitante. |
| `['order', id]` | `refetchInterval`: 4000ms **só** enquanto `status === 'pending'`; para automaticamente ao confirmar/recusar. É a rede de segurança do pedido pendente — o socket é o caminho principal. |

**Optimistic update com rollback** (`onMutate` grava o estado anterior e aplica a mudança na hora; `onError` restaura; `onSettled` revalida):
- Alterar quantidade no carrinho (`useUpdateQuantity`, `src/api/cart.ts`).
- Favoritar/desfavoritar (`useToggleFavorite`, `src/api/favorites.ts`).

**Mutations sem optimistic**, que escrevem o resultado direto no cache (`setQueryData` no `onSuccess`, porque a API já devolve o recurso inteiro atualizado): adicionar/remover item do carrinho, aplicar/remover cupom, criar/atualizar carteira, atualizar perfil (este último escreve em `['profile']` **e** em `['session']`, pra manter nome/e-mail do cabeçalho sincronizados sem um segundo round-trip).

**Retry de rede específico**: `useCreateOrder` (`src/api/orders.ts`) repete automaticamente (até 2 vezes, 800ms de intervalo) somente se o erro for de rede (sem `response` do servidor) — nunca em erro HTTP respondido. Isso é o que permite ao cliente se recuperar de um "timeout" simulado (cenário `order_timeout`) reenviando a mesma `Idempotency-Key` em vez de duplicar o pedido.

### Reconciliação REST vs Socket.IO

- **Deduplicação**: por `id` do evento (buffer de até 200 ids vistos) e por `version` do recurso (nunca aplica um evento com versão menor ou igual à já conhecida — ver "Eventos Socket.IO").
- **Reconexão**: `connectRealtime` (`src/lib/realtime.ts`) marca a primeira conexão (`connectedBefore = false`); em qualquer conexão **subsequente** do mesmo socket (reconexão), invalida de uma vez `['cart']`, `['nfts']`, `['nft']` e `['order']` — reconcilia com a API REST tudo que pode ter mudado enquanto a conexão estava caída, sem depender de ter perdido ou não algum evento específico.
- **Polling de segurança**: só para pedido pendente (`refetchInterval: 4000ms` em `['order', id]`, descrito acima). Não há polling equivalente para carrinho/NFTs — a reconciliação deles depende da invalidação na reconexão.
- **Ciclo de vida / isolamento por sessão**: a conexão é aberta dentro de um `useEffect` com dependência em `user?.id` (`src/lib/useRealtime.ts`) — toda troca de usuário (login, logout, troca de conta) desmonta o socket antigo (que chama `socket.off()` + `socket.disconnect()`) e abre um novo com o token atual, recriando do zero o estado de dedupe (que é local à chamada, não persistido). Isso garante que eventos de uma sessão anterior não cheguem a atualizar dados do usuário seguinte — o socket do usuário anterior já está desconectado antes do novo abrir.

### Idempotência de pedido

`POST /orders` exige o header `Idempotency-Key` (ausente → 400 `missing_idempotency_key`) e o campo `quoteId` no corpo (`CreateOrderBody`).

- O servidor calcula um hash do corpo recebido (`payloadHash`) e procura um pedido existente do mesmo usuário com a mesma `Idempotency-Key`:
  - **Mesma chave, mesmo conteúdo** → não cria nada novo; resolve o pedido existente (se já passou do tempo de confirmação) e devolve o estado atual. Esse é o caminho de recuperação depois de um timeout ou de um clique duplicado.
  - **Mesma chave, conteúdo diferente** → 409 `idempotency_conflict`.
- Sem pedido prévio, valida carteira/rede/dados do colecionador (422 por campo), carrinho vazio (422 `empty_cart`), e **cotação**: se o `quoteId` enviado não bate com o `quoteId` atual do carrinho (preço, quantidade ou cupom mudaram desde que o cliente calculou), devolve **409** com um shape diferente do erro padrão — `{ code: 'quote_changed', message, cart }`, incluindo o carrinho atualizado — e estoque insuficiente no momento exato da criação (409 `stock_conflict`).
- Pedido criado fica `status: 'pending'` por 2,5s simulados (`confirmAt`), resolvido depois por um `setTimeout` no servidor mock para `confirmed` (decrementa estoque, versiona os NFTs afetados, remove as quantidades compradas do carrinho) ou `refused` (cenário `payment_refused`) — e emite `order.updated`.
- **Timeout simulado** (cenário `order_timeout`): o pedido é persistido e o settle é agendado normalmente, mas a resposta HTTP do `POST` é descartada (`HttpResponse.error()`) — simula a resposta se perdendo depois que o "servidor" já processou. O cliente trata isso como falha de rede e reenvia automaticamente com a mesma chave, cuja resposta então cai no ramo "mesma chave, mesmo conteúdo" acima.
- No lado do cliente (`src/routes/_auth/pagamento.tsx`), a chave é gerada a partir do conteúdo do pedido e guardada em `sessionStorage['kurio:checkout-attempt']` — reenviar o mesmo formulário (refresh, F5, nova tentativa) reutiliza a mesma chave em vez de gerar uma nova, o que é o que faz a recuperação funcionar sem duplicar.

> Nota de implementação: no handler atual, a verificação `if (scenario() === 'order_timeout') return HttpResponse.error()` aparece duplicada em duas linhas consecutivas (`src/mocks/handlers.ts`) — é código residual sem efeito funcional adicional (a segunda nunca é alcançada, porque a primeira já retorna), não dois comportamentos distintos. Fica registrado aqui como limpeza pendente, não como intenção de design.

### Limitações conhecidas

- **MSW como transporte do Socket.IO**: o binding (`@mswjs/socket.io-binding`) não implementa o handshake/ping nativo do Engine.IO, nem o pacote de autenticação do protocolo Socket.IO. Por isso: (1) o "servidor" mock envia manualmente um pacote de ping bruto (`"2"`) a cada 20s — sem isso o cliente derruba a conexão por inatividade; (2) o token vai na **query string** da conexão, lido diretamente da URL pelo handler, em vez de usar o mecanismo de auth do Socket.IO.
- **Sem broadcast entre abas/processos**: o "broadcast" de `nft.updated` é real entre todas as conexões WebSocket abertas dentro da mesma sessão de navegador (todas as abas do mesmo app, já que o MSW roda no mesmo processo do browser), mas não existe um servidor de fato — não há sincronização entre instâncias de navegadores diferentes ou deploys diferentes.
- **`localStorage` como banco**: todo o estado (NFTs, usuários, sessões, carrinhos, pedidos, favoritos, carteiras) é um array/Map serializado em `localStorage`. Isso é suficiente para demonstrar persistência entre refreshes numa única máquina/navegador, mas não isola dados entre dispositivos nem resiste a limpar o armazenamento do site.
- **Sem backend real**: `socket.io-client` é importado dinamicamente em `src/lib/realtime.ts`, depois que `enableMocking()` (em `src/main.tsx`) já ativou o MSW e só então a árvore React é montada — decisão deliberada para garantir que o Engine.IO capture o WebSocket global já substituído pelo mock. Isso também significa que a aplicação nunca funciona com `VITE_ENABLE_MOCKS=false` sem um backend real apontado em `baseURL`.
- **Sem checksum de endereço de carteira**: a validação de endereço de carteira é só de formato (`/^[a-zA-Z0-9]{6,64}$/`), sem verificação criptográfica real — consistente com o resto do mock, que simula a infraestrutura sem simular criptografia.
- **Sem `DELETE /wallets/:id`**: só existe cadastro e edição; remover uma carteira não é uma operação suportada pelo contrato atual.

## Histórico de decisões por etapa

### Etapa 1 — Início

#### Desvios do Figma

- **Breakpoint 768px sem frame no Figma.** O arquivo só tem frames para Desktop (1440) e Mobile (390). Para 768, a Início segue o mesmo padrão visual dos outros dois tamanhos (sidebar de filtros + grade de 2 colunas, como no mobile, mas com a sidebar sempre visível como no desktop), conforme o enunciado: "Estados não desenhados devem seguir o mesmo padrão visual".
- **Contagens da sidebar (coleções e redes) são calculadas de verdade**, via `GET /api/nfts/facets`, em vez de reproduzir os números fixos do mock do Figma (ex.: "Arte digital (33)"). Os números do Figma nem batem entre si (soma das coleções ≠ soma das redes), ou seja, são só preenchimento visual. Com 24 NFTs seedados, os números reais do catálogo são bem menores — isso é esperado e correto.
- **Coleção "Avatares" renomeada para "Assinaturas"** em `fixtures.ts` e `CatalogFilters.tsx`, para bater com a lista de coleções do Figma.
- **Carrossel do hero (3 slides).** O Figma mostra 3 pontinhos sob o hero, mas só documenta o texto de um slide por tamanho de tela (e os textos diferem entre o frame desktop e o mobile). Interpretei isso como 3 slides reais, usando os dois textos do Figma como slides 1 e 2 e escrevendo um terceiro no mesmo tom, para fechar a contagem de 3 pontos. Autoplay a cada 6s, pausado quando `prefers-reduced-motion: reduce` está ativo (o usuário passa a navegar só pelos pontinhos).
- **Busca responsiva.** O Figma mostra uma lupa que abre no header (desktop) e uma barra de busca sempre visível no topo da página (mobile). Implementei os dois: `Header.tsx` tem a lupa colapsável (md+), `routes/index.tsx` tem a barra fixa "Explorar coleções" + ícone de filtros (abaixo de `md`). Os dois alimentam o mesmo parâmetro `q` da URL.
- **Slider de preço.** Os dois campos numéricos de "Faixa de preço" viraram um slider de dois cursores (`@base-ui/react/slider`), com os limites vindos de `facets.priceBounds` (mínimo e máximo reais do catálogo). O valor só é aplicado ao clicar em "Aplicar", igual ao comportamento anterior dos campos.

#### Contrato novo

`GET /api/nfts/facets` — aceita os mesmos query params de `GET /api/nfts` (`q`, `tab`, `minPrice`, `maxPrice`, `collection[]`, `network[]`) e devolve:

```ts
{
  collections: Record<string, number>, // contagem por slug de coleção
  networks: Record<string, number>,    // contagem por rede
  priceBounds: { min: string, max: string } // ETH, limites globais do catálogo
}
```

Contagem "self-excluding": a contagem de coleções ignora o filtro de coleção atual (mas respeita rede/busca/preço/aba), e vice-versa para redes — é o padrão usual de filtro com contador ("se eu marcar isso, quantos itens aparecem").

#### Rota "fora do escopo"

Os itens de menu Mercado / Criadores / Aprenda eram `<span>` desabilitados. Agora são links reais para `/fora-do-escopo?secao=<nome>`, uma página simples que explica que a área não faz parte da entrega. Segue a regra do enunciado: "ações fora do escopo não devem aparentar sucesso funcional".

### Etapa 2 — Skeletons com shimmer

Sem desvios do Figma (o Figma não desenha estados de carregamento). Cenário novo no mock: `window.__kurioMock.setScenario('slow_network')` adiciona +3s nos GETs de `/nfts`, `/nfts/:id` e `/cart`, só para dar tempo de ver o skeleton em teste/demonstração.

### Etapa 3 — Login e Cadastro

#### Desvios do Figma

- **O modal de login/cadastro no desktop não mostra a Início desfocada atrás.** No Figma, o modal aparece sobre a página inicial. Como `/login` e `/cadastro` são rotas que substituem a tela inteira (o TanStack Router desmonta a rota anterior ao navegar, sem suporte nativo a "rotas paralelas"/background routes como o Next.js), manter a Início renderizada atrás exigiria uma arquitetura de roteamento bem mais complexa para um ganho só estético. O fundo do modal é um overlay escuro sólido (`bg-black/70`), na mesma paleta do app.
- **Abas "Entrar | Criar conta" fazem navegação real** entre `/login` e `/cadastro` (não só trocam um estado local), para que o parâmetro `?redirect=` seja sempre preservado nos dois sentidos — é o mesmo link usado no rodapé da versão mobile ("Novo na Kurio? Crie uma conta" / "Já tem uma conta? Entre").
- **"Esqueceu a senha?" e os botões "Continuar com Google/Facebook"** ficam desabilitados (`disabled`, `aria-disabled`, `title="Fora do escopo do desafio"`), com uma frase abaixo explicando isso — eles aparecem no Figma mas não têm comportamento especificado no enunciado.
- **Mostrar/ocultar senha**: adicionei o ícone de olho dos dois campos de senha (login e cadastro), que o Figma já mostrava mas o código anterior não implementava.

#### Bug real encontrado e corrigido (não é desvio de design, é correção)

Usuários cadastrados por `POST /api/auth/register` só existiam na memória da aba — um refresh ou navegação de página inteira apagava o usuário (o `db.users` do mock recarregava só os 2 usuários semente). Isso quebrava a exigência do enunciado de que "a sessão deve ser recuperável após refresh" especificamente para quem acabou de se cadastrar. Corrigido em `src/mocks/db.ts`: novos usuários agora são salvos em `localStorage` (`kurio:mock-users`), igual a carrinhos/pedidos/sessões, e `resetDb()` limpa essa chave também.

#### Diálogo acessível

O modal usa `@base-ui/react/dialog` (foco preso automaticamente, `role="dialog"`, `aria-modal="true"`, título associado via `aria-labelledby`, Esc fecha). Dois cuidados extras:
- **Fechar com Esc/X não pode cair numa aba em branco.** `window.history.length` conta a entrada inicial em branco do navegador, então não dá pra usar como sinal de "existe uma página anterior de verdade". Criado um contador próprio (`src/lib/navigationHistory.ts`) que conta quantas localizações o roteador já resolveu nesta sessão; só volta no histórico se houver mais de uma, senão manda pra Início.
- **Foco volta pro elemento que abriu o diálogo** de graça, porque o Header (com o link "Entrar") fica montado durante toda a navegação (vive no layout raiz, fora do `<Outlet/>`) — o Base UI Dialog restaura o foco pro último elemento focado antes de abrir, que já é esse link.

### Etapa 4 — Detalhe, carrinho, pagamento, confirmação e favoritos

#### Desvios do Figma

- ~~Galeria do detalhe tem uma imagem só.~~ **Corrigido na Etapa 7**: o contrato de `Nft` ganhou `images: string[]`, ver lá.
- **Sem nota/avaliações ("★★★★★ 19 avaliações").** Não existe esse campo no contrato de `Nft` nem no enunciado — não inventei número.
- **Sem "Mais desta coleção" e sem abas "Detalhes/Avaliações" no detalhe.** Não fazem parte das funcionalidades obrigatórias do enunciado para essa tela (galeria, informações, edição, quantidade, favoritos, compra); ficaram de fora para não alterar lógica/escopo nesta etapa, que era pra ser só visual.
- **Pagamento (desktop) não tem o formulário extenso de perfil do Figma** (nome de usuário, código de indicação, ENS etc.) nem a lista de carteiras em rádio. Na Etapa 7 o layout foi refeito pra bater com a grade de 2 colunas do Figma (rótulos, asteriscos, placeholders "Selecione uma carteira"/"Selecione uma rede", textarea "Observação do colecionador") e ganhou o campo de observação de verdade (`collector.note`, opcional, vai pro pedido via `POST /api/orders`) — mas os campos sem contrato por trás (nome de usuário, nome do perfil, ENS, código de indicação) continuam fora: inventá-los sem um endpoint que os valide/persista seria dado fictício na UI. A lista de carteiras em rádio também não entrou: o Figma mobile mostra uma tela de "conectar carteira" totalmente diferente (MetaMask/WalletConnect/Coinbase, trocar carteira), que é uma funcionalidade nova (simulação de provedor de carteira), não um reposicionamento visual — e trocar os `<select>` por rádios quebraria `getByLabel('Carteira').selectOption(...)` dos testes existentes sem ganho correspondente nesta etapa, que é de fidelidade visual.
- **Botão "Ir para pagamento" (carrinho) não foi renomeado para "Conectar e finalizar" (Figma).** O clique aqui só navega pra tela de pagamento — conectar carteira continua acontecendo na tela seguinte. Trocar o texto sem trocar o comportamento ia descrever uma ação que ainda não acontece, e esse texto é usado em teste (`checkout.spec.ts`); mantive.
- **Confirmação de pedido não tem frame mobile no Figma** (só Desktop 1440). Adaptei empilhando a grade de metadados (ID da transação/Data/Total/Carteira) de 4 para 2 colunas abaixo de `sm`, mesmo cartão centralizado nos três tamanhos.
- **"Ver no Etherscan" é só decorativo** (`disabled`, `aria-disabled`, `title`), no mesmo padrão já usado em "Esqueceu a senha?" — o enunciado diz que "links de exploração são simulados", e simular um link clicável pra lugar nenhum pareceria sucesso funcional falso.

#### Quantidade no detalhe do NFT

O enunciado pede quantidade como funcionalidade obrigatória do detalhe, e o endpoint `POST /api/cart/items` já aceita e valida `quantity` (contra `editionsAvailable`) desde a etapa de carrinho — só a interface não deixava escolher. Adicionei um stepper (− / +) que limita entre 1 e `editionsAvailable` e passa esse valor pro `add.mutate` que já existia. Não criei contrato novo nem mudei o handler do mock, só completei a ligação entre uma interação do Figma e uma capacidade que a API já tinha.

#### Favoritos

- Novos endpoints no mock: `GET/POST /api/favorites` e `DELETE /api/favorites/:nftId`, por usuário (`db.favorites: Map<userId, nftId[]>`), persistidos em `localStorage` (`kurio:mock-favorites`) e limpos por `resetDb()`/`__kurioMock.reset()`.
- A consulta `['favorites']` não está na lista `PUBLIC_KEYS` de `src/lib/auth.ts`, então já é tratada como cache privado e some na troca de sessão/logout sem precisar de nenhuma mudança ali.
- Só autenticado favorita: o coração do visitante manda pro login (`/login?redirect=/nfts/:id`) e o próprio redirect devolve pro detalhe depois de entrar.
- Atualização otimista com rollback: o coração muda na hora, e se a API recusar (cenário `favorites_fail` em `kurio:mock-scenario`, mesmo padrão dos outros cenários) o estado volta e aparece um aviso `role="alert"`.
- Dois botões de favoritar no DOM (ícone circular sobre a imagem no mobile, botão com texto ao lado de "Comprar" no desktop) — só um fica visível por vez via classes `md:hidden`/`hidden md:inline-flex`, igual ao padrão que já existia na busca do Header/Início.

### Etapa 5 — Perfil e carteiras

#### Nomes dos prints do Figma

Os prints indicados no enunciado (`design/perfil-desktop.png` e `design/carteiras-desktop.png`) não existem com esse nome no repositório — os arquivos em `design/` são só capturas de tela sequenciais (`Captura de Tela ... .png`). Identifiquei os frames corretos pelo rótulo "Desktop / ..." dentro de cada imagem: "Desktop / Perfil do Colecionador" (13.56.09) e "Desktop / Carteiras" (13.56.51).

#### Desvios do Figma

- **Perfil só tem Nome de exibição e E-mail como campos editáveis.** O Figma desenha também "Nome de usuário", "Nome ENS" e "Apelido da carteira" dentro do formulário de perfil, mas o enunciado desta etapa define o contrato como "GET e PATCH /api/profile (nome e e-mail...)" — sem esses três campos. Inventá-los na tela sem endpoint por trás seria dado fictício na UI (regra do projeto). Mesmo padrão já registrado na Etapa 4 para a tela de Pagamento, que tem o mesmo vazamento de campos sem contrato.
- **Dois botões de salvar, não um.** No Figma, "Dados do perfil" e "Alterar senha" dividem a mesma tela com um único botão "Salvar" no fim. Como são duas mutations diferentes (`PATCH /api/profile` e `POST /api/profile/password`), cada uma com seus próprios erros de campo, separei em dois formulários com dois submits independentes — assim um erro de senha não bloqueia salvar nome/e-mail e vice-versa, e cada mensagem de erro fica associada ao campo certo.
- **Barra lateral "Meu perfil": só "Dados do perfil" e "Carteiras" têm comportamento real.** "Atividade", "Lista de interesse", "Ofertas", "Arquivos baixados" e "Suporte" não fazem parte do escopo da entrega (mesma lista de páginas excluídas do enunciado, seção 3) — viram links reais para `/fora-do-escopo`, igual ao tratamento que "Mercado/Criadores/Aprenda" já recebem no Header (Etapa 1).
- **"Sair" não foi duplicado na barra lateral.** O Figma mostra "Sair" no menu do perfil, mas o Header já tem um botão "Sair" (usado por `tests/e2e/auth.spec.ts`). Repetir o mesmo texto em dois controles da mesma página deixaria `getByRole('button', { name: 'Sair' })` ambíguo nos testes; a ação de logout já existe e funciona a partir do Header em qualquer tela.
- **Formulário de carteira tem só Apelido, Endereço e Rede(s).** O Figma mistura campos de perfil (nome de exibição, nome do perfil, e-mail, ENS, código de indicação) dentro do formulário de carteira — o mesmo vazamento de campos sem contrato já visto no formulário de Pagamento. Implementei só o que o `Wallet` do contrato tem: `label`, `address`, `kind`, `networks`.
- **Sem campo "Tipo de carteira" (select).** A página já separa fisicamente "Carteira principal" de "Carteira secundária" em duas seções (como o Figma desenha), então o tipo já está implícito em qual formulário o usuário preenche — um select redundante só duplicaria essa escolha.
- **Rede vira caixas de seleção (múltipla), não um único select.** `Wallet.networks` já é uma lista (uma carteira pode valer para mais de uma rede — é assim que a tela de Pagamento filtra as opções de rede disponíveis para a carteira escolhida); um `<select>` de valor único quebraria isso.
- **Validação de endereço é só de formato** (alfanumérico, 6 a 64 caracteres), sem checksum de blockchain de verdade — consistente com o resto do mock, que simula a infraestrutura sem validar criptografia real.
- **Sem frame mobile para Perfil/Carteiras no Figma** (só Desktop). A barra lateral vira uma lista horizontal com rolagem abaixo de `md`, testada em 390px.

#### Contratos novos

`GET/PATCH /api/profile` — `PATCH` recebe `{ name, email, avatar? }`; valida nome e e-mail (422 por campo) e e-mail duplicado de outro usuário (409, campo `email`). Avatar é opcional: `string` (data URL, até 200 KB, 422 se maior ou formato inválido) ou `null` para remover.

`POST /api/profile/password` — recebe `{ currentPassword, newPassword }`; 422 por campo se a senha atual não bate ou a nova tem menos de 8 caracteres. Só a hash da nova senha é persistida.

`POST/PATCH /api/wallets[/:id]` — recebem `{ label, address, kind, networks }`; 422 por campo (apelido vazio, endereço inválido, rede vazia) e 409 (`wallet_primary_conflict`) se tentar ter duas carteiras `principal` ao mesmo tempo. Devolvem a lista completa de carteiras do usuário (mesmo formato do `GET`), para o cliente atualizar o cache com `setQueryData` direto, sem round-trip extra — mesmo padrão já usado em `/api/favorites` e `/api/cart/*`.

Carteiras agora persistem em `localStorage` (`kurio:mock-wallets`), igual a NFTs/usuários/favoritos, e são limpas por `resetDb()`/`__kurioMock.reset()`.

### Etapa 6 — Scripts, Lighthouse e regressão visual

Sem desvios do Figma: nada visual mudou nesta etapa.

#### Scripts

`typecheck` (`tsc -b --noEmit`) e `lighthouse` (`node lighthouse/run.mjs`) foram adicionados ao `package.json`. O lint continua com `oxlint` (já estava configurado e passando, exit 0); só foram limpos os warnings baratos de `unused-vars` em `src/mocks/handlers.ts` (variáveis de destructuring usadas só pra omitir campos, prefixadas com `_`).

### Etapa 7 — Fidelidade ao Figma e acessibilidade

Passo de revisão visual (sem novas telas): comparação de cada rota com os prints de `design/` em 1440/768/390 e correção das diferenças, em ordem de impacto.

#### Galeria do detalhe (contrato novo)

`Nft` ganhou `images: string[]` (4 imagens, geradas em `fixtures.ts` a partir dos mesmos 4 PNGs de `public/nfts/` já usados no catálogo — dado real do mock, não inventado no componente; `image` continua existindo e é sempre igual a `images[0]`, pra não quebrar quem já lia só `image`). `nfts.$id.tsx` ganhou a coluna de miniaturas clicáveis (`role="tablist"`/`role="tab"`, `aria-selected`) à esquerda da imagem grande, só em `md+` — no mobile o Figma não desenha miniaturas (só a imagem única), então o comportamento anterior foi mantido abaixo de `md`.

#### Pagamento

Ver o desvio atualizado na Etapa 4: layout em grade de 2 colunas, rótulos/placeholders iguais ao Figma, campo de observação novo. `CreateOrderBody.collector` ganhou `note?: string` (opcional). O rótulo do campo de nome mudou de "Nome do colecionador" para "Nome de exibição" (texto do Figma) — `tests/e2e/helpers.ts` (`fillCheckout`) e `tests/e2e/session-expired.spec.ts` foram atualizados para o novo rótulo.

#### Modal de login/cadastro (desktop)

O Figma mostra o modal com o fundo desfocado. Como `/login` e `/cadastro` continuam sendo rotas que substituem a tela inteira (ver Etapa 3 — manter a Início de verdade montada atrás exigiria rotas paralelas, que o TanStack Router não suporta nativamente), o `Dialog.Backdrop` passou a mostrar uma imagem real do catálogo (`/nfts/macaco-1.png`) desfocada (`blur-xl`) sob um overlay escuro, no lugar do preto sólido anterior — reproduz o efeito visual do Figma sem fingir que a Início funcional ainda está ali. Documentado também no componente (`AuthScreen.tsx`).

#### Responsivo (1440/768/390), sem overflow horizontal

Causa raiz comum a dois bugs de overflow encontrados (detalhe do NFT e carrinho, ambos em 768): colunas de grid definidas como `1fr` usam `minmax(auto, 1fr)` por padrão, então o track não encolhe abaixo do conteúdo mínimo dos filhos — um texto longo ou uma linha de botões "empurra" a página inteira e aparece scroll horizontal. Corrigido com `minmax(0,1fr)` nas grades de 2 colunas (`nfts.$id.tsx`, `carrinho.tsx`, `pagamento.tsx`) e `min-w-0` nos itens de grid/flex que contêm texto truncável. No carrinho, a lista de itens (preço/edições/total em colunas fixas lado a lado) agora só vira "tabela" a partir de `lg` (1024px) — em 768 continua no layout empilhado que já existia para mobile, que é o que cabe sem cortar conteúdo. No detalhe, a linha "Adicionar ao carrinho" + "Favoritar" ganhou `flex-wrap` pelo mesmo motivo. Checado programaticamente (`document.documentElement.scrollWidth <= clientWidth`) nas 7 telas × 3 larguras — sem overflow restante.

Barra lateral "Meu perfil" (`AccountSidebar.tsx`) ganhou os ícones por item que o Figma desenha (pessoa, pino, sacola, coração, etiqueta, download, alerta) e o indicador de item ativo virou uma barra à esquerda, como no Figma, em vez de só um fundo mais claro.

#### Acessibilidade

`@axe-core/playwright` entrou como dependência de teste. `tests/e2e/accessibility.spec.ts` roda `axe` (regras `wcag2a`+`wcag2aa`) em início, detalhe, carrinho, pagamento, modal de login, perfil e carteiras, em desktop e mobile, falhando o teste se aparecer qualquer violação `serious`/`critical`. Rodando, isso pegou um problema real: os `<select>` de Carteira/Rede em `pagamento.tsx` usavam `text-kurio-text-secondary/60` pro estado "vazio" (placeholder visual), o que cai pra contraste 4.03:1 contra o fundo — abaixo do mínimo 4.5:1 do WCAG AA. Trocado para `text-kurio-text-secondary` (sem opacidade reduzida), que já é usado em rótulos no resto do app e passa no teste.

O resto dos requisitos de acessibilidade (foco preso e Esc nos diálogos, labels e erros associados, `aria-live` em avisos de tempo real/otimistas, alt em imagens relevantes) já vinha das etapas anteriores (Base UI `Dialog`, padrão de `role="alert"`/`role="status"` em toda mutation) e continua coberto pelos testes existentes (`cadastro.spec.ts` tem o teste de foco preso/Esc do diálogo).

#### Lighthouse

Config versionada em `lighthouse/config.mjs`, script em `lighthouse/run.mjs`: builda + `vite preview` na porta 4173 (ou reusa um servidor já no ar), roda Início e Detalhe, em mobile e desktop, 3 execuções cada, calcula mediana de Performance/Accessibility/Best Practices/SEO/LCP/CLS/TBT. Relatórios em `lighthouse/reports/` (`summary.md` tem a tabela e o ambiente).

Correções aplicadas depois da primeira rodada (todas sem mudar comportamento ou visual):
- `index.html`: `lang="en"` → `lang="pt-BR"` (a UI é em português), `<meta name="description">` e `<title>` ausentes.
- `public/robots.txt`: não existia; sem ele, o servidor cai no fallback de SPA e devolve `index.html` como `robots.txt`, que é inválido e penalizava SEO.
- `CatalogFilters.tsx`: heading "Faixa de preço" era `<h3>` sem nenhum `<h2>` antes dele na página (pulava nível) — virou `<h2>`. O Tailwind reseta o tamanho de heading por padrão, então não muda nada visualmente.
- `HeroCarousel.tsx`: os pontinhos do carrossel (8×8px, do Figma) tinham a área clicável do mesmo tamanho — abaixo dos 24×24px mínimos de acessibilidade. A área de toque virou 24×24px (um `<span>` de 8px centralizado dentro do botão maior e invisível); o ponto visível não muda de tamanho.
- `fetchPriority="high"` na imagem principal da Início (hero) e do Detalhe — é o elemento de LCP das duas páginas, e o Lighthouse sinalizava que faltava essa dica.
- `loading="lazy"` nas imagens que não aparecem na primeira dobra (grade do catálogo, itens do carrinho, itens do recibo do pedido).

Resultado final: Accessibility, Best Practices e SEO em 100 nas 4 combinações (página × perfil); Performance 100/99/90 em desktop×2 e início mobile, e **89 no Detalhe do NFT em mobile** (meta: 90), estável nas 3 execuções.

Causa real do 89 (documentada também em `lighthouse/config.mjs`, campo `knownCauses`, e repetida em todo `summary.md` que acusar essa falha): o LCP (~3,3s) e o FCP (~2,4s) dominam o score e têm três causas de arquitetura, não de "imagem grande" ou coisa fácil de trocar:
1. o perfil mobile do Lighthouse usa throttling padrão (CPU e rede simuladas mais lentas) — é a condição de laboratório pedida pelo enunciado, não foi afrouxada;
2. é uma SPA sem SSR: a `<img>` do NFT só existe no DOM depois que o React monta e a API mockada responde, então o navegador não consegue descobrir essa imagem a partir do HTML inicial (o próprio Lighthouse marca isso no audit `lcp-discovery-insight`);
3. `src/main.tsx` só chama `createRoot().render()` depois que o MSW termina de ativar (decisão já tomada em etapas anteriores, pra garantir que nenhuma chamada real escape sem mock) e o bundle do MSW (~167 KB gzip) carrega nesse caminho crítico, porque o enunciado exige mocks ativos no build de demonstração.

Nenhuma dessas três é uma correção "barata": a primeira é a própria regra da auditoria, a segunda exigiria SSR (fora da stack obrigatória do desafio) e a terceira entra em conflito direto com a regra de não deixar nenhuma chamada real escapar sem mock. Por isso ficou documentado como causa real em vez de mascarado.

#### Regressão visual

`tests/e2e/visual.spec.ts`: Início, Detalhe, Carrinho e Pagamento, em `desktop` e `mobile` (8 baselines). Determinístico porque cada teste do Playwright já roda num contexto novo (localStorage vazio → mock sempre no cenário semente) e `prefers-reduced-motion` desliga o autoplay do carrossel. Detalhes de como atualizar os baselines estão em `tests/e2e/README.md`.
