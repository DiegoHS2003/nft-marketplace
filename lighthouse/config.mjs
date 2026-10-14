// Configuração versionada da auditoria Lighthouse (etapa 10 do ENUNCIADO.md).
// Única fonte das metas e do que é auditado — lighthouse/run.mjs não hardcoda nada disso.

export const config = {
  server: {
    // Se já houver algo respondendo nessa URL, run.mjs reusa; senão builda e sobe `vite preview`.
    url: 'http://localhost:4173',
    port: 4173,
    startCommand: 'npm run preview -- --port 4173 --strictPort',
    buildCommand: 'npm run build',
    startTimeoutMs: 30_000,
  },

  pages: [
    { key: 'inicio', label: 'Início', path: '/' },
    // id real de src/mocks/fixtures.ts (seedNfts[1]: disponível, não esgotado)
    { key: 'detalhe', label: 'Detalhe do NFT #2', path: '/nfts/2' },
  ],

  profiles: ['mobile', 'desktop'],

  runsPerPage: 3,

  categories: ['performance', 'accessibility', 'best-practices', 'seo'],

  // Métricas numéricas (ms para LCP/TBT, score adimensional para CLS) reportadas junto das categorias.
  metrics: [
    { auditId: 'largest-contentful-paint', key: 'lcp', unit: 'ms' },
    { auditId: 'cumulative-layout-shift', key: 'cls', unit: '' },
    { auditId: 'total-blocking-time', key: 'tbt', unit: 'ms' },
  ],

  thresholds: {
    performance: 90,
    accessibility: 95,
    'best-practices': 95,
    seo: 90,
  },

  outputDir: 'lighthouse/reports',

  environmentNote: 'build de produção local via vite preview, MSW ativo',

  // Causas conhecidas para resultados abaixo da meta, por "pageKey:profile:category".
  // Preenchidas depois de investigar o relatório (ver audits lcp-discovery-insight, network-requests);
  // não é desculpa genérica — é o motivo real checado no JSON daquela execução.
  knownCauses: {
    'detalhe:mobile:performance':
      'LCP ~3.3s (score 0.68/1, peso 25%) e FCP ~2.4s (score 0.69/1, peso 10%) dominam o score. ' +
      'Causas reais, nesta ordem: (1) perfil mobile usa o throttling padrão do Lighthouse ' +
      '(CPU 4x mais lenta, rede equivalente a 4G lento) — condição de laboratório exigida pelo enunciado, não simplificada; ' +
      '(2) é uma SPA sem SSR: o audit lcp-discovery-insight mostra "Request is discoverable in initial document: false" ' +
      '— a <img> do NFT só existe no DOM depois do React montar e a query /api/nfts/:id responder, então o navegador ' +
      'não pode descobrir/baixar essa imagem a partir do HTML inicial; ' +
      '(3) src/main.tsx só chama createRoot().render() depois que o MSW (worker.start()) termina de ativar, para garantir ' +
      'que nenhuma chamada real escape sem mock — decisão de arquitetura já registrada no projeto, não alterada aqui; ' +
      '(4) o bundle do MSW (~167 KB gzip) é carregado nesse caminho crítico antes da app montar, por exigência do próprio ' +
      'enunciado de manter os mocks ativos no build de demonstração. Resultado: 89/100, 1 ponto abaixo da meta, estável nas 3 execuções.',
  },
}
