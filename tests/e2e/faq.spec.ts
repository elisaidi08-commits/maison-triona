import { expect, test } from '@playwright/test'

// FAQ (story 2.8) : huit questions en <details> natifs, une ancre par question, clavier, sans
// JavaScript, impression.

test('la FAQ présente huit questions fermées, dans les deux langues', async ({ page }) => {
  for (const path of ['/fr/faq', '/en/faq']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('[data-faq] details')).toHaveCount(8)
    await expect(page.locator('[data-faq] details[open]')).toHaveCount(0)
  }
})

test('une question s’ouvre et se ferme au clavier', async ({ page }) => {
  await page.goto('/fr/faq')
  const summary = page.locator('[data-faq] summary').first()
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-faq] details').first()).toHaveAttribute('open', '')
  await page.keyboard.press('Space')
  await expect(page.locator('[data-faq] details').first()).not.toHaveAttribute('open', '')
})

test('l’ancre d’une question l’ouvre à l’arrivée', async ({ page }) => {
  await page.goto('/fr/faq#delai')
  await expect(page.locator('details#delai')).toHaveAttribute('open', '')
  await expect(page.locator('details#delai p')).toContainText('48')
})

test('sans JavaScript, toutes les réponses sont dans la page', async ({ request }) => {
  const html = await (await request.get('/fr/faq')).text()
  expect(html.match(/<details id=/g)).toHaveLength(8)
  expect(html).toContain('Vous ne payez rien à la maison.')
})

test('à l’impression, toutes les réponses sont ouvertes', async ({ page }) => {
  await page.goto('/fr/faq')
  await page.emulateMedia({ media: 'print' })
  for (const answer of await page.locator('[data-faq] details p').all()) {
    await expect(answer).toBeVisible()
  }
})
