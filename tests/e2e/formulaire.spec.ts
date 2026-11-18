import { expect, test, type Page } from '@playwright/test'

// Formulaire de contact (stories 3.1, 3.4 et 3.5, docs/architecture.md §6.1 et §6.7) : quatre
// étapes avec JavaScript, quatre parties à la suite sans, brouillon limité, présélection par le
// stockage de session (D26), mention d'urgence, consentement, anti-abus. L'envoi est fermé tant que
// le coffre n'existe pas : un envoi valide affiche « L'envoi des demandes ouvrira bientôt ».
// Next.js garde la page quittée dans le DOM, cachée : les sélecteurs de page filtrent `:visible`.

const MOT_LIBRE = 'Pour ma mère, à Namur.\nDe préférence en semaine, en fin de matinée.'
const BROUILLON_PERMIS = ['mt-draft-besoin', 'mt-draft-pays', 'mt-draft-langue', 'mt-draft-creneau']

const etapesVisibles = (page: Page) =>
  page.locator('form fieldset[aria-labelledby^="etape-"]:visible')
const titre = (page: Page, numero: number) => page.locator(`#etape-${numero}-titre`)
const resume = (page: Page) => page.locator('#contact-erreurs')
const statut = (page: Page) => page.locator('#contact-statut')
const continuer = (page: Page) => page.getByRole('button', { name: 'Continuer', exact: true })
const envoyer = (page: Page) => page.getByRole('button', { name: 'Envoyer', exact: true })

// Le bouton « Continuer » n'existe qu'une fois le formulaire hydraté.
async function ouvrirEnEtapes(page: Page, adresse = '/fr/contact') {
  await page.goto(adresse)
  await expect(continuer(page)).toBeVisible()
}

async function lireBrouillon(page: Page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(window.sessionStorage)))
}

test.describe('avec JavaScript', () => {
  test('une étape à la fois : titre qui reçoit le focus, progression, Retour, envoi fermé', async ({
    page,
  }) => {
    await ouvrirEnEtapes(page)
    await expect(etapesVisibles(page)).toHaveCount(1)
    await expect(titre(page, 1)).toHaveText('Étape 1 sur 4 · Votre besoin')
    const progression = page.locator('form fieldset:visible div[aria-hidden="true"] > .border-or')
    await expect(progression).toHaveCount(1)

    // Continuer sans rien choisir : rien ne part, le résumé reçoit le focus.
    await continuer(page).click()
    await expect(resume(page)).toBeFocused()
    await expect(resume(page)).toContainText('Un point à revoir')
    await expect(page.locator('#contact-besoin-error')).toHaveText(
      'Erreur : merci d’indiquer l’objet de votre demande.',
    )
    await resume(page).getByRole('link').click()
    await expect(page.locator('#contact-besoin-conciergerie')).toBeFocused()

    await page.locator('#contact-besoin-conciergerie').check()
    await continuer(page).click()
    await expect(titre(page, 2)).toBeFocused()
    await expect(titre(page, 2)).toHaveText('Étape 2 sur 4 · Pour qui, où, quand')
    await expect(etapesVisibles(page)).toHaveCount(1)
    await expect(progression).toHaveCount(2)
    await expect(resume(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Retour' }).click()
    await expect(titre(page, 1)).toBeFocused()
    await expect(page.locator('#contact-besoin-conciergerie')).toBeChecked()
    await continuer(page).click()

    await page.locator('#contact-pays-BE').check()
    await page.locator('#contact-urgence-aucune').check()
    await continuer(page).click()
    await expect(titre(page, 3)).toBeFocused()
    await expect(page.locator('#contact-langue-fr')).toBeChecked()
    await page.locator('#contact-nom').fill('Camille Martin')
    await page.locator('#contact-telephone').fill('+32 470 00 00 00')
    // Entrée dans un champ : comme « Continuer ».
    await page.locator('#contact-telephone').press('Enter')
    await expect(titre(page, 4)).toBeFocused()
    await expect(progression).toHaveCount(4)
    await expect(page.getByText('Inutile de nous donner des détails médicaux')).toBeVisible()

    await page.locator('#contact-consentement').check()
    await envoyer(page).click()
    await expect(statut(page)).toBeFocused()
    await expect(statut(page)).toHaveText(
      'L’envoi des demandes ouvrira bientôt ; rien n’a été enregistré ni envoyé.',
    )
    // Rien n'a été effacé de la saisie.
    await expect(page.locator('#contact-nom')).toHaveValue('Camille Martin')
    await expect(page).toHaveURL(/\/fr\/contact$/)
  })

  test('le brouillon ne garde que besoin, pays, langue et créneau, jamais le mot libre', async ({
    page,
  }) => {
    await ouvrirEnEtapes(page)
    await page.locator('#contact-besoin-enfants').check()
    await continuer(page).click()
    await page.locator('#contact-pour-qui-proche').check()
    await page.locator('#contact-pays-LU').check()
    await page.locator('#contact-urgence-semaines').check()
    await continuer(page).click()
    await page.locator('#contact-nom').fill('Camille Martin')
    await page.locator('#contact-email').fill('camille@example.com')
    await page.locator('#contact-creneau-soir').check()
    await page.locator('#contact-langue-en').check()
    await continuer(page).click()
    await page.locator('#contact-message').fill(MOT_LIBRE)
    await page.locator('#contact-origine-salon').check()
    await page.locator('#contact-consentement').check()

    const stockage = await lireBrouillon(page)
    const brouillon = Object.fromEntries(
      Object.entries(stockage).filter(([cle]) => cle.startsWith('mt-')),
    )
    expect(brouillon).toEqual({
      'mt-draft-besoin': 'enfants',
      'mt-draft-pays': 'LU',
      'mt-draft-creneau': 'soir',
      'mt-draft-langue': 'en',
    })
    const tout = JSON.stringify(stockage)
    for (const sensible of [
      'Namur',
      'Camille',
      'camille@example.com',
      'proche',
      'semaines',
      'salon',
    ]) {
      expect(tout).not.toContain(sensible)
    }

    // Revenir sur la page : le brouillon recoche les quatre champs, rien d'autre.
    await ouvrirEnEtapes(page)
    await expect(page.locator('#contact-besoin-enfants')).toBeChecked()
    await expect(page.locator('#contact-pays-LU')).toBeChecked()
    await expect(page.locator('#contact-creneau-soir')).toBeChecked()
    await expect(page.locator('#contact-langue-en')).toBeChecked()
    await expect(page.locator('#contact-pour-qui-proche')).not.toBeChecked()
    await expect(page.locator('#contact-urgence-semaines')).not.toBeChecked()
    await expect(page.locator('#contact-message')).toHaveValue('')

    // Demande traitée : le brouillon est effacé.
    await page.locator('#contact-besoin-enfants').check()
    await continuer(page).click()
    await page.locator('#contact-urgence-aucune').check()
    await continuer(page).click()
    await page.locator('#contact-nom').fill('Camille Martin')
    await page.locator('#contact-email').fill('camille@example.com')
    await continuer(page).click()
    await page.locator('#contact-consentement').check()
    await envoyer(page).click()
    await expect(statut(page)).toBeFocused()
    const apres = await lireBrouillon(page)
    expect(Object.keys(apres).filter((cle) => cle.startsWith('mt-draft-'))).toEqual([])
    for (const cle of Object.keys(apres)) expect(BROUILLON_PERMIS).not.toContain(cle)
  })

  test('« Urgent » affiche la mention des numéros d’urgence', async ({ page }) => {
    await ouvrirEnEtapes(page)
    await page.locator('#contact-besoin-indecis').check()
    await continuer(page).click()
    const mention = page.locator('[data-mention-urgence]')
    await expect(mention).toHaveCount(0)
    await page.locator('#contact-urgence-urgent').check()
    await expect(mention).toBeVisible()
    await expect(mention).toHaveText(
      'La maison n’est pas un service d’urgence. En cas d’urgence médicale, appelez le 112, ou le 15 en France, le 144 en Suisse.',
    )
    // Aucun lien « Situation urgente » (D41).
    await expect(page.locator('main a', { hasText: /urgen/i })).toHaveCount(0)
    await page.locator('#contact-urgence-semaines').check()
    await expect(mention).toHaveCount(0)
  })

  test('le consentement est requis', async ({ page }) => {
    await ouvrirEnEtapes(page)
    await page.locator('#contact-besoin-grand-age').check()
    await continuer(page).click()
    await page.locator('#contact-pays-CH').check()
    await page.locator('#contact-urgence-aucune').check()
    await continuer(page).click()
    await page.locator('#contact-nom').fill('Camille Martin')
    await page.locator('#contact-email').fill('camille@example.com')
    await continuer(page).click()
    await envoyer(page).click()
    await expect(resume(page)).toBeFocused()
    await expect(resume(page)).toContainText('Merci de cocher la case')
    await expect(page.locator('#contact-consentement-error')).toHaveText(
      'Erreur : merci de cocher la case pour que nous puissions vous répondre.',
    )
    await expect(page.locator('#contact-consentement')).toHaveAttribute('aria-invalid', 'true')
    await expect(statut(page)).toHaveCount(0)
  })

  test('étape 3 : un e-mail ou un téléphone, au moins', async ({ page }) => {
    await ouvrirEnEtapes(page)
    await page.locator('#contact-besoin-conciergerie').check()
    await continuer(page).click()
    await page.locator('#contact-pays-MC').check()
    await page.locator('#contact-urgence-aucune').check()
    await continuer(page).click()
    await page.locator('#contact-nom').fill('C')
    await continuer(page).click()
    await expect(resume(page)).toBeFocused()
    await expect(resume(page)).toContainText('2 points à revoir')
    await expect(page.locator('#contact-email-error')).toContainText('e‑mail ou un numéro')
    await expect(titre(page, 3)).toBeVisible()
  })
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('les quatre parties à la suite ; l’envoi montre les erreurs et garde les valeurs', async ({
    page,
  }) => {
    await page.goto('/fr/contact')
    const parties = page.locator('form fieldset[aria-labelledby^="etape-"]')
    await expect(parties).toHaveCount(4)
    for (const partie of await parties.all()) await expect(partie).toBeVisible()
    await expect(continuer(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retour' })).toHaveCount(0)

    await page.locator('#contact-nom').fill('Camille Martin')
    await page.locator('#contact-pays-FR').check()
    await page.locator('#contact-creneau-matin').check()
    await page.locator('#contact-message').fill(MOT_LIBRE)
    await envoyer(page).click()

    await expect(resume(page)).toBeVisible()
    await expect(resume(page)).toContainText('4 points à revoir')
    await expect(resume(page).locator('a')).toHaveText([
      'Merci d’indiquer l’objet de votre demande.',
      'Merci d’indiquer si votre demande est urgente.',
      'Merci d’indiquer une adresse e‑mail ou un numéro de téléphone.',
      'Merci de cocher la case pour que nous puissions vous répondre.',
    ])
    await expect(page.locator('#contact-urgence-error')).toContainText('Erreur :')
    // Aucune ressaisie (WCAG 3.3.7).
    await expect(page.locator('#contact-nom')).toHaveValue('Camille Martin')
    await expect(page.locator('#contact-pays-FR')).toBeChecked()
    await expect(page.locator('#contact-creneau-matin')).toBeChecked()
    await expect(page.locator('#contact-langue-fr')).toBeChecked()
    await expect(page.locator('#contact-message')).toHaveValue(MOT_LIBRE)

    // Corrigé, puis envoyé : envoi fermé.
    await page.locator('#contact-besoin-enfants').check()
    await page.locator('#contact-urgence-aucune').check()
    await page.locator('#contact-email').fill('camille@example.com')
    await page.locator('#contact-consentement').check()
    await envoyer(page).click()
    await expect(statut(page)).toHaveText(
      'L’envoi des demandes ouvrira bientôt ; rien n’a été enregistré ni envoyé.',
    )
    await expect(resume(page)).toHaveCount(0)
    await expect(page.locator('#contact-message')).toHaveValue(MOT_LIBRE)
  })

  test('« Urgent » montre la mention, même sans JavaScript', async ({ page }) => {
    await page.goto('/fr/contact')
    const mention = page.locator('[data-mention-urgence]')
    await expect(mention).toBeHidden()
    await page.locator('#contact-urgence-urgent').check()
    await expect(mention).toBeVisible()
    await page.locator('#contact-urgence-aucune').check()
    await expect(mention).toBeHidden()
  })
})

test('la page anglaise a le même formulaire', async ({ page }) => {
  await page.goto('/en/contact')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible()
  await expect(titre(page, 1)).toHaveText('Step 1 of 4 · Your need')
  await expect(page.locator('#contact-langue-en')).toBeChecked()
  await expect(page.locator('input[name="locale"]')).toHaveValue('en')
})
