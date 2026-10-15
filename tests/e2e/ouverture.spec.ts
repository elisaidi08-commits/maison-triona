import { expect, test } from '@playwright/test'

// Ouverture de l'accueil (D25) : une fois par visite, refermable au clavier, absente sans JavaScript.

test('desktop : l’ouverture s’affiche, Échap la referme et le focus va au titre', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const dialog = page.getByRole('dialog', { name: 'Ouverture' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Pause' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Maison Triona' })).toBeFocused()
  await page.reload()
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('mobile : l’ouverture se passe d’un geste et ne revient pas pendant la visite', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr')
  await page.getByRole('button', { name: 'Passer l’introduction' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/fr/contact')
  await page.goto('/fr')
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('l’accueil s’affiche directement', async ({ page }) => {
    await page.goto('/fr')
    await expect(page.locator('[data-ouverture]')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1, name: 'Maison Triona' })).toBeVisible()
  })
})
