import { expect, test } from '../fixtures'

// Story 1.4 : layout global, chemins localisés, sélecteur de langue, lien d'évitement, menu mobile.

test('chemins localisés et langue du document', async ({ page }) => {
  await page.goto('/en/the-house')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The House')
  await page.goto('/fr/la-maison')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('La Maison')
})

test('FR · EN mène à la même page dans l’autre langue', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/la-maison')
  const english = page.getByRole('banner').getByRole('link', { name: /EN/ })
  await expect(english).toHaveAttribute('lang', 'en')
  await expect(english).toHaveAttribute('hreflang', 'en')
  await english.click()
  await expect(page).toHaveURL(/\/en\/the-house$/)
})

test('le lien d’évitement est le premier élément focalisable', async ({ page }) => {
  await page.goto('/fr')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Aller au contenu' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
})

test('menu mobile : s’ouvre, page courante marquée, Échap le ferme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr/services')
  await page.getByText('Menu', { exact: true }).click()
  const current = page.getByRole('navigation', { name: 'Navigation principale' }).last()
  await expect(current.getByRole('link', { name: 'Services' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.keyboard.press('Escape')
  await expect(page.locator('details')).not.toHaveAttribute('open', '')
})
