import { expect, test } from '@playwright/test'

// Espace du coffre (story 3.2, partie C ; docs/architecture.md §6.5, §9.1, §9.3). Sans compte :
// la connexion elle-même est couverte par tests/integration/coffre-auth.test.ts.

const NONCE = /'nonce-([A-Za-z0-9+/=]+)'/

test('la page de connexion est noindex, jamais mise en cache, sans référent', async ({ page }) => {
  const response = await page.goto('/coffre/connexion')
  expect(response?.status()).toBe(200)
  const headers = response?.headers() ?? {}
  expect(headers['x-robots-tag']).toBe('noindex, nofollow')
  expect(headers['cache-control']).toContain('no-store')
  expect(headers['referrer-policy']).toBe('no-referrer')
  expect(headers['x-frame-options']).toBe('DENY')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connexion')
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible()
})

test('le coffre a sa propre CSP à nonce, sans unsafe-inline ni la CSP du site', async ({
  page,
  request,
}) => {
  const response = await page.goto('/coffre/connexion')
  const policies = ((await response?.headersArray()) ?? []).filter(
    (header) => header.name.toLowerCase() === 'content-security-policy',
  )
  expect(policies).toHaveLength(1)
  const csp = policies[0]?.value ?? ''
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/)
  expect(csp).not.toContain("'unsafe-inline'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).not.toMatch(/https?:\/\//)

  // Chaque script du HTML servi porte le nonce de la réponse (les fichiers chargés ensuite le sont
  // par ces scripts : 'strict-dynamic').
  const nonce = csp.match(NONCE)?.[1]
  expect(nonce).toBeTruthy()
  const scripts = (await response?.text())?.match(/<script\b[^>]*>/g) ?? []
  expect(scripts.length).toBeGreaterThan(0)
  for (const script of scripts) expect(script).toContain(`nonce="${nonce}"`)

  // Un nonce neuf à chaque requête.
  const autre = (await request.get('/coffre/connexion')).headers()['content-security-policy']
  expect(autre?.match(NONCE)?.[1]).not.toBe(nonce)
})

test('aucune violation de la CSP sur les pages du coffre', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  for (const path of ['/coffre/connexion', '/coffre/verification']) {
    await page.goto(path, { waitUntil: 'networkidle' })
  }
  expect(violations).toEqual([])
})

test('sans session, /coffre mène à la connexion, sans passer par une langue', async ({ page }) => {
  await page.goto('/coffre')
  await expect(page).toHaveURL(/\/coffre\/connexion$/)
  await page.goto('/coffre/enrolement')
  await expect(page).toHaveURL(/\/coffre\/connexion$/)
})

test('le site public ne pose aucun cookie, même après une visite du coffre', async ({
  page,
  context,
}) => {
  await page.goto('/coffre/connexion')
  for (const path of ['/fr', '/en', '/fr/contact']) {
    await page.goto(path)
  }
  expect(await context.cookies()).toEqual([])
})

test('le coffre n’apparaît ni dans le sitemap, ni dans robots.txt, ni dans les pages', async ({
  request,
}) => {
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/coffre')
  expect(await (await request.get('/robots.txt')).text()).not.toContain('coffre')
  for (const path of ['/fr', '/en', '/fr/contact']) {
    expect(await (await request.get(path)).text(), path).not.toMatch(/href="\/coffre/)
  }
})

test('le gestionnaire d’authentification ne sert que sa liste fermée de routes', async ({
  request,
}) => {
  // Le gestionnaire interroge la base du coffre (schéma, limitation de débit).
  test.skip(!process.env.DATABASE_URL, 'DATABASE_URL absente : base du coffre non configurée')
  const response = await request.post('/coffre/api/auth/sign-up/email', {
    data: { name: 'Inconnu', email: 'inscription@exemple.test', password: 'phrase-factice-longue' },
  })
  expect(response.status()).toBe(404)
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')
})
