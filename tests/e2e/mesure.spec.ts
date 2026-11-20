import { expect, test } from '@playwright/test'

// Mesure d'audience (story 5.2), telle que la CI la construit : sans PLAUSIBLE_DOMAIN, le composant
// n'est pas rendu et rien ne part, ni vers notre route, ni vers un tiers. La route répond 204 sans
// rien dire de ce qu'elle a reçu. Le comportement avec Plausible configuré est couvert par les tests
// unitaires (tests/unit/mesure*.test.ts) et vérifié à la main (docs/mesure.md).

test('sans configuration : aucun envoi de mesure, ni page vue ni clic', async ({ page }) => {
  const envois: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/m' || url.hostname.includes('plausible')) envois.push(request.url())
  })
  await page.goto('/fr')
  await page.getByRole('link', { name: /Organiser le quotidien/ }).click()
  await page.waitForURL(/\/fr\/services\//)
  await page.waitForTimeout(300)
  expect(envois).toEqual([])
})

test('la route répond 204, sans corps, quoi qu’on lui envoie', async ({ request }) => {
  for (const data of ['{"e":"pageview","p":"/fr"}', 'pas du JSON', 'x'.repeat(5000)]) {
    const reponse = await request.post('/api/m', {
      data,
      headers: { 'Content-Type': 'text/plain' },
    })
    expect(reponse.status()).toBe(204)
    expect(await reponse.text()).toBe('')
  }
})
