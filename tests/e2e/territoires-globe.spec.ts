import { expect, test, type Page } from '@playwright/test'

// Globe des Territoires (D55, M23) : dessiné dans la page avec les données embarquées, aucun appel
// réseau hors du site, molette jamais capturée, décoratif, sphère seule sans JavaScript.

// Part des pixels non transparents au centre du globe : le dessin a bien eu lieu.
const drawn = (page: Page) =>
  page.locator('[data-globe]').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')!
    const size = 40
    const { data } = context.getImageData(
      canvas.width / 2 - size / 2,
      canvas.height / 2 - size / 2,
      size,
      size,
    )
    let opaque = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) opaque++
    return opaque / (size * size)
  })

test('le globe se dessine sans aucune requête hors du site', async ({ page }) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith('http://localhost')) external.push(request.url())
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/territoires')
  await page.locator('[data-globe-cadre]').scrollIntoViewIfNeeded()
  await expect.poll(() => drawn(page)).toBeGreaterThan(0.9)
  await expect(page.locator('[data-globe]')).toHaveAttribute('aria-hidden', 'true')
  expect(external).toEqual([])
})

test('la molette sur le globe fait défiler la page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/territoires')
  const box = (await page.locator('[data-globe-cadre]').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, Math.min(box.y + box.height / 2, 850))
  const before = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100)
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la sphère seule tient la place du globe, les pays sont écrits', async ({ page }) => {
    await page.goto('/fr/territoires')
    await expect(page.locator('[data-globe-repli]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'France' })).toBeVisible()
  })
})
