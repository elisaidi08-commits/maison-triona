import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '../fixtures'

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
  '/fr/adresse-inconnue',
]
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

for (const path of PAGES) {
  test(`axe : ${path}`, async ({ page }) => {
    await page.goto(path)
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(
      results.violations.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.length })),
    ).toEqual([])
  })
}
