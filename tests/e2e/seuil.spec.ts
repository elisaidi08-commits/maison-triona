import { expect, test } from '@playwright/test'

// Story 2.1 : premier écran « Seuil plein écran » (D19).

test('le seuil donne le titre, la question et 4 vrais liens', async ({ page }) => {
  await page.goto('/fr')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Une seconde vie, comme des vacances qui ne s’arrêtent pas.',
  )
  await expect(
    page.getByRole('heading', { level: 2, name: /Que pouvons-nous faire/ }),
  ).toBeVisible()
  const hrefs = await page
    .locator('section[aria-labelledby="seuil-titre"] ul a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(hrefs).toEqual(['#conciergerie', '#grand-age', '#enfants', '/fr/contact'])
})

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`premier choix visible sans défiler (${width} × ${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/fr')
    const box = await page.getByRole('link', { name: /Organiser le quotidien/ }).boundingBox()
    expect(box).not.toBeNull()
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height)
  })
}

test('les choix font au moins 56 px de haut', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr')
  const heights = await page
    .locator('section[aria-labelledby="seuil-titre"] ul a')
    .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height))
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(56)
})
