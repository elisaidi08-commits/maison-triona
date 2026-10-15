import { expect, test } from '../fixtures'

// Accueil (D25) : les trois services ; pages de service (stories 2.2 et 2.3).

test('chaque choix d’entrée mène à une scène existante', async ({ page }) => {
  await page.goto('/fr')
  for (const anchor of ['conciergerie', 'grand-age', 'enfants']) {
    await expect(page.locator(`#${anchor}`)).toHaveCount(1)
    await expect(page.locator(`#${anchor}-titre`)).toBeVisible()
  }
})

const PAGES = [
  ['/fr/services/conciergerie', 'conciergerie', 'Une seule interlocutrice pour tout organiser.'],
  ['/en/services/concierge', 'conciergerie', 'One person to arrange everything for you.'],
  [
    '/fr/services/grand-age',
    'grand-age',
    'Des journées qui gardent leur rythme et leurs plaisirs.',
  ],
  [
    '/en/services/senior-companionship',
    'grand-age',
    'Days that keep their rhythm and their pleasures.',
  ],
  [
    '/fr/services/enfants',
    'enfants',
    'Une présence choisie, pour quelques heures ou pour une saison.',
  ],
  ['/en/services/childcare', 'enfants', 'A trusted presence, for a few hours or a whole season.'],
] as const

for (const [path, id, title] of PAGES) {
  test(`page de service ${path}`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    const locale = path.slice(1, 3)
    await expect(page.locator(`a[href="/${locale}/contact?service=${id}"]`)).toHaveCount(1)
  })
}

test('aucun tarif ni promesse médicale dans les scènes', async ({ page }) => {
  await page.goto('/fr')
  const text = (await page.locator('main').innerText()).toLowerCase()
  for (const word of ['€', 'tarif', 'prix', 'soins médicaux', 'garde-malade', 'infirmi']) {
    expect(text).not.toContain(word)
  }
})
