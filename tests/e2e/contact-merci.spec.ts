import { expect, test } from '@playwright/test'

// Remerciement après un envoi (story 3.2, partie B ; docs/architecture.md §6.1, étape 5) : noindex
// posé par la page elle-même (même le jour où le site devient indexable), hors du sitemap, aucun
// écho de la demande (page statique : ni paramètre ni état lus), brouillon du formulaire effacé.
// Sans coffre configuré, un envoi valide reste « ouvrira bientôt » (formulaire.spec.ts).

const ECHO = {
  nom: 'Camille Écho-Factice',
  email: 'camille.echo@example.test',
  telephone: '+32470000001',
  message: 'mot-libre-echo-factice',
}

for (const [locale, titre, delai] of [
  ['fr', 'Merci, votre demande est bien arrivée.', 'sous 48 heures ouvrées'],
  ['en', 'Thank you, your request has arrived safely.', 'within 48 working hours'],
] as const) {
  test(`/${locale}/contact/merci : noindex, délai de réponse, aucun écho`, async ({ page }) => {
    const reponse = await page.goto(`/${locale}/contact/merci?${new URLSearchParams(ECHO)}`)
    expect(reponse?.status()).toBe(200)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    )
    await expect(page).toHaveTitle(/ · Maison Triona$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titre)
    await expect(page.locator('main')).toContainText(delai)

    // Rien de la demande, ni dans la page ni dans son HTML (attributs et données comprises).
    const html = await page.content()
    for (const valeur of Object.values(ECHO)) expect(html).not.toContain(valeur)
    await expect(page.locator('main :is(form, input, textarea, select)')).toHaveCount(0)
  })
}

test('le remerciement efface le brouillon du formulaire', async ({ page }) => {
  await page.goto('/fr/contact')
  await page.evaluate(() => {
    window.sessionStorage.setItem('mt-draft-besoin', 'enfants')
    window.sessionStorage.setItem('mt-draft-pays', 'BE')
  })
  await page.goto('/fr/contact/merci')
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(window.sessionStorage).filter((cle) => cle.startsWith('mt-draft-')),
      ),
    )
    .toEqual([])
})

test('le remerciement n’est pas dans le sitemap', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).not.toContain('/contact/merci')
})
