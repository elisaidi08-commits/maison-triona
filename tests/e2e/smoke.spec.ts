import { expect, test } from '@playwright/test'

// Socle (story 1.1) : la page répond, ne contacte aucun domaine tiers et ne pose aucun cookie.
test('la page d’accueil répond sans requête tierce ni cookie', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? '').origin
  const external: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== origin) {
      external.push(request.url())
    }
  })

  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(external).toEqual([])
  expect(await context.cookies()).toEqual([])
})

test('le site reste en noindex tant que SITE_INDEXABLE ne vaut pas « true »', async ({ page }) => {
  test.skip(process.env.SITE_INDEXABLE === 'true', 'build indexable')
  await page.goto('/')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})
