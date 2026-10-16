import { expect, test } from '@playwright/test'

// Accueil (D26) : la promesse et les trois scènes de service ; pages de service (stories 2.2, 2.3).

test('chaque choix d’entrée mène à une scène existante', async ({ page }) => {
  await page.goto('/fr')
  for (const anchor of ['conciergerie', 'grand-age', 'enfants']) {
    await expect(page.locator(`#${anchor}`)).toHaveCount(1)
    await expect(page.locator(`#${anchor}-titre`)).toBeVisible()
  }
})

test('la promesse tient en quatre lignes courtes', async ({ page }) => {
  await page.goto('/fr')
  const promesse = page.locator('section[aria-labelledby="promesse-titre"]')
  await expect(promesse.getByRole('heading', { level: 2 })).toHaveText(
    'Une seconde vie, comme des vacances qui ne s’arrêtent pas.',
  )
  await expect(promesse.locator('li')).toHaveCount(4)
})

test('chaque scène donne trois situations, le fonctionnement et la page du service', async ({
  page,
}) => {
  await page.goto('/fr')
  for (const [anchor, path] of [
    ['conciergerie', '/fr/services/conciergerie'],
    ['grand-age', '/fr/services/grand-age'],
    ['enfants', '/fr/services/enfants'],
  ] as const) {
    const scene = page.locator(`section#${anchor}`)
    await expect(scene.locator('ul li')).toHaveCount(3)
    await expect(
      scene.getByText(/Vous nous écrivez, nous vous répondons personnellement/),
    ).toHaveCount(1)
    await expect(scene.locator(`a[href="${path}"]`)).toHaveCount(1)
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
