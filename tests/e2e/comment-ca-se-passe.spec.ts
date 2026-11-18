import { expect, test } from '@playwright/test'

// « Comment ça se passe » et sa version en langage simple (story 2.9). Après une navigation interne,
// Next.js garde la page quittée dans le DOM, cachée : on ne compte que ce qui est visible.

test('la page présente les six étapes et mène à la version simple et à la FAQ', async ({
  page,
}) => {
  await page.goto('/fr/comment-ca-se-passe')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Comment ça se passe')
  await expect(page.locator('#deroule:visible ol > li')).toHaveCount(6)
  await expect(page.getByRole('link', { name: 'Questions fréquentes' }).first()).toHaveAttribute(
    'href',
    '/fr/faq',
  )
  await page.getByRole('link', { name: 'Lire la version en langage simple' }).click()
  await expect(page).toHaveURL('/fr/comment-ca-se-passe/langage-simple')
  await expect(page.locator('main ol:visible > li')).toHaveCount(7)
  await page.getByRole('link', { name: 'Lire la version complète' }).click()
  await expect(page).toHaveURL('/fr/comment-ca-se-passe')
})

test('les pages de service mènent au déroulé complet', async ({ page }) => {
  await page.goto('/en/services/later-life')
  await page.getByRole('link', { name: 'The whole process, on one page' }).click()
  await expect(page).toHaveURL('/en/how-it-works')
  await expect(page.locator('#deroule:visible')).toContainText('within 48 working hours')
})

test('sans JavaScript, les deux pages sont complètes', async ({ request }) => {
  const full = await (await request.get('/fr/comment-ca-se-passe')).text()
  expect(full).toContain('Étape par étape')
  const simple = await (await request.get('/en/how-it-works/easy-read')).text()
  expect(simple).toContain('You choose with us.')
})
