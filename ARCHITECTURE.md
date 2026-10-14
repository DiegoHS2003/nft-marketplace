# ARCHITECTURE.md

Decisões de arquitetura, limitações conhecidas e desvios em relação ao Figma. Atualizado a cada etapa.

## Etapa 1 — Início

### Desvios do Figma

- **Breakpoint 768px sem frame no Figma.** O arquivo só tem frames para Desktop (1440) e Mobile (390). Para 768, a Início segue o mesmo padrão visual dos outros dois tamanhos (sidebar de filtros + grade de 2 colunas, como no mobile, mas com a sidebar sempre visível como no desktop), conforme o enunciado: "Estados não desenhados devem seguir o mesmo padrão visual".
- **Contagens da sidebar (coleções e redes) são calculadas de verdade**, via `GET /api/nfts/facets`, em vez de reproduzir os números fixos do mock do Figma (ex.: "Arte digital (33)"). Os números do Figma nem batem entre si (soma das coleções ≠ soma das redes), ou seja, são só preenchimento visual. Com 24 NFTs seedados, os números reais do catálogo são bem menores — isso é esperado e correto.
- **Coleção "Avatares" renomeada para "Assinaturas"** em `fixtures.ts` e `CatalogFilters.tsx`, para bater com a lista de coleções do Figma.
- **Carrossel do hero (3 slides).** O Figma mostra 3 pontinhos sob o hero, mas só documenta o texto de um slide por tamanho de tela (e os textos diferem entre o frame desktop e o mobile). Interpretei isso como 3 slides reais, usando os dois textos do Figma como slides 1 e 2 e escrevendo um terceiro no mesmo tom, para fechar a contagem de 3 pontos. Autoplay a cada 6s, pausado quando `prefers-reduced-motion: reduce` está ativo (o usuário passa a navegar só pelos pontinhos).
- **Busca responsiva.** O Figma mostra uma lupa que abre no header (desktop) e uma barra de busca sempre visível no topo da página (mobile). Implementei os dois: `Header.tsx` tem a lupa colapsável (md+), `routes/index.tsx` tem a barra fixa "Explorar coleções" + ícone de filtros (abaixo de `md`). Os dois alimentam o mesmo parâmetro `q` da URL.
- **Slider de preço.** Os dois campos numéricos de "Faixa de preço" viraram um slider de dois cursores (`@base-ui/react/slider`), com os limites vindos de `facets.priceBounds` (mínimo e máximo reais do catálogo). O valor só é aplicado ao clicar em "Aplicar", igual ao comportamento anterior dos campos.

### Contrato novo

`GET /api/nfts/facets` — aceita os mesmos query params de `GET /api/nfts` (`q`, `tab`, `minPrice`, `maxPrice`, `collection[]`, `network[]`) e devolve:

```ts
{
  collections: Record<string, number>, // contagem por slug de coleção
  networks: Record<string, number>,    // contagem por rede
  priceBounds: { min: string, max: string } // ETH, limites globais do catálogo
}
```

Contagem "self-excluding": a contagem de coleções ignora o filtro de coleção atual (mas respeita rede/busca/preço/aba), e vice-versa para redes — é o padrão usual de filtro com contador ("se eu marcar isso, quantos itens aparecem").

### Rota "fora do escopo"

Os itens de menu Mercado / Criadores / Aprenda eram `<span>` desabilitados. Agora são links reais para `/fora-do-escopo?secao=<nome>`, uma página simples que explica que a área não faz parte da entrega. Segue a regra do enunciado: "ações fora do escopo não devem aparentar sucesso funcional".

## Etapa 2 — Skeletons com shimmer

Sem desvios do Figma (o Figma não desenha estados de carregamento). Cenário novo no mock: `window.__kurioMock.setScenario('slow_network')` adiciona +3s nos GETs de `/nfts`, `/nfts/:id` e `/cart`, só para dar tempo de ver o skeleton em teste/demonstração.

## Etapa 3 — Login e Cadastro

### Desvios do Figma

- **O modal de login/cadastro no desktop não mostra a Início desfocada atrás.** No Figma, o modal aparece sobre a página inicial. Como `/login` e `/cadastro` são rotas que substituem a tela inteira (o TanStack Router desmonta a rota anterior ao navegar, sem suporte nativo a "rotas paralelas"/background routes como o Next.js), manter a Início renderizada atrás exigiria uma arquitetura de roteamento bem mais complexa para um ganho só estético. O fundo do modal é um overlay escuro sólido (`bg-black/70`), na mesma paleta do app.
- **Abas "Entrar | Criar conta" fazem navegação real** entre `/login` e `/cadastro` (não só trocam um estado local), para que o parâmetro `?redirect=` seja sempre preservado nos dois sentidos — é o mesmo link usado no rodapé da versão mobile ("Novo na Kurio? Crie uma conta" / "Já tem uma conta? Entre").
- **"Esqueceu a senha?" e os botões "Continuar com Google/Facebook"** ficam desabilitados (`disabled`, `aria-disabled`, `title="Fora do escopo do desafio"`), com uma frase abaixo explicando isso — eles aparecem no Figma mas não têm comportamento especificado no enunciado.
- **Mostrar/ocultar senha**: adicionei o ícone de olho dos dois campos de senha (login e cadastro), que o Figma já mostrava mas o código anterior não implementava.

### Bug real encontrado e corrigido (não é desvio de design, é correção)

Usuários cadastrados por `POST /api/auth/register` só existiam na memória da aba — um refresh ou navegação de página inteira apagava o usuário (o `db.users` do mock recarregava só os 2 usuários semente). Isso quebrava a exigência do enunciado de que "a sessão deve ser recuperável após refresh" especificamente para quem acabou de se cadastrar. Corrigido em `src/mocks/db.ts`: novos usuários agora são salvos em `localStorage` (`kurio:mock-users`), igual a carrinhos/pedidos/sessões, e `resetDb()` limpa essa chave também.

### Diálogo acessível

O modal usa `@base-ui/react/dialog` (foco preso automaticamente, `role="dialog"`, `aria-modal="true"`, título associado via `aria-labelledby`, Esc fecha). Dois cuidados extras:
- **Fechar com Esc/X não pode cair numa aba em branco.** `window.history.length` conta a entrada inicial em branco do navegador, então não dá pra usar como sinal de "existe uma página anterior de verdade". Criado um contador próprio (`src/lib/navigationHistory.ts`) que conta quantas localizações o roteador já resolveu nesta sessão; só volta no histórico se houver mais de uma, senão manda pra Início.
- **Foco volta pro elemento que abriu o diálogo** de graça, porque o Header (com o link "Entrar") fica montado durante toda a navegação (vive no layout raiz, fora do `<Outlet/>`) — o Base UI Dialog restaura o foco pro último elemento focado antes de abrir, que já é esse link.

## Etapa 4 — Detalhe, carrinho, pagamento, confirmação e favoritos

### Desvios do Figma

- **Galeria do detalhe tem uma imagem só.** O Figma mostra 4 miniaturas + imagem grande, mas o contrato de `Nft` só tem um campo `image`. Reaproveitar a mesma imagem em miniaturas fictícias seria dado fictício na UI (proibido pela regra do projeto); fica só a imagem grande.
- **Sem nota/avaliações ("★★★★★ 19 avaliações").** Não existe esse campo no contrato de `Nft` nem no enunciado — não inventei número.
- **Sem "Mais desta coleção" e sem abas "Detalhes/Avaliações" no detalhe.** Não fazem parte das funcionalidades obrigatórias do enunciado para essa tela (galeria, informações, edição, quantidade, favoritos, compra); ficaram de fora para não alterar lógica/escopo nesta etapa, que era pra ser só visual.
- **Pagamento (desktop) não tem o formulário extenso de perfil do Figma** (nome de usuário, código de indicação, ENS etc.) nem a lista de carteiras em rádio. O formulário atual usa exatamente os campos que a API já valida (nome, e-mail, carteira, rede) — criar campos novos sem contrato por trás seria dado fictício, e trocar os `<select>` por uma lista de rádios quebraria `getByLabel('Carteira').selectOption(...)` dos testes existentes. Os `<select>` ficaram, só com visual novo.
- **Botão "Ir para pagamento" (carrinho) não foi renomeado para "Conectar e finalizar" (Figma).** O clique aqui só navega pra tela de pagamento — conectar carteira continua acontecendo na tela seguinte. Trocar o texto sem trocar o comportamento ia descrever uma ação que ainda não acontece, e esse texto é usado em teste (`checkout.spec.ts`); mantive.
- **Confirmação de pedido não tem frame mobile no Figma** (só Desktop 1440). Adaptei empilhando a grade de metadados (ID da transação/Data/Total/Carteira) de 4 para 2 colunas abaixo de `sm`, mesmo cartão centralizado nos três tamanhos.
- **"Ver no Etherscan" é só decorativo** (`disabled`, `aria-disabled`, `title`), no mesmo padrão já usado em "Esqueceu a senha?" — o enunciado diz que "links de exploração são simulados", e simular um link clicável pra lugar nenhum pareceria sucesso funcional falso.

### Quantidade no detalhe do NFT

O enunciado pede quantidade como funcionalidade obrigatória do detalhe, e o endpoint `POST /api/cart/items` já aceita e valida `quantity` (contra `editionsAvailable`) desde a etapa de carrinho — só a interface não deixava escolher. Adicionei um stepper (− / +) que limita entre 1 e `editionsAvailable` e passa esse valor pro `add.mutate` que já existia. Não criei contrato novo nem mudei o handler do mock, só completei a ligação entre uma interação do Figma e uma capacidade que a API já tinha.

### Favoritos

- Novos endpoints no mock: `GET/POST /api/favorites` e `DELETE /api/favorites/:nftId`, por usuário (`db.favorites: Map<userId, nftId[]>`), persistidos em `localStorage` (`kurio:mock-favorites`) e limpos por `resetDb()`/`__kurioMock.reset()`.
- A consulta `['favorites']` não está na lista `PUBLIC_KEYS` de `src/lib/auth.ts`, então já é tratada como cache privado e some na troca de sessão/logout sem precisar de nenhuma mudança ali.
- Só autenticado favorita: o coração do visitante manda pro login (`/login?redirect=/nfts/:id`) e o próprio redirect devolve pro detalhe depois de entrar.
- Atualização otimista com rollback: o coração muda na hora, e se a API recusar (cenário `favorites_fail` em `kurio:mock-scenario`, mesmo padrão dos outros cenários) o estado volta e aparece um aviso `role="alert"`.
- Dois botões de favoritar no DOM (ícone circular sobre a imagem no mobile, botão com texto ao lado de "Comprar" no desktop) — só um fica visível por vez via classes `md:hidden`/`hidden md:inline-flex`, igual ao padrão que já existia na busca do Header/Início.

## Etapa 5 — Perfil e carteiras

### Nomes dos prints do Figma

Os prints indicados no enunciado (`design/perfil-desktop.png` e `design/carteiras-desktop.png`) não existem com esse nome no repositório — os arquivos em `design/` são só capturas de tela sequenciais (`Captura de Tela ... .png`). Identifiquei os frames corretos pelo rótulo "Desktop / ..." dentro de cada imagem: "Desktop / Perfil do Colecionador" (13.56.09) e "Desktop / Carteiras" (13.56.51).

### Desvios do Figma

- **Perfil só tem Nome de exibição e E-mail como campos editáveis.** O Figma desenha também "Nome de usuário", "Nome ENS" e "Apelido da carteira" dentro do formulário de perfil, mas o enunciado desta etapa define o contrato como "GET e PATCH /api/profile (nome e e-mail...)" — sem esses três campos. Inventá-los na tela sem endpoint por trás seria dado fictício na UI (regra do projeto). Mesmo padrão já registrado na Etapa 4 para a tela de Pagamento, que tem o mesmo vazamento de campos sem contrato.
- **Dois botões de salvar, não um.** No Figma, "Dados do perfil" e "Alterar senha" dividem a mesma tela com um único botão "Salvar" no fim. Como são duas mutations diferentes (`PATCH /api/profile` e `POST /api/profile/password`), cada uma com seus próprios erros de campo, separei em dois formulários com dois submits independentes — assim um erro de senha não bloqueia salvar nome/e-mail e vice-versa, e cada mensagem de erro fica associada ao campo certo.
- **Barra lateral "Meu perfil": só "Dados do perfil" e "Carteiras" têm comportamento real.** "Atividade", "Lista de interesse", "Ofertas", "Arquivos baixados" e "Suporte" não fazem parte do escopo da entrega (mesma lista de páginas excluídas do enunciado, seção 3) — viram links reais para `/fora-do-escopo`, igual ao tratamento que "Mercado/Criadores/Aprenda" já recebem no Header (Etapa 1).
- **"Sair" não foi duplicado na barra lateral.** O Figma mostra "Sair" no menu do perfil, mas o Header já tem um botão "Sair" (usado por `tests/e2e/auth.spec.ts`). Repetir o mesmo texto em dois controles da mesma página deixaria `getByRole('button', { name: 'Sair' })` ambíguo nos testes; a ação de logout já existe e funciona a partir do Header em qualquer tela.
- **Formulário de carteira tem só Apelido, Endereço e Rede(s).** O Figma mistura campos de perfil (nome de exibição, nome do perfil, e-mail, ENS, código de indicação) dentro do formulário de carteira — o mesmo vazamento de campos sem contrato já visto no formulário de Pagamento. Implementei só o que o `Wallet` do contrato tem: `label`, `address`, `kind`, `networks`.
- **Sem campo "Tipo de carteira" (select).** A página já separa fisicamente "Carteira principal" de "Carteira secundária" em duas seções (como o Figma desenha), então o tipo já está implícito em qual formulário o usuário preenche — um select redundante só duplicaria essa escolha.
- **Rede vira caixas de seleção (múltipla), não um único select.** `Wallet.networks` já é uma lista (uma carteira pode valer para mais de uma rede — é assim que a tela de Pagamento filtra as opções de rede disponíveis para a carteira escolhida); um `<select>` de valor único quebraria isso.
- **Validação de endereço é só de formato** (alfanumérico, 6 a 64 caracteres), sem checksum de blockchain de verdade — consistente com o resto do mock, que simula a infraestrutura sem validar criptografia real.
- **Sem frame mobile para Perfil/Carteiras no Figma** (só Desktop). A barra lateral vira uma lista horizontal com rolagem abaixo de `md`, testada em 390px.

### Contratos novos

`GET/PATCH /api/profile` — `PATCH` recebe `{ name, email, avatar? }`; valida nome e e-mail (422 por campo) e e-mail duplicado de outro usuário (409, campo `email`). Avatar é opcional: `string` (data URL, até 200 KB, 422 se maior ou formato inválido) ou `null` para remover.

`POST /api/profile/password` — recebe `{ currentPassword, newPassword }`; 422 por campo se a senha atual não bate ou a nova tem menos de 8 caracteres. Só a hash da nova senha é persistida.

`POST/PATCH /api/wallets[/:id]` — recebem `{ label, address, kind, networks }`; 422 por campo (apelido vazio, endereço inválido, rede vazia) e 409 (`wallet_primary_conflict`) se tentar ter duas carteiras `principal` ao mesmo tempo. Devolvem a lista completa de carteiras do usuário (mesmo formato do `GET`), para o cliente atualizar o cache com `setQueryData` direto, sem round-trip extra — mesmo padrão já usado em `/api/favorites` e `/api/cart/*`.

Carteiras agora persistem em `localStorage` (`kurio:mock-wallets`), igual a NFTs/usuários/favoritos, e são limpas por `resetDb()`/`__kurioMock.reset()`.

## Etapa 6 — Scripts, Lighthouse e regressão visual

Sem desvios do Figma: nada visual mudou nesta etapa.

### Scripts

`typecheck` (`tsc -b --noEmit`) e `lighthouse` (`node lighthouse/run.mjs`) foram adicionados ao `package.json`. O lint continua com `oxlint` (já estava configurado e passando, exit 0); só foram limpos os warnings baratos de `unused-vars` em `src/mocks/handlers.ts` (variáveis de destructuring usadas só pra omitir campos, prefixadas com `_`).

### Lighthouse

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

### Regressão visual

`tests/e2e/visual.spec.ts`: Início, Detalhe, Carrinho e Pagamento, em `desktop` e `mobile` (8 baselines). Determinístico porque cada teste do Playwright já roda num contexto novo (localStorage vazio → mock sempre no cenário semente) e `prefers-reduced-motion` desliga o autoplay do carrossel. Detalhes de como atualizar os baselines estão em `tests/e2e/README.md`.
