import { expect, test } from '@playwright/test'

// Pied de page (D54, M22) : panneau sapin, disque et dalle cyprès, phrase de l'accueil, touche
// « revenir en haut », trois colonnes, le nom en très grand, barre légale. Aucun réseau social.

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
  await expect(footer.locator('[data-mot]')).toHaveAttribute('aria-hidden', 'true')
  await expect(footer.getByRole('heading', { level: 2 })).toHaveText([
    'Maison Triona',
    'Navigation',
    'Contact',
  ])
})

test('la touche ramène en haut de la page', async ({ page }) => {
  await page.goto('/fr')
  await page.getByRole('link', { name: 'Revenir en haut de la page' }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2)
})

test('desktop : un clic sur le fond change la composition, la souris épaissit le nom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const footer = page.locator('footer')
  await footer.scrollIntoViewIfNeeded()
  const disc = () => page.locator('[data-pied-fond] circle').getAttribute('transform')
  const before = await disc()
  const box = (await footer.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + 300)
  await expect.poll(disc).not.toBe(before)

  const word = (await page.locator('[data-mot]').boundingBox())!
  await page.mouse.move(word.x + word.width * 0.05, word.y + word.height / 2)
  const weights = () =>
    page
      .locator('[data-mot] [data-lettre]')
      .evaluateAll((letters) =>
        letters.map((letter) => Number(getComputedStyle(letter).fontWeight)),
      )
  await expect.poll(async () => (await weights())[0]).toBeGreaterThan(350)
  expect((await weights()).at(-1)).toBe(300)
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('le nom est en place et la touche fonctionne', async ({ page }) => {
    await page.goto('/fr')
    const letter = page.locator('[data-mot] [data-lettre]').first()
    expect(await letter.evaluate((element) => getComputedStyle(element).transform)).toBe('none')
    await page.getByRole('link', { name: 'Revenir en haut de la page' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2)
  })
})
