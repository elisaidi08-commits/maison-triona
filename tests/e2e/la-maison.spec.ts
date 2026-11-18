import { expect, test } from '@playwright/test'

// La Maison (story 2.6) : cinq chapitres, un sommaire en vrais liens, le prénom de Cat une seule
// fois et hors des extraits des moteurs (D45).

test('cinq chapitres et un sommaire qui y mène', async ({ page }) => {
  for (const path of ['/fr/la-maison', '/en/the-house']) {
    await page.goto(path)
    const chapters = page.locator('main article > section')
    await expect(chapters).toHaveCount(5)
    await expect(page.locator('main nav ol > li a')).toHaveCount(5)
    await expect(page.locator('main')).not.toContainText('CONTENU À FOURNIR')
  }
  await page.goto('/fr/la-maison')
  await page.locator('main nav a[href="#discretion"]').click()
  await expect(page).toHaveURL(/#discretion$/)
  await expect(page.locator('#discretion')).toBeInViewport()
})

test('le prénom de Cat n’apparaît qu’une fois, dans data-nosnippet', async ({ page }) => {
  await page.goto('/fr/la-maison')
  await expect(page.locator('main').getByText('Catriona', { exact: true })).toHaveCount(1)
  await expect(page.locator('main [data-nosnippet]')).toHaveText(['Catriona'])
})
