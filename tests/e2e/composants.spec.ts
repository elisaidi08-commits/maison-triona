import { expect, test } from '@playwright/test'

// Story 1.6 : composants de la refonte V3, sur le banc d'essai (/fr/demo).

test.beforeEach(async ({ page }) => {
  await page.goto('/fr/demo')
})

test('choix en lignes : les flèches cochent l’option suivante, l’espace coche une case', async ({
  page,
}) => {
  await expect(page.locator('#demo-besoin-grand-age')).toBeChecked()
  await page.focus('#demo-besoin-grand-age')
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#demo-besoin-enfants')).toBeFocused()
  await expect(page.locator('#demo-besoin-enfants')).toBeChecked()

  await page.focus('#demo-jours-lundi')
  await page.keyboard.press('Space')
  await expect(page.locator('#demo-jours-lundi')).toBeChecked()
})

test('choix en lignes : toute la ligne est cliquable et fait au moins 56 px', async ({ page }) => {
  await page.locator('#demo-besoin').getByText('Prendre soin des enfants', { exact: true }).click()
  await expect(page.locator('#demo-besoin-enfants')).toBeChecked()
  for (const label of await page.locator('#demo-besoin label').all()) {
    const box = await label.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(56)
  }
})

test('groupe en erreur : message lié au fieldset et options signalées', async ({ page }) => {
  const groupe = page.locator('fieldset#demo-pays')
  await expect(groupe).toHaveAttribute('aria-describedby', 'demo-pays-error')
  await expect(page.locator('#demo-pays-error')).toContainText('Erreur :')
  await expect(page.locator('#demo-pays-BE')).toHaveAttribute('aria-invalid', 'true')
})

test('résumé d’erreurs : chaque lien place le focus sur son champ', async ({ page }) => {
  await page.locator('#demo-erreurs a[href="#demo-pays-BE"]').click()
  await expect(page.locator('#demo-pays-BE')).toBeFocused()
  await expect(page.locator('#demo-pays legend')).toBeInViewport()

  await page.locator('#demo-erreurs a[href="#demo-email"]').click()
  await expect(page.locator('#demo-email')).toBeFocused()
})

test('tête d’étape : un seul titre focalisable qui dit l’étape et son nom', async ({ page }) => {
  const titre = page.locator('#demo-etape')
  await expect(titre).toHaveAttribute('tabindex', '-1')
  await expect(titre).toHaveAccessibleName(/Étape 2 sur 4.*Votre situation/)
})

test('boutons : envoi en cours signalé inerte, bouton désactivé natif', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Envoi en cours' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Envoyer ma demande' })).toBeDisabled()
})

test('sommaire : le chapitre en cours est marqué et son ancre mène au titre', async ({ page }) => {
  const sommaire = page.getByRole('navigation', { name: 'Sommaire' })
  await expect(sommaire.locator('[aria-current="location"]')).toHaveText(
    /Une philosophie d’accueil/,
  )
  await expect(page.locator('#demo-accueil-titre')).toHaveAttribute('tabindex', '-1')
})
