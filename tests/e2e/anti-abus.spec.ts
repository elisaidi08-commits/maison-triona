import { expect, test, type Page } from '@playwright/test'

// Anti-abus du formulaire (story 3.5, docs/architecture.md §6.7) : piège à robots, horodatage signé.
// Sans JavaScript, le premier envoi ne porte pas d'horodatage (la page est statique) ; la page
// d'erreurs en délivre un, qui contrôle le délai du suivant. La limitation de débit (Upstash) est
// inactive sans compte : elle est couverte par les tests unitaires.

const resume = (page: Page) => page.locator('#contact-erreurs')
const statut = (page: Page) => page.locator('#contact-statut')
const envoyer = (page: Page) => page.getByRole('button', { name: 'Envoyer', exact: true })

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('piège rempli, rejet silencieux ; sans horodatage ou trop tôt, « trop tôt »', async ({
    page,
  }) => {
    // Un robot remplit le piège : la réponse ressemble à un envoi, sans aucune vérification.
    await page.goto('/fr/contact')
    await page.locator('#contact-site').fill('https://exemple.test', { force: true })
    await envoyer(page).click()
    await expect(statut(page)).toContainText('ouvrira bientôt')
    await expect(resume(page)).toHaveCount(0)

    // Sans le piège ni horodatage (page statique) : « trop tôt », horodatage neuf, saisie gardée.
    await page.goto('/fr/contact')
    await page.locator('#contact-besoin-conciergerie').check()
    await page.locator('#contact-pays-BE').check()
    await page.locator('#contact-urgence-aucune').check()
    await page.locator('#contact-nom').fill('Camille Martin')
    await page.locator('#contact-email').fill('camille@example.com')
    await envoyer(page).click()
    await expect(statut(page)).toContainText('Patientez quelques secondes')
    await expect(resume(page)).toHaveCount(0)
    await expect(page.locator('#contact-nom')).toHaveValue('Camille Martin')
    const jeton = await page.locator('input[name="jeton"]').inputValue()
    expect(jeton).toMatch(/^\d{13}\./)

    // Renvoyée aussitôt, avec cet horodatage de moins de 3 secondes : encore refusée.
    await envoyer(page).click()
    await expect(statut(page)).toContainText('Patientez quelques secondes')
    await expect(page.locator('input[name="jeton"]')).toHaveValue(jeton)

    // Plus de 3 secondes après : la demande est vérifiée (le consentement manque).
    await page.waitForTimeout(3200)
    await envoyer(page).click()
    await expect(resume(page)).toContainText('Merci de cocher la case')
    await expect(page.locator('input[name="jeton"]')).toHaveValue(jeton)
  })
})

test('avec JavaScript : l’horodatage signé est demandé à l’affichage, sans rien saisir', async ({
  page,
}) => {
  await page.goto('/fr/contact')
  await expect(page.locator('input[name="jeton"]')).toHaveValue(/^\d{13}\.[A-Za-z0-9_-]{43}$/)
  // Le piège reste hors de la tabulation et des lecteurs d'écran.
  await expect(page.locator('#contact-site')).toHaveAttribute('tabindex', '-1')
  await expect(page.locator('#contact-site').locator('xpath=..')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
})

// Zod sondait `new Function` (compilation à la volée), refusé par la CSP du site : la violation
// apparaissait dans la console du contact. Mode sans compilation (`jitless`). Chrome écrit ces
// violations dans le journal de la console par le domaine `Log` de DevTools, pas par l'API
// `console` : on lit les deux, plus l'événement `securitypolicyviolation` de la page.
for (const adresse of ['/fr/contact', '/en/contact']) {
  test(`${adresse} : aucun message « Content Security Policy » dans la console`, async ({
    page,
  }) => {
    const messages: string[] = []
    page.on('console', (message) => messages.push(message.text()))
    const devtools = await page.context().newCDPSession(page)
    devtools.on('Log.entryAdded', ({ entry }) => messages.push(entry.text))
    await devtools.send('Log.enable')
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) =>
        console.error(`Content Security Policy : ${event.violatedDirective}`),
      )
    })

    await page.goto(adresse)
    const bouton = page.locator('form button[type="submit"]')
    await expect(bouton).toBeVisible()
    await expect(page.locator('input[name="jeton"]')).not.toHaveValue('')
    // Valider une étape fait passer Zod par un schéma d'objet, là où il sondait `new Function`.
    await bouton.click()
    await expect(page.locator('#contact-erreurs')).toBeFocused()
    expect(messages.filter((texte) => texte.includes('Content Security Policy'))).toEqual([])
  })
}
