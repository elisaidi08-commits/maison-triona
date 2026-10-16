import { expect, test } from '@playwright/test'

// Premier écran de l'accueil (D25, D26) : le nom de la maison, l'accroche, ce qu'elle fait,
// l'entrée par besoin.

test('le premier écran donne le nom, l’accroche, ce que fait la maison et 4 vrais liens', async ({
  page,
}) => {
  await page.goto('/fr')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maison Triona')
  await expect(page.getByText('L’attention portée à l’essentiel.')).toBeVisible()
  await expect(page.getByText(/Conciergerie de luxe, accompagnement du grand/)).toBeVisible()
  const hrefs = await page
    .locator('section[aria-labelledby="seuil-titre"] ul a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(hrefs).toEqual(['#conciergerie', '#grand-age', '#enfants', '/fr/contact'])
  await expect(page.getByRole('link', { name: /Évoquer une demande particulière/ })).toHaveCount(1)
})

test('l’accueil suit les neuf séquences de la refonte V3', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const order = await page
    .locator('main section[aria-labelledby], main #seuil-passage')
    .evaluateAll((nodes) => nodes.map((node) => node.id || node.getAttribute('aria-labelledby')))
  expect(order).toEqual([
    'seuil-titre',
    'seuil-passage',
    'promesse-titre',
    'conciergerie',
    'grand-age',
    'enfants',
    'maison-titre',
    'territoires-titre',
    'contact-titre',
  ])
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

test('un choix d’entrée mène à sa scène et y place le focus (M12)', async ({ page }) => {
  await page.goto('/fr')
  await page.getByRole('link', { name: /Accompagner un proche/ }).click()
  await expect(page).toHaveURL(/#grand-age$/)
  await expect(page.locator('#grand-age-titre')).toBeFocused()
})

test('mobile : après un choix, le titre de la scène est visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr')
  await page.getByRole('link', { name: /Accompagner un proche/ }).click()
  await expect(page.locator('#grand-age-titre')).toBeInViewport()
})
