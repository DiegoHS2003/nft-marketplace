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
