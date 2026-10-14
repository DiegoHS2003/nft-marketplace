# Relatório Lighthouse — Kurio

Gerado em: 2026-10-14T19:59:36.931Z

## Ambiente

- SO: darwin 25.5.0 (arm64)
- Node: v24.19.0
- Lighthouse: 13.5.0
- chrome-launcher: 1.2.2
- Chrome: 155.0.0.0
- Condições: build de produção local via vite preview, MSW ativo
- Execuções por página/perfil: 3 (mediana reportada)

## Metas

| Categoria | Meta |
|---|---|
| performance | ≥ 90 |
| accessibility | ≥ 95 |
| best-practices | ≥ 95 |
| seo | ≥ 90 |

## Resultados (mediana de 3 execuções)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 90 | 100 | 100 | 100 | 3192 ms | 0.000 | 4 ms |
| Início | desktop | 100 | 100 | 100 | 100 | 704 ms | 0.001 | 0 ms |
| Detalhe do NFT #2 | mobile | 89 | 100 | 100 | 100 | 3338 ms | 0.000 | 0 ms |
| Detalhe do NFT #2 | desktop | 99 | 100 | 100 | 100 | 746 ms | 0.000 | 0 ms |

## Abaixo da meta

| Página | Perfil | Categoria | Score | Meta |
|---|---|---|---|---|
| Detalhe do NFT #2 | mobile | performance | 89 | 90 |

**Detalhe do NFT #2 (mobile) — performance:** LCP ~3.3s (score 0.68/1, peso 25%) e FCP ~2.4s (score 0.69/1, peso 10%) dominam o score. Causas reais, nesta ordem: (1) perfil mobile usa o throttling padrão do Lighthouse (CPU 4x mais lenta, rede equivalente a 4G lento) — condição de laboratório exigida pelo enunciado, não simplificada; (2) é uma SPA sem SSR: o audit lcp-discovery-insight mostra "Request is discoverable in initial document: false" — a <img> do NFT só existe no DOM depois do React montar e a query /api/nfts/:id responder, então o navegador não pode descobrir/baixar essa imagem a partir do HTML inicial; (3) src/main.tsx só chama createRoot().render() depois que o MSW (worker.start()) termina de ativar, para garantir que nenhuma chamada real escape sem mock — decisão de arquitetura já registrada no projeto, não alterada aqui; (4) o bundle do MSW (~167 KB gzip) é carregado nesse caminho crítico antes da app montar, por exigência do próprio enunciado de manter os mocks ativos no build de demonstração. Resultado: 89/100, 1 ponto abaixo da meta, estável nas 3 execuções.
