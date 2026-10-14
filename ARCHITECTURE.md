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
