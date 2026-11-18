import { expect, test } from '@playwright/test'
import { LOCALES, localizedPath, type InternalPath } from '../../src/i18n/pathnames'

// SEO technique (story 4.3, docs/seo-strategy.md §G) : métadonnées par page et par langue,
// alternances réciproques, données structurées, sitemap et robots.txt.

// Origine attendue des URL absolues : SITE_URL, sinon le repli local de src/lib/site.ts.
const ORIGIN = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

const PAGES: InternalPath[] = [
  '/',
  '/services',
  '/services/conciergerie',
  '/services/grand-age',
  '/services/enfants',
  '/la-maison',
  '/territoires',
  '/faq',
  '/comment-ca-se-passe',
  '/comment-ca-se-passe/langage-simple',
  '/notre-independance',
  '/contact',
  '/mentions-legales',
  '/confidentialite',
]

test('chaque page a son titre, sa description, son canonical et ses alternances', async ({
  page,
}) => {
  const titles = new Set<string>()
  for (const internal of PAGES) {
    for (const locale of LOCALES) {
      const path = localizedPath(internal, locale)
      await page.goto(path)
      const title = await page.title()
      expect(title, path).toMatch(/ · Maison Triona$/)
      titles.add(title)
      const description = await page.locator('meta[name="description"]').getAttribute('content')
      expect(description?.length ?? 0, path).toBeGreaterThan(100)

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
      expect(canonical, path).toBe(`${ORIGIN}${path}`)
      expect(canonical, path).not.toContain('?')

      for (const [lang, target] of [
        ['fr', localizedPath(internal, 'fr')],
        ['en', localizedPath(internal, 'en')],
        ['x-default', localizedPath(internal, 'fr')],
      ]) {
        const href = await page
          .locator(`link[rel="alternate"][hreflang="${lang}"]`)
          .getAttribute('href')
        expect(href, `${path} ${lang}`).toBe(`${ORIGIN}${target}`)
      }
    }
  }
  expect(titles.size).toBe(PAGES.length * LOCALES.length)
})

// Seulement ce que la page montre : Organization et WebSite sur l'accueil, Service sur les pages de
// service, rien ailleurs (aucun fil d'Ariane visible).
test('les données structurées ne balisent que ce que la page montre', async ({ page }) => {
  for (const internal of PAGES) {
    const path = localizedPath(internal, 'fr')
    await page.goto(path)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const expected =
      internal === '/'
        ? ['Organization', 'WebSite']
        : internal === '/faq'
          ? ['FAQPage']
          : internal.startsWith('/services/')
            ? ['Organization', 'Service']
            : []
    if (expected.length === 0) {
      expect(blocks, path).toHaveLength(0)
      continue
    }
    expect(blocks, path).toHaveLength(1)
    const data = JSON.parse(blocks[0] ?? '{}')
    const graph = data['@graph'] as { '@type': string; url?: string }[]
    expect(graph.map((node) => node['@type'])).toEqual(expected)
    if (expected[0] === 'Organization') expect(graph[0]?.url, path).toBe(`${ORIGIN}/`)
    for (const banned of [
      'LocalBusiness',
      'EmploymentAgency',
      'address',
      'Person',
      'sameAs',
      'areaServed',
      'description',
    ]) {
      expect(blocks[0], `${path} ${banned}`).not.toContain(banned)
    }
  }
})

// D45 : « Catriona » une seule fois sur La Maison, jamais dans ce que lisent les moteurs :
// ni métadonnées, ni données structurées, ni extrait (`data-nosnippet` autour du prénom).
test('le prénom de Cat n’apparaît ni dans les métadonnées ni hors data-nosnippet', async ({
  page,
}) => {
  for (const internal of PAGES) {
    for (const locale of LOCALES) {
      const path = localizedPath(internal, locale)
      await page.goto(path)
      const head = await page.locator('head').innerHTML()
      const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents()
      expect(head + jsonLd.join(''), path).not.toMatch(/Catriona|\bCat\b/)
      const visible = await page.locator('main').evaluate((main) => {
        const copy = main.cloneNode(true) as HTMLElement
        copy.querySelectorAll('[data-nosnippet]').forEach((node) => node.remove())
        return copy.textContent ?? ''
      })
      expect(visible, path).not.toContain('Catriona')
    }
  }
})

test('le sitemap liste les pages publiques dans les deux langues, sans /demo', async ({
  request,
}) => {
  const response = await request.get('/sitemap.xml')
  expect(response.status()).toBe(200)
  const xml = await response.text()
  expect(xml.match(/<url>/g)).toHaveLength(PAGES.length * LOCALES.length)
  expect(xml).not.toContain('/demo')
  expect(xml).toContain('hreflang="x-default"')
  expect(xml).toContain('/en/where-we-work</loc>')
})

test('robots.txt autorise tout et indique le sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.status()).toBe(200)
  const text = await response.text()
  expect(text).toContain('Allow: /')
  expect(text).toMatch(/Sitemap: .*\/sitemap\.xml/)
  // Jamais `Disallow: /` : pendant le noindex, les moteurs ne liraient plus la balise.
  expect(text).not.toMatch(/Disallow: \/\s/)
})

test('aucun en-tête Link de next-intl (alternances dans le HTML seulement)', async ({
  request,
}) => {
  const response = await request.get('/fr/la-maison')
  expect(response.headers()['link'] ?? '').not.toContain('hreflang')
})
