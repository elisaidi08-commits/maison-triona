import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Liens de réservation d'appel (story 3.10 ; docs/reservation-appel.md §4.4, §5), sans base : tout
// lien est alors sans valeur. Page sobre qui invite à écrire, identique quel que soit le lien (rien
// ne dit pourquoi), noindex, référent réduit à l’origine (jamais le jeton), jamais en cache, aucun cookie ; confirmation et fichier
// .ics refusés de même ; le sélecteur de langue garde le lien. Axe WCAG 2.2 AA, FR et EN.
// Le parcours complet, avec base et coffre, est dans reservation-parcours.spec.ts (ignoré par défaut).

const JETON = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
const AUTRE = 'zYxWvUtSrQpOnMlKjIhGfEdCbA9876543210_-edcba'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const TITRES = { fr: 'Ce lien n’est plus valable.', en: 'This link is no longer valid.' }

for (const locale of ['fr', 'en'] as const) {
  test(`/${locale} : lien sans valeur → page sobre, noindex, référent réduit à l’origine, sans cookie`, async ({
    page,
  }) => {
    const reponse = await page.goto(`/${locale}/contact/appel/${JETON}`)
    expect(reponse?.status()).toBe(200)
    const entetes = reponse!.headers()
    expect(entetes['referrer-policy']).toBe('strict-origin')
    expect(entetes['cache-control']).toContain('no-store')
    expect(entetes['x-robots-tag']).toContain('noindex')
    expect(entetes['set-cookie']).toBeUndefined()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    )
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITRES[locale])
    await expect(page.locator('main form')).toHaveCount(0)
    await expect(page.locator(`main a[href="/${locale}/contact"]`)).toBeVisible()
    // Rien ne parle du jeton, ni dans la page ni dans son HTML (attributs et données comprises),
    // hormis l'adresse elle-même (sélecteur de langue).
    await expect(page.locator('main')).not.toContainText(JETON)
    expect(await page.context().cookies()).toEqual([])

    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.length }))).toEqual([])
  })
}

test('tout lien sans valeur reçoit exactement la même page', async ({ page }) => {
  const contenu = async (chemin: string) => {
    await page.goto(chemin)
    // Sans les marqueurs de React (commentaires), qui suivent la profondeur des segments.
    return (await page.locator('main').innerHTML()).replace(/<!--.*?-->/g, '')
  }
  const reference = await contenu(`/fr/contact/appel/${JETON}`)
  for (const chemin of [
    `/fr/contact/appel/${AUTRE}`,
    '/fr/contact/appel/trop-court',
    `/fr/contact/appel/${JETON}A`,
    `/fr/contact/appel/${JETON}/confirmation`,
  ]) {
    expect(await contenu(chemin), chemin).toBe(reference)
  }
})

test('la confirmation et le fichier .ics d’un lien sans valeur sont refusés, sans cache', async ({
  request,
}) => {
  const confirmation = await request.get(`/en/contact/appel/${JETON}/confirmation`)
  expect(confirmation.status()).toBe(200)
  expect(confirmation.headers()['referrer-policy']).toBe('strict-origin')
  expect(await confirmation.text()).toContain(TITRES.en)

  const agenda = await request.get(`/fr/contact/appel/${JETON}/agenda`)
  expect(agenda.status()).toBe(404)
  expect(agenda.headers()['cache-control']).toContain('no-store')
  expect(agenda.headers()['referrer-policy']).toBe('strict-origin')
  expect(agenda.headers()['content-type'] ?? '').not.toContain('text/calendar')
  expect(await agenda.text()).toBe('')
})

test('un POST forgé vers la page ne réserve rien et ne révèle rien', async ({ request }) => {
  const reponse = await request.post(`/fr/contact/appel/${JETON}`, {
    form: { creneau: '2027-03-02T09:30:00.000Z', nom: 'Robot', telephone: '+32470000000' },
  })
  expect(reponse.status()).toBeLessThan(500)
  expect(await reponse.text()).not.toContain('Votre appel est convenu')
})

test('le sélecteur de langue garde le lien de réservation', async ({ page }) => {
  await page.goto(`/fr/contact/appel/${JETON}`)
  const en = page.getByRole('link', { name: /^EN/ }).first()
  await expect(en).toHaveAttribute('href', `/en/contact/appel/${JETON}`)
})

test('les pages de lien ne sont pas dans le sitemap', async ({ request }) => {
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/contact/appel')
})
