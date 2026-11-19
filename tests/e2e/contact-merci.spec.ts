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

    // Cachet « K. » Light, 64 px dès 1024 px (story 3.3) : décoratif, dernier élément de la colonne, après le
    // lien de retour, sur l'axe gauche, avec 64 px d'air au-dessus.
    const texte = page.locator('main h1').locator('xpath=..')
    const cachet = texte.locator('xpath=..').locator(':scope > :last-child > [aria-hidden="true"]')
    await expect(cachet).toHaveText('K.')
    await expect(cachet).toHaveCSS('font-size', '64px')
    await expect(cachet).toHaveCSS('font-weight', '300')
    const retour = await texte.locator(':scope > :last-child').boundingBox()
    const boite = await cachet.boundingBox()
    const boiteTitre = await page.locator('main h1').boundingBox()
    expect(Math.round((boite?.y ?? 0) - ((retour?.y ?? 0) + (retour?.height ?? 0)))).toBe(64)
    expect(boite?.x).toBe(boiteTitre?.x)

    // Rien de la demande, ni dans la page ni dans son HTML (attributs et données comprises).
    const html = await page.content()
    for (const valeur of Object.values(ECHO)) expect(html).not.toContain(valeur)
    await expect(page.locator('main :is(form, input, textarea, select)')).toHaveCount(0)
  })
}

// Cachet sur mobile : 48 px, toujours Light.
for (const locale of ['fr', 'en'] as const) {
  test(`/${locale}/contact/merci : cachet de 48 px en Light (390 px)`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${locale}/contact/merci`)
    const cachet = page.locator('main [aria-hidden="true"]', { hasText: /^K\.$/ })
    await expect(cachet).toHaveCSS('font-size', '48px')
    await expect(cachet).toHaveCSS('font-weight', '300')
  })
}

// Après l'envoi, plus de barre « Écrire en toute discrétion » : la demande vient d'être écrite.
// Témoin : la barre est bien là sur l'accueil de la même langue.
for (const locale of ['fr', 'en'] as const) {
  test(`/${locale}/contact/merci : pas de barre mobile (390 px)`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${locale}`)
    await expect(page.locator('[data-barre-mobile]')).toBeVisible()
    await page.goto(`/${locale}/contact/merci`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('[data-barre-mobile]')).toHaveCount(0)
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
