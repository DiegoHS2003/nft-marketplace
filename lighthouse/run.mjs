import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import lighthouse, { desktopConfig } from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { config } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outputDir = path.resolve(rootDir, config.outputDir)

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

async function isServerUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp(url)) return true
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

async function ensureServer() {
  if (await isServerUp(config.server.url)) {
    console.log(`[lighthouse] servidor já respondendo em ${config.server.url}, reusando.`)
    return { startedByScript: false, process: null }
  }

  console.log('[lighthouse] nenhum servidor ativo: buildando...')
  const build = spawnSync(config.server.buildCommand, { shell: true, cwd: rootDir, stdio: 'inherit' })
  if (build.status !== 0) {
    throw new Error(`build falhou (exit ${build.status})`)
  }

  console.log(`[lighthouse] subindo "${config.server.startCommand}"...`)
  const serverProcess = spawn(config.server.startCommand, { shell: true, cwd: rootDir, stdio: 'ignore' })

  const ready = await waitForServer(config.server.url, config.server.startTimeoutMs)
  if (!ready) {
    serverProcess.kill()
    throw new Error(`servidor não respondeu em ${config.server.url} depois de ${config.server.startTimeoutMs}ms`)
  }
  console.log(`[lighthouse] servidor pronto em ${config.server.url}`)
  return { startedByScript: true, process: serverProcess }
}

async function runOnce({ url, profile, flagsOutputPrefix }) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const flags = {
      logLevel: 'error',
      output: ['json', 'html'],
      onlyCategories: config.categories,
      port: chrome.port,
    }
    const lhConfig = profile === 'desktop' ? desktopConfig : undefined

    const result = await lighthouse(url, flags, lhConfig)
    const { lhr, report } = result
    const [jsonReport, htmlReport] = report

    await writeFile(`${flagsOutputPrefix}.json`, jsonReport)
    await writeFile(`${flagsOutputPrefix}.html`, htmlReport)

    const categoryScores = {}
    for (const catId of config.categories) {
      categoryScores[catId] = Math.round((lhr.categories[catId]?.score ?? 0) * 100)
    }

    const metricValues = {}
    for (const metric of config.metrics) {
      metricValues[metric.key] = lhr.audits[metric.auditId]?.numericValue ?? null
    }

    return {
      categoryScores,
      metricValues,
      lighthouseVersion: lhr.lighthouseVersion,
      hostUserAgent: lhr.environment?.hostUserAgent ?? lhr.userAgent,
    }
  } finally {
    await chrome.kill()
  }
}

function fmtMs(value) {
  return value == null ? 'n/a' : `${Math.round(value)} ms`
}

function fmtCls(value) {
  return value == null ? 'n/a' : value.toFixed(3)
}

async function main() {
  await mkdir(outputDir, { recursive: true })

  const { startedByScript, process: serverProcess } = await ensureServer()

  const results = []
  let hostUserAgent = null
  let lighthouseVersion = null

  try {
    for (const page of config.pages) {
      for (const profile of config.profiles) {
        const runs = []
        for (let run = 1; run <= config.runsPerPage; run++) {
          const url = new URL(page.path, config.server.url).toString()
          const prefix = path.join(outputDir, `${page.key}-${profile}-run${run}`)
          console.log(`[lighthouse] ${page.label} · ${profile} · run ${run}/${config.runsPerPage}`)
          const outcome = await runOnce({ url, profile, flagsOutputPrefix: prefix })
          runs.push(outcome)
          hostUserAgent ??= outcome.hostUserAgent
          lighthouseVersion ??= outcome.lighthouseVersion
        }

        const medians = {
          categories: {},
          metrics: {},
        }
        for (const catId of config.categories) {
          medians.categories[catId] = median(runs.map((r) => r.categoryScores[catId]))
        }
        for (const metric of config.metrics) {
          medians.metrics[metric.key] = median(runs.map((r) => r.metricValues[metric.key]))
        }

        results.push({ page: page.key, label: page.label, profile, runs: runs.length, medians })
      }
    }
  } finally {
    if (startedByScript) serverProcess.kill()
  }

  const chromeVersion = hostUserAgent?.match(/Chrome\/(\S+)/)?.[1] ?? 'desconhecida'
  const chromeLauncherVersion = JSON.parse(
    await readFile(path.resolve(rootDir, 'node_modules/chrome-launcher/package.json'), 'utf8'),
  ).version

  const failures = []
  for (const result of results) {
    for (const [catId, threshold] of Object.entries(config.thresholds)) {
      const score = result.medians.categories[catId]
      if (score < threshold) {
        const cause =
          config.knownCauses[`${result.page}:${result.profile}:${catId}`] ??
          'não documentado — investigar o audits do JSON antes de aceitar o resultado.'
        failures.push({ page: result.label, profile: result.profile, category: catId, score, threshold, cause })
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    environment: {
      os: `${os.platform()} ${os.release()} (${os.arch()})`,
      node: process.version,
      lighthouse: lighthouseVersion ?? 'n/a',
      chromeLauncher: chromeLauncherVersion,
      chrome: chromeVersion,
      note: config.environmentNote,
    },
    thresholds: config.thresholds,
    runsPerPage: config.runsPerPage,
    results,
    failures,
  }

  await writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2))
  await writeFile(path.join(outputDir, 'summary.md'), toMarkdown(summary))

  console.log('\n=== Lighthouse — medianas ===')
  for (const result of results) {
    console.log(
      `${result.label} (${result.profile}): Perf ${result.medians.categories.performance} · ` +
        `A11y ${result.medians.categories.accessibility} · BP ${result.medians.categories['best-practices']} · ` +
        `SEO ${result.medians.categories.seo} · LCP ${fmtMs(result.medians.metrics.lcp)} · ` +
        `CLS ${fmtCls(result.medians.metrics.cls)} · TBT ${fmtMs(result.medians.metrics.tbt)}`,
    )
  }
  if (failures.length) {
    console.log('\nAbaixo da meta:')
    for (const f of failures) {
      console.log(`  - ${f.page} (${f.profile}) ${f.category}: ${f.score} < ${f.threshold}`)
    }
    process.exitCode = 1
  } else {
    console.log('\nTodas as categorias atingiram a meta.')
  }
}

function toMarkdown(summary) {
  const lines = []
  lines.push('# Relatório Lighthouse — Kurio\n')
  lines.push(`Gerado em: ${summary.generatedAt}\n`)
  lines.push('## Ambiente\n')
  lines.push(`- SO: ${summary.environment.os}`)
  lines.push(`- Node: ${summary.environment.node}`)
  lines.push(`- Lighthouse: ${summary.environment.lighthouse}`)
  lines.push(`- chrome-launcher: ${summary.environment.chromeLauncher}`)
  lines.push(`- Chrome: ${summary.environment.chrome}`)
  lines.push(`- Condições: ${summary.environment.note}`)
  lines.push(`- Execuções por página/perfil: ${summary.runsPerPage} (mediana reportada)\n`)

  lines.push('## Metas\n')
  lines.push('| Categoria | Meta |')
  lines.push('|---|---|')
  for (const [cat, threshold] of Object.entries(summary.thresholds)) {
    lines.push(`| ${cat} | ≥ ${threshold} |`)
  }
  lines.push('')

  lines.push('## Resultados (mediana de 3 execuções)\n')
  lines.push('| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of summary.results) {
    const c = r.medians.categories
    const m = r.medians.metrics
    lines.push(
      `| ${r.label} | ${r.profile} | ${c.performance} | ${c.accessibility} | ${c['best-practices']} | ${c.seo} | ` +
        `${fmtMs(m.lcp)} | ${fmtCls(m.cls)} | ${fmtMs(m.tbt)} |`,
    )
  }
  lines.push('')

  if (summary.failures.length) {
    lines.push('## Abaixo da meta\n')
    lines.push('| Página | Perfil | Categoria | Score | Meta |')
    lines.push('|---|---|---|---|---|')
    for (const f of summary.failures) {
      lines.push(`| ${f.page} | ${f.profile} | ${f.category} | ${f.score} | ${f.threshold} |`)
    }
    lines.push('')
    for (const f of summary.failures) {
      lines.push(`**${f.page} (${f.profile}) — ${f.category}:** ${f.cause}\n`)
    }
  } else {
    lines.push('Todas as categorias atingiram a meta nas três execuções.\n')
  }

  return lines.join('\n')
}

main().catch((err) => {
  console.error('[lighthouse] falhou:', err)
  process.exitCode = 1
})
