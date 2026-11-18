import { expect, test } from '@playwright/test'

// En-têtes de sécurité (story 5.1, docs/architecture.md §9.1) sur toutes les routes : pages, 404,
// fichiers générés et médias.

const ROUTES = [
  '/fr',
  '/en/the-house',
  '/fr/services/grand-age',
  '/fr/adresse-inconnue',
  '/robots.txt',
  '/sitemap.xml',
  '/brand/og.png',
]

test('chaque route porte les en-têtes de sécurité', async ({ request }) => {
  for (const route of ROUTES) {
    const headers = (await request.get(route)).headers()
    const csp = headers['content-security-policy'] ?? ''
    expect(csp, route).toContain("default-src 'self'")
    expect(csp, route).toContain("frame-ancestors 'none'")
    expect(csp, route).toContain("object-src 'none'")
    expect(csp, route).not.toMatch(/https?:\/\//)
    expect(headers['strict-transport-security'], route).toContain('max-age=63072000')
    expect(headers['x-content-type-options'], route).toBe('nosniff')
    expect(headers['referrer-policy'], route).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy'], route).toContain('camera=()')
    expect(headers['cross-origin-opener-policy'], route).toBe('same-origin')
    expect(headers['x-frame-options'], route).toBe('DENY')
  }
})

test('la CSP ne bloque rien sur les pages riches en médias', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  for (const path of ['/fr', '/fr/services', '/fr/services/conciergerie', '/fr/territoires']) {
    await page.goto(path, { waitUntil: 'load' })
    await page.mouse.wheel(0, 2000)
    await page.waitForTimeout(400)
  }
  expect(violations).toEqual([])
})
