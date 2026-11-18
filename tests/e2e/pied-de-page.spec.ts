import { expect, test } from '@playwright/test'

// Pied de page « Kiln » (D54), immobile et resserré par D64 (2) : fond ivoire, filet or en tête,
// phrase de l'accueil, touche « revenir en haut », trois colonnes, « Maison Triona » signé du « K. »,
// barre légale avec la mention IA sur sa propre ligne. Aucun réseau social, rien qui bouge.

test('le pied de page garde ses liens, sans aucun réseau social', async ({ page }) => {
  await page.goto('/fr')
  const footer = page.locator('footer')
  const hrefs = await footer
    .locator('a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(hrefs).toEqual(
    expect.arrayContaining([
      '#top',
      '/fr/la-maison',
      '/fr/services/conciergerie',
      '/fr/contact',
      '/fr/mentions-legales',
      '/fr/confidentialite',
    ]),
  )
  expect(
    hrefs.some((href) => /facebook|instagram|linkedin|youtube|pinterest|x\.com/i.test(href ?? '')),
  ).toBe(false)
  await expect(footer.getByRole('heading', { level: 2 })).toHaveText([
    'Maison Triona',
    'Navigation',
    'Contact',
  ])
})

test('le nom garde ses capitales, signé du « K. » de 48 px', async ({ page }) => {
  await page.goto('/fr')
  const footer = page.locator('footer')
  const name = footer.locator('p[aria-hidden="true"]', { hasText: 'Maison Triona' })
  await expect(name).toHaveText('Maison Triona')
  const stamp = footer.locator('span[aria-hidden="true"]', { hasText: /^K\.$/ })
  await expect(stamp).toHaveCSS('font-size', '48px')
})

// Avant D64 : 1 071, 1 070 et 1 446 px. Le lien de la FAQ (story 2.8) ajoute une ligne à la
// navigation (957 px à 834) ; celui de l'accessibilité (story 4.4), une ligne à la barre légale en
// mobile (1 241 px à 390).
for (const [width, height, max] of [
  [1440, 900, 800],
  [834, 1112, 1000],
  [390, 844, 1300],
] as const) {
  test(`${width} px : nettement plus court qu’avant (moins de ${max} px), mention IA seule sur sa ligne`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/fr')
    const footer = page.locator('footer')
    expect((await footer.boundingBox())!.height).toBeLessThan(max)
    const ai = footer.getByText('Images créées par intelligence artificielle.')
    const aiBox = (await ai.boundingBox())!
    const legal = (await footer.getByRole('link', { name: 'Confidentialité' }).boundingBox())!
    // La mention commence sous la dernière ligne de la barre et tient sur une ligne.
    expect(aiBox.y).toBeGreaterThanOrEqual(legal.y + legal.height)
    expect(aiBox.height).toBeLessThan(40)
  })
}

test('immobile : ni disque, ni lettres animées, ni flèche qui part', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const footer = page.locator('footer')
  await footer.scrollIntoViewIfNeeded()
  // Un seul dessin, la flèche de la touche ; aucun fond tracé derrière le texte.
  await expect(footer.locator('svg')).toHaveCount(1)
  const top = page.getByRole('link', { name: 'Revenir en haut de la page' })
  await top.hover()
  await page.waitForTimeout(400)
  const moving = await footer.evaluate(
    (element) =>
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === 'running').length,
  )
  expect(moving).toBe(0)
  expect(await top.evaluate((link) => getComputedStyle(link).transform)).toBe('none')
})

test('la touche ramène en haut de la page', async ({ page }) => {
  await page.goto('/fr')
  await page.getByRole('link', { name: 'Revenir en haut de la page' }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2)
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('le pied de page est complet et la touche fonctionne', async ({ page }) => {
    await page.goto('/fr')
    await expect(page.locator('footer').getByRole('link', { name: 'Nous écrire' })).toBeVisible()
    await page.getByRole('link', { name: 'Revenir en haut de la page' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2)
  })
})
