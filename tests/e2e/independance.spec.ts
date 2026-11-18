import { expect, test } from '@playwright/test'

// « Notre indépendance » (story 2.10) : les seuls blocs confirmés par Cat, aucun montant.

test('la page présente les trois blocs confirmés, sans montant', async ({ page }) => {
  for (const path of ['/fr/notre-independance', '/en/our-independence']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('main article section')).toHaveCount(3)
    await expect(page.locator('main')).not.toContainText(/€|%|\d+\s?(euros?|EUR)/)
  }
})

test('on y arrive depuis « Qui rémunère la maison » d’une page de service', async ({ page }) => {
  await page.goto('/fr/services/conciergerie')
  await page.getByRole('link', { name: 'Notre indépendance, en détail' }).click()
  await expect(page).toHaveURL('/fr/notre-independance')
})
