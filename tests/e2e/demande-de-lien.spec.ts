import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demande d'un lien de réservation d'appel (story 3.9 ; docs/reservation-appel.md §2, §4.4), sur le
// serveur de la suite, sans base : la demande reste « fermée » (rien n'est enregistré ni envoyé).
// Pages FR et EN aux chemins localisés, noindex, sans cookie ; sans JavaScript, POST natif : premier
// envoi « trop tôt » (page statique, D68), puis erreurs annoncées et saisie conservée ; piège à robots
// rejeté en silence ; réponse « Un lien vient de vous être envoyé » ; lien sans valeur qui mène à la
// demande. Axe WCAG 2.2 AA en FR et EN (aussi dans tests/a11y/pages.spec.ts). Le parcours avec base,
// e-mail capturé et limites prouvées est dans demande-de-lien-parcours.spec.ts.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const JETON = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'

const PAGES = {
  fr: {
    demande: '/fr/contact/appel',
    envoye: '/fr/contact/appel/envoye',
    titre: 'Convenons d’un appel.',
    envoyeTitre: 'Un lien vient de vous être envoyé.',
    bouton: 'Recevoir mon lien',
    champ: 'Votre adresse e‑mail',
  },
  en: {
    demande: '/en/contact/call',
    envoye: '/en/contact/call/sent',
    titre: 'Let us arrange a call.',
    envoyeTitre: 'A link has just been sent to you.',
    bouton: 'Send me my link',
    champ: 'Your email address',
  },
} as const

const statut = (page: Page) => page.locator('#lien-statut')
const resume = (page: Page) => page.locator('#lien-erreurs')

for (const locale of ['fr', 'en'] as const) {
  const p = PAGES[locale]

  test(`${p.demande} : une adresse, un bouton ; noindex, sans cookie, axe`, async ({ page }) => {
    const reponse = await page.goto(p.demande)
    expect(reponse?.status()).toBe(200)
    expect(reponse!.headers()['set-cookie']).toBeUndefined()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.titre)
    const champ = page.getByLabel(p.champ)
    await expect(champ).toHaveAttribute('type', 'email')
    await expect(champ).toHaveAttribute('autocomplete', 'email')
    await expect(page.locator('main form input:not([type="hidden"])')).toHaveCount(2)
    // Le piège reste hors de la tabulation et des lecteurs d'écran.
    const piege = page.locator('#lien-reference')
    await expect(piege).toHaveAttribute('tabindex', '-1')
    await expect(piege.locator('xpath=..')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('input[name="jeton"]')).toHaveValue(/^\d{13}\./)
    // Cible du bouton : 48 px au moins.
    const boite = await page.getByRole('button', { name: p.bouton }).boundingBox()
    expect(boite?.height ?? 0).toBeGreaterThanOrEqual(48)
    expect(await page.context().cookies()).toEqual([])

    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.length }))).toEqual([])
  })

  test(`${p.envoye} : la réponse, noindex, sans cookie, axe`, async ({ page }) => {
    const reponse = await page.goto(p.envoye)
    expect(reponse?.status()).toBe(200)
    expect(reponse!.headers()['set-cookie']).toBeUndefined()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.envoyeTitre)
    await expect(page.locator('main')).toContainText('48')
    await expect(page.locator('main form')).toHaveCount(0)
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.length }))).toEqual([])
  })
}

test('les chemins se répondent d’une langue à l’autre', async ({ page }) => {
  await page.goto('/en/contact/appel')
  await expect(page).toHaveURL(/\/en\/contact\/call$/)
  await page.goto('/fr/contact/call')
  await expect(page).toHaveURL(/\/fr\/contact\/appel$/)
  // Les liens personnels gardent leur chemin dans les deux langues (story 3.10).
  const reponse = await page.goto(`/en/contact/appel/${JETON}`)
  expect(reponse?.url()).toMatch(new RegExp(`/en/contact/appel/${JETON}$`))
})

test('un lien sans valeur propose d’en recevoir un nouveau', async ({ page }) => {
  await page.goto(`/fr/contact/appel/${JETON}`)
  await page.getByRole('link', { name: 'Recevoir un nouveau lien' }).click()
  await expect(page).toHaveURL(/\/fr\/contact\/appel$/)
  await page.goto(`/en/contact/appel/${JETON}`)
  await expect(page.getByRole('link', { name: 'Send me a new link' })).toHaveAttribute(
    'href',
    '/en/contact/call',
  )
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('trop tôt, puis erreurs annoncées et saisie conservée, puis « ouvrira bientôt »', async ({
    page,
  }) => {
    await page.goto('/fr/contact/appel')
    const envoyer = page.getByRole('button', { name: 'Recevoir mon lien' })
    // Premier envoi, sans horodatage (page statique) : « trop tôt », un horodatage neuf.
    await page.getByLabel('Votre adresse e‑mail').fill('camille@')
    await envoyer.click()
    await expect(statut(page)).toContainText('Patientez quelques secondes')
    await expect(page.getByLabel('Votre adresse e‑mail')).toHaveValue('camille@')
    await expect(page.locator('input[name="jeton"]')).toHaveValue(/^\d{13}\./)

    // Plus de 3 secondes après : l'adresse est vérifiée ; l'erreur est annoncée, près du champ.
    await page.waitForTimeout(3200)
    await envoyer.click()
    await expect(resume(page)).toContainText('Merci d’indiquer une adresse e‑mail valide.')
    await expect(page.locator('#lien-email-error')).toHaveText(
      'Erreur : merci d’indiquer une adresse e‑mail valide.',
    )
    await expect(page.getByLabel('Votre adresse e‑mail')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Votre adresse e‑mail')).toHaveValue('camille@')

    await page.getByLabel('Votre adresse e‑mail').fill('')
    await envoyer.click()
    await expect(resume(page)).toContainText('Merci d’indiquer votre adresse e‑mail.')

    // Adresse valable, sans base : fermé, rien n'est enregistré ni envoyé.
    await page.getByLabel('Votre adresse e‑mail').fill('camille@exemple.test')
    await envoyer.click()
    await expect(statut(page)).toContainText('ouvrira bientôt')
    await expect(resume(page)).toHaveCount(0)
    expect(await page.context().cookies()).toEqual([])
  })

  test('piège rempli : rejet silencieux, la même réponse que tout autre envoi', async ({
    page,
  }) => {
    await page.goto('/en/contact/call')
    await page.locator('#lien-reference').fill('https://exemple.test', { force: true })
    await page.getByLabel('Your email address').fill('robot@exemple.test')
    await page.getByRole('button', { name: 'Send me my link' }).click()
    // Sans base, la demande est fermée : le robot reçoit ce que reçoit tout visiteur.
    await expect(statut(page)).toContainText('You will soon be able to arrange a call')
    await expect(resume(page)).toHaveCount(0)
  })
})

test('avec JavaScript : l’erreur reçoit le focus, sans rechargement', async ({ page }) => {
  await page.goto('/fr/contact/appel')
  await expect(page.locator('input[name="jeton"]')).toHaveValue(/^\d{13}\./)
  await page.waitForTimeout(3200)
  await page.getByRole('button', { name: 'Recevoir mon lien' }).click()
  await expect(resume(page)).toBeFocused()
  await expect(resume(page)).toContainText('Merci d’indiquer votre adresse e‑mail.')
})
