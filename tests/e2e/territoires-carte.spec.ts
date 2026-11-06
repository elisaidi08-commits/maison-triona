import { expect, test, type Page } from '@playwright/test'

// Carte des Territoires (D56, M24) : la carte d'Europe reste à l'écran pendant qu'on lit les cinq
// pays ; à l'arrivée, les cinq pays sont nommés ; le pays lu s'allume et montre les lieux de son
// texte ; un clic sur la carte amène au texte du pays ; aucun appel réseau hors du site.

const active = (page: Page) =>
  page
    .locator('[data-carte] path[data-actif]')
    .evaluateAll((paths) => paths.map((path) => path.getAttribute('data-pays')))

// Amène le milieu de la section d'un pays au milieu de l'écran.
const readCountry = (page: Page, code: string) =>
  page.locator(`#territoire-${code}`).evaluate((section) => {
    const box = section.getBoundingClientRect()
    window.scrollBy({ top: box.top + box.height / 2 - window.innerHeight / 2, behavior: 'instant' })
  })

test('à l’arrivée, les cinq pays sont nommés sur la carte, aucun n’est encore lu', async ({
  page,
}) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith('http://localhost')) external.push(request.url())
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/territoires')
  await expect(page.locator('[data-carte-noms] > [data-pays]')).toHaveText([
    'Belgique',
    'France',
    'Luxembourg',
    'Monaco',
    'Suisse',
  ])
  expect(await active(page)).toEqual([])
  await expect(page.locator('[data-carte] svg')).toHaveAttribute('aria-hidden', 'true')
  expect(external).toEqual([])
})

test('le pays lu s’allume sur la carte et montre les lieux de son texte', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/territoires')
  await readCountry(page, 'fr')
  await expect.poll(() => active(page)).toEqual(['FR'])
  const visiblePlaces = () =>
    page
      .locator('[data-lieu][data-visible] [data-nom]')
      .evaluateAll((names) => names.map((name) => name.textContent))
  await expect.poll(visiblePlaces).toEqual(['Paris', 'Côte d’Azur'])
  await readCountry(page, 'ch')
  await expect.poll(() => active(page)).toEqual(['CH'])
  await expect.poll(visiblePlaces).toEqual(['Genève', 'Lausanne'])
  // La carte reste à l'écran pendant la lecture.
  await expect(page.locator('[data-carte]')).toBeInViewport()
})

test('un clic sur un pays de la carte amène à son texte', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/territoires')
  await page.locator('[data-carte-noms] > [data-pays="CH"]').click()
  await expect(page.locator('#territoire-ch')).toBeInViewport()
  await expect.poll(() => active(page)).toEqual(['CH'])
})

test('après les pays, ce que la maison fait : les trois services et le contact', async ({
  page,
}) => {
  await page.goto('/fr/territoires')
  const services = page.locator('section[aria-labelledby="territoires-services"]')
  await expect(services.getByRole('heading', { level: 3 })).toHaveCount(3)
  await expect(services.getByRole('link', { name: 'Nous écrire' })).toHaveAttribute(
    'href',
    '/fr/contact',
  )
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la carte des cinq pays et tous les textes restent là', async ({ page }) => {
    await page.goto('/fr/territoires')
    await expect(page.locator('[data-carte] svg')).toBeVisible()
    await expect(page.locator('[data-territoire] h2')).toHaveText([
      'Belgique',
      'France',
      'Luxembourg',
      'Monaco',
      'Suisse',
    ])
  })
})
