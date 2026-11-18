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
  // Hors liste : 404 avant Better Auth, sans secret ni base.
  const response = await request.post('/coffre/api/auth/sign-up/email', {
    data: { name: 'Inconnu', email: 'inscription@exemple.test', password: 'phrase-factice-longue' },
  })
  expect(response.status()).toBe(404)
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')
})

test('une adresse du coffre avec un point reçoit aussi la CSP du coffre', async ({ request }) => {
  const response = await request.get('/coffre/fichier.txt')
  const csp = response.headers()['content-security-policy'] ?? ''
  expect(csp).toMatch(NONCE)
  expect(csp).not.toContain("'unsafe-inline'")
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')
})

// Les sélecteurs de texte de Playwright ignorent le contenu des <noscript> : on lit le texte rendu
// de <main> (innerText), qui ne contient la phrase que si JavaScript est coupé.
test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('le coffre le dit sobrement', async ({ page }) => {
    await page.goto('/coffre/connexion')
    expect(await page.locator('main').innerText()).toContain('Le coffre demande JavaScript.')
  })
})

// Conservation planifiée (story 3.2, partie D) : sans le secret de Vercel Cron, rien ne s'exécute.
// Le serveur de test n'a pas de CRON_SECRET : tout appel est refusé, sans base.
test('la tâche de conservation refuse tout appel sans le secret', async ({ request }) => {
  const essais: Record<string, string>[] = [
    {},
    { authorization: 'Bearer ' },
    { authorization: 'Bearer secret-factice-de-la-tache-0123456789abcdef' },
  ]
  for (const headers of essais) {
    const response = await request.get('/api/cron/retention', { headers })
    expect(response.status(), JSON.stringify(headers)).toBe(401)
    expect(response.headers()['cache-control']).toContain('no-store')
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')
    expect(await response.text()).toBe('Unauthorized')
  }
  expect((await request.post('/api/cron/retention')).status()).toBe(405)
})

// Lecture déchiffrée (story 3.2, partie D) : libsodium s'exécute en WebAssembly dans le navigateur,
// d'où 'wasm-unsafe-eval' dans la CSP du coffre, et dans elle seule.
const CSP_PUBLIQUE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

test('la CSP du coffre autorise WebAssembly, et seulement lui', async ({ request }) => {
  for (const path of ['/coffre/connexion', '/coffre/demandes/pas-un-identifiant']) {
    const csp = (await request.get(path)).headers()['content-security-policy'] ?? ''
    const scriptSrc = csp.split('; ').find((directive) => directive.startsWith('script-src '))
    expect(scriptSrc, path).toMatch(
      /^script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic' 'wasm-unsafe-eval'$/,
    )
    expect(csp.match(/wasm-unsafe-eval/g), path).toHaveLength(1)
    expect(csp.replace("'wasm-unsafe-eval'", ''), path).not.toContain('unsafe-eval')
  }
})

test('la CSP du site public ne change pas : ni WebAssembly ni nonce', async ({ request }) => {
  for (const path of ['/fr', '/en', '/fr/contact', '/api/cron/retention', '/fr/adresse-inconnue']) {
    const csp = (await request.get(path)).headers()['content-security-policy']
    expect(csp, path).toBe(CSP_PUBLIQUE)
  }
})

test('une demande mal formée répond 404, sans citer l’identifiant', async ({ page }) => {
  const identifiant = 'pas-un-identifiant-temoin'
  const response = await page.goto(`/coffre/demandes/${identifiant}`)
  expect(response?.status()).toBe(404)
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Introuvable')
  expect(await page.locator('main').innerText()).not.toContain(identifiant)
  await expect(page).toHaveTitle(/Coffre · Maison Triona/)
  expect(await page.title()).not.toContain(identifiant)
})

test('sans session, une demande bien formée mène à la connexion, sans rien lire', async ({
  page,
}) => {
  await page.goto('/coffre/demandes/6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b')
  await expect(page).toHaveURL(/\/coffre\/connexion$/)
})
