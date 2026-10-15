// npm run lighthouse — Lighthouse 13, mobile et desktop, sur un build de production déjà lancé.
//   npm run build && npm run start -- --port 3100     (dans un autre terminal)
//   npm run lighthouse                                (toutes les pages de PAGES)
//   npm run lighthouse -- /fr /fr/demo                (pages choisies)
// Seuils : Performance, Accessibilité, SEO ≥ 95 (docs/architecture.md §8). Code de sortie 1 sinon.
// Chrome : le Chromium de Playwright (`npx playwright install chromium`), aucun autre navigateur requis.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import lighthouse, { desktopConfig } from 'lighthouse'
import { chromium } from '@playwright/test'
import { ROOT } from './lib/walk.mjs'

const BASE_URL = process.env.LIGHTHOUSE_URL ?? 'http://localhost:3100'
const PAGES = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['/']
const THRESHOLD = 95
const GATED = ['performance', 'accessibility', 'seo']
const CATEGORIES = [...GATED, 'best-practices']
const PORT = 9333
// Hors production, le noindex est voulu (SITE_INDEXABLE) : l'audit « is-crawlable » est écarté du score
// et signalé à part, pour que le seuil SEO mesure le reste.
const INDEXABLE = process.env.SITE_INDEXABLE === 'true'
const SKIPPED = INDEXABLE ? [] : ['is-crawlable']

try {
  const response = await fetch(BASE_URL)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
} catch (error) {
  console.error(`lighthouse : ${BASE_URL} ne répond pas (${error.message}).`)
  console.error('Lancer d’abord : npm run build && npm run start -- --port 3100')
  process.exit(1)
}

const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] })
const outDir = join(ROOT, '.lighthouse')
mkdirSync(outDir, { recursive: true })

const rows = []
let failed = false
try {
  for (const path of PAGES) {
    for (const [form, config] of [
      ['mobile', undefined],
      ['desktop', desktopConfig],
    ]) {
      const url = new URL(path, BASE_URL).href
      const result = await lighthouse(
        url,
        {
          port: PORT,
          output: 'json',
          logLevel: 'error',
          onlyCategories: CATEGORIES,
          skipAudits: SKIPPED,
        },
        config,
      )
      if (!result) throw new Error(`aucun résultat pour ${url}`)
      const { lhr } = result
      const score = (id) => Math.round((lhr.categories[id]?.score ?? 0) * 100)
      const metric = (id) => lhr.audits[id]?.displayValue ?? '—'
      const row = {
        page: path,
        form,
        perf: score('performance'),
        a11y: score('accessibility'),
        seo: score('seo'),
        bp: score('best-practices'),
        lcp: metric('largest-contentful-paint'),
        cls: metric('cumulative-layout-shift'),
        tbt: metric('total-blocking-time'),
      }
      rows.push(row)
      if (GATED.some((id) => score(id) < THRESHOLD)) failed = true
      const file = `${path.replaceAll('/', '_') || '_'}-${form}.json`
      writeFileSync(join(outDir, file), result.report)
    }
  }
} finally {
  await browser.close()
}

console.table(rows)
if (!INDEXABLE) {
  console.log(
    'Audit « is-crawlable » écarté : noindex voulu tant que SITE_INDEXABLE ne vaut pas « true ».',
  )
}
console.log(
  `Rapports JSON : .lighthouse/ (à ouvrir dans le Lighthouse Viewer de Chrome si besoin).`,
)
if (failed) {
  console.error(
    `lighthouse : au moins un score Performance, Accessibilité ou SEO est sous ${THRESHOLD}.`,
  )
  process.exit(1)
}
console.log(`lighthouse : tous les scores contrôlés sont ≥ ${THRESHOLD}.`)
