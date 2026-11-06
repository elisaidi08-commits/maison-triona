import { expect, test } from '@playwright/test'

// Story 2.13 : pages de service en cinq questions, page Services (D26). Intertitres et liens comptés
// dans le contenu (`main`) : le pied de page (D54) a ses propres intertitres et liens vers les services.

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
    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 2 })).toHaveText(BLOCS_FR)
    await expect(main.locator('ul li').first()).toBeVisible()
    for (const autre of autres) await expect(main.locator(`a[href="${autre}"]`)).toHaveCount(1)
  })
}

test('les pages de service en anglais ont la même structure', async ({ page }) => {
  // Adresse anglaise du grand âge : « later-life » (D47).
  await page.goto('/en/services/later-life')
  await expect(page.locator('main').getByRole('heading', { level: 2 })).toHaveCount(BLOCS_FR.length)
  await expect(page.getByText(/For any medical need, we will refer you/)).toBeVisible()
})

// Phrase réécrite sans « soins » (mot banni par Cat, D39).
test('le grand âge oriente vers les professionnels de santé', async ({ page }) => {
  await page.goto('/fr/services/grand-age')
  await expect(page.getByText(/nous vous orientons vers les professionnels de santé/)).toBeVisible()
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
