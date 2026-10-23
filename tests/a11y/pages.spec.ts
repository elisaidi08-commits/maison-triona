import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// WCAG 2.2 AA (CLAUDE.md § Accessibilité). La liste s'allonge à chaque story, FR et EN dès la story 1.4.
const PAGES = [
  '/fr',
  '/en',
  '/fr/la-maison',
  '/en/the-house',
  '/fr/contact',
  '/fr/services/grand-age',
  '/en/services/concierge',
  '/fr/demo',
  '/en/demo',
  '/fr/prototype',
  '/en/prototype',
  '/fr/prototype/film',
  '/fr/prototype/chemin',
  '/fr/adresse-inconnue',
]
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

for (const path of PAGES) {
  test(`axe : ${path}`, async ({ page }) => {
    await page.goto(path)
    // État final de la page : on la parcourt pour que les légendes qui apparaissent au défilement
    // (prototype V5, fondu de 700 ms) aient fini leur fondu ; axe ne mesure pas un état transitoire.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
        window.scrollTo({ top: y, behavior: 'instant' })
        await new Promise((resolve) => setTimeout(resolve, 40))
      }
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.waitForTimeout(1000)
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(
      results.violations.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.length })),
    ).toEqual([])
  })
}
