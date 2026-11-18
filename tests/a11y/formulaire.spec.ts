import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Formulaire de contact (story 3.1) : axe, WCAG 2.2 AA, dans ses états d'erreur et de réponse,
// avec et sans JavaScript, en français et en anglais.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function sansViolation(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    results.violations.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.length })),
  ).toEqual([])
}

for (const [locale, continuer] of [
  ['fr', 'Continuer'],
  ['en', 'Continue'],
] as const) {
  test(`axe : /${locale}/contact, erreurs d’étape et mention d’urgence`, async ({ page }) => {
    await page.goto(`/${locale}/contact`)
    const bouton = page.getByRole('button', { name: continuer, exact: true })
    await expect(bouton).toBeVisible()
    await bouton.click()
    await expect(page.locator('#contact-erreurs')).toBeFocused()
    await sansViolation(page)

    await page.locator('#contact-besoin-enfants').check()
    await bouton.click()
    await page.locator('#contact-urgence-urgent').check()
    await expect(page.locator('[data-mention-urgence]')).toBeVisible()
    await bouton.click()
    await expect(page.locator('#contact-erreurs')).toBeFocused()
    await sansViolation(page)
  })
}

// Sans JavaScript, axe ne peut pas s'exécuter dans la page : la page d'erreurs renvoyée par le
// serveur est rejouée, sans ses scripts, dans une page qui en a.
for (const [locale, envoyer] of [
  ['fr', 'Envoyer'],
  ['en', 'Send'],
] as const) {
  test(`axe : /${locale}/contact sans JavaScript, toutes les erreurs après l’envoi`, async ({
    browser,
    baseURL,
    page,
  }) => {
    const contexte = await browser.newContext({ javaScriptEnabled: false, baseURL })
    const sansScript = await contexte.newPage()
    await sansScript.goto(`/${locale}/contact`)
    await sansScript.locator('#contact-nom').fill('C')
    await sansScript.locator('#contact-email').fill('pas-une-adresse')
    await sansScript.locator('#contact-urgence-urgent').check()
    // Premier envoi : « trop tôt » (page statique, sans horodatage) ; le second est vérifié.
    const bouton = sansScript.getByRole('button', { name: envoyer, exact: true })
    await bouton.click()
    await expect(sansScript.locator('#contact-statut')).toBeVisible()
    await sansScript.waitForTimeout(3200)
    await bouton.click()
    await expect(sansScript.locator('#contact-erreurs li')).toHaveCount(5)
    const html = (await sansScript.content()).replace(/<script\b[\s\S]*?<\/script>/g, '')
    await contexte.close()

    await page.goto(`/${locale}/contact`)
    await page.setContent(html)
    await expect(page.locator('#contact-erreurs')).toBeVisible()
    await sansViolation(page)
  })
}
