import { expect, test } from '@playwright/test'

// Pied de page « Kiln » (D54), immobile (D64, 2), resserré par D72 (story 2.16) : fond ivoire, filet
// or en tête, phrase de l'accueil, deux zones (la maison, la navigation), « Maison Triona » signé du
// « K. », barre légale avec la mention IA et « Revenir en haut de la page » en lien texte. En mobile,
// la navigation se replie dans un <details>. Aucun réseau social, rien qui bouge.

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
  ])
})

test('plus de colonne Contact : la réassurance du bloc Contact n’est pas répétée', async ({
  page,
}) => {
  await page.goto('/fr/services')
  const reassurance = 'Chaque demande est lue personnellement et reste confidentielle.'
  await expect(page.locator('[data-surface="sapin"]').getByText(reassurance)).toBeVisible()
  await expect(page.locator('footer').getByText(reassurance)).toHaveCount(0)
  // Le contact reste joignable depuis le pied : le lien de la navigation.
  await expect(
    page.locator('footer').getByRole('link', { name: 'Contact', exact: true }),
  ).toBeVisible()
})

test('le nom garde ses capitales, signé du « K. » de 48 px', async ({ page }) => {
  await page.goto('/fr')
  const footer = page.locator('footer')
  const name = footer.locator('p[aria-hidden="true"]', { hasText: 'Maison Triona' })
  await expect(name).toHaveText('Maison Triona')
  const stamp = footer.locator('span[aria-hidden="true"]', { hasText: /^K\.$/ })
  await expect(stamp).toHaveCSS('font-size', '48px')
})

// Avant D64 : 1 071, 1 070 et 1 446 px ; avant D72 : 775, 957 et 1 241 px. Après D72 : 794, 767 et
// 768 px (navigation repliée). Le desktop prend 19 px : « Revenir en haut » est désormais une cible de
// 48 px sur la ligne de la mention IA, au lieu d'une touche logée à côté de la phrase.
for (const [width, height, max] of [
  [1440, 900, 820],
  [834, 1112, 800],
  [390, 844, 800],
] as const) {
  test(`${width} px : moins de ${max} px, mention IA seule sur sa ligne`, async ({ page }) => {
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

test('390 px : la navigation est repliée et s’ouvre au clavier', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr')
  const footer = page.locator('footer')
  const services = footer.getByRole('link', { name: 'Conciergerie de luxe' })
  await expect(services).toBeHidden()
  const summary = footer.locator('summary', { hasText: 'Navigation' })
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(services).toBeVisible()
  await expect(footer.getByRole('navigation', { name: 'Navigation' })).toHaveCount(1)
})

test('immobile : ni disque, ni lettres animées, ni flèche qui part', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const footer = page.locator('footer')
  await footer.scrollIntoViewIfNeeded()
  // Aucun dessin : ni disque, ni flèche (la touche sapin est devenue un lien texte, D72).
  await expect(footer.locator('svg')).toHaveCount(0)
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

test('le lien ramène en haut de la page', async ({ page }) => {
  await page.goto('/fr')
  await page.getByRole('link', { name: 'Revenir en haut de la page' }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2)
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la navigation repliée s’ouvre et le lien remonte', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fr')
    const footer = page.locator('footer')
    await footer.locator('summary', { hasText: 'Navigation' }).click()
    await expect(footer.getByRole('link', { name: 'Garde d’enfants' })).toBeVisible()
    await page.getByRole('link', { name: 'Revenir en haut de la page' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2)
  })
})
