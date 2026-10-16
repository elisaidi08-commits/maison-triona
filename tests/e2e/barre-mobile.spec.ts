import { expect, test } from '@playwright/test'

// Barre mobile « Écrire en toute discrétion » (docs/art-direction.md §7.10).

test('mobile : la barre mène au contact sans masquer le premier choix', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr')
  const bar = page.locator('[data-barre-mobile]')
  await expect(bar).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Écrire en toute discrétion' })).toHaveAttribute(
    'href',
    '/fr/contact',
  )
  const barBox = await bar.boundingBox()
  const choice = await page.getByRole('link', { name: /Organiser le quotidien/ }).boundingBox()
  expect((choice?.y ?? 0) + (choice?.height ?? 0)).toBeLessThanOrEqual(barBox?.y ?? 0)
})

test('mobile : la page réserve la hauteur de la barre, le pied de page reste visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr')
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
  )
  const footer = await page.locator('footer').boundingBox()
  const bar = await page.locator('[data-barre-mobile]').boundingBox()
  expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThanOrEqual((bar?.y ?? 0) + 1)
})

test('la barre mobile est absente de la page Contact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr/contact')
  await expect(page.locator('[data-barre-mobile]')).toHaveCount(0)
})
