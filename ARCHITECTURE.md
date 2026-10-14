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
