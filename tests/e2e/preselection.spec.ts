import { expect, test, type Page } from '@playwright/test'

// Présélection du besoin (story 3.4, D26) : rien dans l'URL. Un lien `data-besoin` (pages de
// service, choix de l'accueil) retient le besoin dans le stockage de session ; le formulaire de
// contact le coche à son affichage. Valeur inconnue : ignorée, sans erreur.

const continuer = (page: Page) => page.getByRole('button', { name: 'Continuer', exact: true })
const resume = (page: Page) => page.locator('#contact-erreurs')

async function ouvrirEnEtapes(page: Page, adresse = '/fr/contact') {
  await page.goto(adresse)
  await expect(continuer(page)).toBeVisible()
}

async function lireBrouillon(page: Page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(window.sessionStorage)))
}

test('depuis une page de service : le besoin est coché, rien dans l’URL', async ({ page }) => {
  await page.goto('/fr/services/grand-age')
  const lien = page.locator('main a[data-besoin="grand-age"]:visible').first()
  await expect(lien).toHaveAttribute('href', '/fr/contact')
  await lien.click()
  await expect(page).toHaveURL(/\/fr\/contact$/)
  await expect(continuer(page)).toBeVisible()
  await expect(page.locator('#contact-besoin-grand-age')).toBeChecked()
  expect((await lireBrouillon(page))['mt-draft-besoin']).toBe('grand-age')
})

test('depuis l’accueil : « Évoquer une demande particulière »', async ({ page }) => {
  await page.goto('/fr')
  await page.getByRole('link', { name: /Évoquer une demande particulière/ }).click()
  await expect(page).toHaveURL(/\/fr\/contact$/)
  await expect(continuer(page)).toBeVisible()
  await expect(page.locator('#contact-besoin-indecis')).toBeChecked()
})

test('les quatre besoins, et une valeur inconnue ignorée sans erreur', async ({ page }) => {
  await page.goto('/fr/contact')
  for (const besoin of ['conciergerie', 'grand-age', 'enfants', 'indecis']) {
    await page.evaluate((valeur) => sessionStorage.setItem('mt-draft-besoin', valeur), besoin)
    await ouvrirEnEtapes(page)
    await expect(page.locator(`#contact-besoin-${besoin}`)).toBeChecked()
  }
  await page.evaluate(() => sessionStorage.setItem('mt-draft-besoin', 'inconnu'))
  await ouvrirEnEtapes(page)
  await expect(page.locator('input[name="besoin"]:checked')).toHaveCount(0)
  await expect(resume(page)).toHaveCount(0)
})

test('chaque page de service présélectionne son besoin, bloc Contact compris', async ({ page }) => {
  for (const [adresse, besoin] of [
    ['/fr/services/conciergerie', 'conciergerie'],
    ['/fr/services/enfants', 'enfants'],
    ['/en/services/later-life', 'grand-age'],
  ] as const) {
    await page.goto(adresse)
    const liens = page.locator('main a[href$="/contact"]:visible')
    await expect(liens).toHaveCount(2)
    for (const lien of await liens.all()) await expect(lien).toHaveAttribute('data-besoin', besoin)
  }
})

test('l’accueil : chaque choix d’entrée retient son besoin', async ({ page }) => {
  await page.goto('/fr')
  const besoins = await page
    .locator('main a[data-besoin]:visible')
    .evaluateAll((liens) => liens.map((lien) => lien.getAttribute('data-besoin')))
  expect(besoins.slice(0, 4)).toEqual(['conciergerie', 'grand-age', 'enfants', 'indecis'])
})
