import { expect, test } from '@playwright/test'

// Story 2.13 : pages de service en cinq questions, page Services (D26).

const BLOCS_FR = [
  'Le besoin',
  'Pour qui',
  'Quelques situations',
  'Comment ça se passe',
  'Notre sélection',
  'En toute confidentialité',
  'Nous écrire',
  'Les autres services',
]

for (const [path, autres] of [
  ['/fr/services/conciergerie', ['/fr/services/grand-age', '/fr/services/enfants']],
  ['/fr/services/grand-age', ['/fr/services/conciergerie', '/fr/services/enfants']],
  ['/fr/services/enfants', ['/fr/services/conciergerie', '/fr/services/grand-age']],
] as const) {
  test(`${path} répond aux cinq questions dans l’ordre`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(BLOCS_FR)
    await expect(page.locator('main ul li').first()).toBeVisible()
    for (const autre of autres) await expect(page.locator(`a[href="${autre}"]`)).toHaveCount(1)
  })
}

test('les pages de service en anglais ont la même structure', async ({ page }) => {
  await page.goto('/en/services/senior-companionship')
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(BLOCS_FR.length)
  await expect(page.getByText(/Companionship, not medical care/)).toBeVisible()
})

test('le grand âge rappelle « une présence, pas des soins »', async ({ page }) => {
  await page.goto('/fr/services/grand-age')
  await expect(page.getByText(/Une présence, pas des soins/)).toBeVisible()
})

test('/services mène aux trois pages et au formulaire', async ({ page }) => {
  await page.goto('/fr/services')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Services')
  const hrefs = await page
    .locator('main ul a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(hrefs).toEqual([
    '/fr/services/conciergerie',
    '/fr/services/grand-age',
    '/fr/services/enfants',
    '/fr/contact',
  ])
})
