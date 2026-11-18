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

  test('anti-abus : piège rempli, rejet silencieux ; renvoi trop rapide, refusé', async ({
    page,
  }) => {
    // Un robot remplit le piège : la réponse ressemble à un envoi, sans aucune vérification.
    await page.goto('/fr/contact')
    await page.locator('#contact-site').fill('https://exemple.test', { force: true })
    await envoyer(page).click()
    await expect(statut(page)).toContainText('ouvrira bientôt')
    await expect(resume(page)).toHaveCount(0)

    // Sans le piège, le même formulaire vide est vérifié.
    await page.goto('/fr/contact')
    await envoyer(page).click()
    await expect(resume(page)).toBeVisible()

    // La page d'erreurs porte un horodatage signé : renvoyée aussitôt, la demande est refusée.
    await page.locator('#contact-besoin-conciergerie').check()
    await page.locator('#contact-pays-BE').check()
    await page.locator('#contact-urgence-aucune').check()
    await page.locator('#contact-nom').fill('Camille Martin')
    await page.locator('#contact-email').fill('camille@example.com')
    await page.locator('#contact-consentement').check()
    await envoyer(page).click()
    await expect(statut(page)).toContainText('Patientez quelques secondes')
    await expect(page.locator('#contact-nom')).toHaveValue('Camille Martin')
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
