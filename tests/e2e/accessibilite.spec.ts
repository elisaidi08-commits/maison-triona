import { expect, test } from '@playwright/test'

// Déclaration d'accessibilité (story 4.4) et image de partage dont le texte alternatif suit la page.

test('la déclaration d’accessibilité est reliée au pied de page, dans les deux langues', async ({
  page,
}) => {
  for (const [home, path, name] of [
    ['/fr', '/fr/accessibilite', 'Accessibilité'],
    ['/en', '/en/accessibility', 'Accessibility'],
  ] as const) {
    await page.goto(home)
    await page.locator('footer').getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    // Le sommaire « Sur cette page » du gabarit légal, puis les quatre sections.
    await expect(page.locator('main h2:visible')).toHaveCount(5)
    await expect(page.locator('main')).toContainText('WCAG 2.2')
  }
})

test('le texte alternatif de l’image de partage suit la langue de la page', async ({ page }) => {
  await page.goto('/fr/faq')
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    'content',
    /sceau de Maison Triona/,
  )
  await page.goto('/en/faq')
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    'content',
    /Maison Triona seal/,
  )
})
