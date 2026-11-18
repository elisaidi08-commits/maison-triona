import { expect, test } from '@playwright/test'

// Partage familial (story 2.11) : `mailto:` prérempli dans la langue de la page, « Copier le lien »
// annoncé, rien de tiers, sans JavaScript l'e-mail reste ; à l'impression, seul le contenu reste.

test('« Envoyer à un proche » prépare un e-mail dans la langue de la page', async ({ page }) => {
  for (const [path, word] of [
    ['/fr/faq', 'intéresser'],
    ['/en/services/childcare', 'interest you'],
  ] as const) {
    await page.goto(path)
    const href = (await page.locator('[data-share] a[href^="mailto:"]').getAttribute('href'))!
    const body = decodeURIComponent(href.split('body=')[1] ?? '')
    expect(body, path).toContain(word)
    expect(body, path).toContain(path)
    expect(decodeURIComponent(href), path).toContain('· Maison Triona')
  }
})

test('« Copier le lien » copie l’adresse et l’annonce', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/fr/comment-ca-se-passe')
  await page.getByRole('button', { name: 'Copier le lien' }).click()
  await expect(page.locator('[data-share] [role="status"]')).toHaveText('Lien copié.')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /\/fr\/comment-ca-se-passe$/,
  )
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('l’e-mail reste, le bouton de copie n’apparaît pas', async ({ page }) => {
    await page.goto('/fr/services/grand-age')
    await expect(page.locator('[data-share] a[href^="mailto:"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copier le lien' })).toHaveCount(0)
  })
})

test('à l’impression, en-tête, pied de page, partage et contact disparaissent', async ({
  page,
}) => {
  await page.goto('/fr/faq')
  await page.emulateMedia({ media: 'print' })
  for (const selector of ['body > header', 'footer', '[data-share]', '[data-surface="sapin"]']) {
    await expect(page.locator(selector).first(), selector).toBeHidden()
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
