import { expect, test, type Page } from '@playwright/test'

// Accueil (maquette Figma D·01, D36) : le titre validé et ce que fait la maison face aux portes, les
// trois services avec leurs images, les territoires, le contact sur pierre. La version fixe
// (mobile, mouvement réduit) est complète.

const videoRequests = (page: Page) => {
  const urls: string[] = []
  page.on('request', (request) => {
    if (/\.(mp4|webm)(\?|$)/.test(request.url())) urls.push(request.url())
  })
  return urls
}

test('premier écran : le titre validé et la phrase qui dit ce que fait la maison', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Une seconde vie, comme des vacances qui ne s’arrêtent pas.',
  )
  const intro = page.getByText(/^Conciergerie de luxe, accompagnement/)
  await expect(intro).toBeInViewport()
  await expect(page.getByRole('img', { name: /deux portes de bois/ })).toBeInViewport()
})

test('une idée par section, dans l’ordre de la maquette', async ({ page }) => {
  await page.goto('/fr')
  const order = await page
    .locator('main section[aria-labelledby]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-labelledby')))
  expect(order).toEqual(['accueil-titre', 'services-titre', 'territoires-titre', 'contact-titre'])
})

test('les trois services mènent à leur page, en français comme en anglais', async ({ page }) => {
  const links = () =>
    page
      .locator('section[aria-labelledby="services-titre"] ol a')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
  await page.goto('/fr')
  expect(await links()).toEqual([
    '/fr/services/conciergerie',
    '/fr/services/grand-age',
    '/fr/services/enfants',
  ])
  await page.goto('/en')
  expect(await links()).toEqual([
    '/en/services/concierge',
    '/en/services/later-life',
    '/en/services/childcare',
  ])
  await expect(page.getByRole('link', { name: 'Write to us' }).last()).toHaveAttribute(
    'href',
    '/en/contact',
  )
})

test('noindex tant que le site n’est pas ouvert, en français comme en anglais', async ({
  page,
}) => {
  for (const path of ['/fr', '/en']) {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A second life, like a holiday that never ends.',
  )
})

test('desktop : les portes s’ouvrent une fois, cinq secondes, sans boucle', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const video = page.locator('section[aria-labelledby="accueil-titre"] video')
  await expect(video).toHaveCount(1)
  await expect(video).toHaveJSProperty('loop', false)
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.ended), { timeout: 15000 })
    .toBe(true)
  expect(await video.evaluate((element: HTMLVideoElement) => element.duration)).toBeLessThanOrEqual(
    5,
  )
})

// M21 (D52) : texte du service ouvert affiché, celui des services resserrés effacé.
const openServices = (page: Page) =>
  page
    .locator('[data-detail]')
    .evaluateAll((details) => details.map((detail) => getComputedStyle(detail).opacity))

test('desktop : la bande ouvre le service survolé ou atteint au clavier, et le garde', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  await expect.poll(() => openServices(page)).toEqual(['1', '0', '0'])
  await page.locator('#enfants-titre').hover()
  await expect.poll(() => openServices(page)).toEqual(['0', '0', '1'])
  // La souris quitte la bande : le service reste ouvert.
  await page.mouse.move(0, 0)
  await page.waitForTimeout(800)
  expect(await openServices(page)).toEqual(['0', '0', '1'])
  await page.locator('#grand-age a').focus()
  await expect.poll(() => openServices(page)).toEqual(['0', '1', '0'])
  // Les panneaux glissent sans rien déborder : aucun défilement horizontal.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('desktop : le survol et le focus ouvrent quand même le bon service', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    await page.locator('#enfants-titre').hover()
    await expect.poll(() => openServices(page)).toEqual(['0', '0', '1'])
    // Le focus l'emporte sur le survol.
    await page.locator('#grand-age a').focus()
    await expect.poll(() => openServices(page)).toEqual(['0', '1', '0'])
  })
})

test('mobile et mouvement réduit : aucune vidéo, chaque service garde son image', async ({
  page,
}) => {
  const urls = videoRequests(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr')
  await page.waitForTimeout(2000)
  for (const id of ['conciergerie', 'grand-age', 'enfants']) {
    await expect(page.locator(`#${id} img`)).toBeVisible()
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  await page.waitForTimeout(2000)
  expect(urls).toEqual([])
})

test('le logo et les liens changent de page sans rechargement, la page arrive en fondu', async ({
  page,
}) => {
  type Marked = Window & { marqueur?: number }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const wrapper = page.locator('main > div').first()
  // Le premier affichage n'est jamais animé.
  await expect(wrapper).not.toHaveClass(/animate-page/)
  await page.evaluate(() => ((window as Marked).marqueur = 1))
  await page.getByRole('link', { name: 'Où nous travaillons' }).click()
  await expect(page).toHaveURL(/\/fr\/territoires$/)
  expect(await page.evaluate(() => (window as Marked).marqueur)).toBe(1)
  await expect(page.locator('main > div').first()).toHaveClass(/animate-page/)
  await page.getByRole('link', { name: 'Maison Triona, accueil' }).click()
  await expect(page).toHaveURL(/\/fr$/)
  expect(await page.evaluate(() => (window as Marked).marqueur)).toBe(1)
})

test('le titre des territoires apparaît en entrant dans l’écran, tout de suite en mouvement réduit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const group = page.locator('[data-revelation]')
  await expect(group).toHaveAttribute('data-revelation', 'attente')
  await page.locator('#territoires-titre').scrollIntoViewIfNeeded()
  await expect(group).toHaveAttribute('data-revelation', 'visible')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/fr')
  await page.waitForTimeout(500)
  await expect(page.locator('[data-revelation]')).toHaveAttribute('data-revelation', '')
})
