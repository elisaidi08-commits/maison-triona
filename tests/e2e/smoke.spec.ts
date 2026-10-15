import { expect, test } from '@playwright/test'

// Socle : redirection vers /fr, aucune requête tierce, aucun cookie, noindex hors production.
test('/ mène à /fr, sans requête tierce ni cookie', async ({ page, context, baseURL }) => {
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
  await expect(page).toHaveURL(/\/fr$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(external).toEqual([])
  expect(await context.cookies()).toEqual([])
})

test('le site reste en noindex tant que SITE_INDEXABLE ne vaut pas « true »', async ({ page }) => {
  test.skip(process.env.SITE_INDEXABLE === 'true', 'build indexable')
  await page.goto('/fr')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('le banc d’essai /fr/demo répond et n’est jamais indexé', async ({ page }) => {
  const response = await page.goto('/fr/demo')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tokens et typographie')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('une adresse inconnue répond 404 dans la langue de la page', async ({ page }) => {
  const response = await page.goto('/fr/adresse-inconnue')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cette page n’existe pas.')
})
