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
      // Liens des services eux-mêmes : ni l'image (réservée à la souris) ni les copies de la file.
      .locator('section[aria-labelledby="services-titre"] li:not([aria-hidden]) [data-etiquette] a')
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

// M21 (D52) : file de cartes. Position de défilement d'une fraction de la piste, carte en vedette,
// étiquettes visibles.
const scrollTrack = (page: Page, fraction: number) =>
  page.locator('[data-zoom]').evaluate((track, f) => {
    const top = track.getBoundingClientRect().top + window.scrollY
    const course = (track as HTMLElement).offsetHeight - window.innerHeight
    window.scrollTo({ top: top + f * course, behavior: 'instant' })
  }, fraction)
const featured = (page: Page) =>
  page.locator('[data-carte-rang][data-vedette]').evaluate((card) => card.id)
const shownLabels = (page: Page) =>
  page
    .locator('[data-carte-rang]:not([aria-hidden]) [data-etiquette]')
    .evaluateAll((labels) => labels.map((label) => getComputedStyle(label).opacity))
const cardWidth = (page: Page, id: string) =>
  page.locator(`#${id} [data-carte]`).evaluate((card) => card.getBoundingClientRect().width)

test('desktop : les cartes avancent et grandissent avec le défilement, chaque service en vedette', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  await scrollTrack(page, 0)
  await expect.poll(() => featured(page)).toBe('conciergerie')
  await expect.poll(() => shownLabels(page)).toEqual(['1', '0', '0'])
  const before = await cardWidth(page, 'grand-age')
  await scrollTrack(page, 0.5)
  await expect.poll(() => featured(page)).toBe('grand-age')
  expect(await cardWidth(page, 'grand-age')).toBeGreaterThan(before)
  await scrollTrack(page, 1)
  await expect.poll(() => featured(page)).toBe('enfants')
  await expect.poll(() => shownLabels(page)).toEqual(['0', '0', '1'])
  // La scène reste collée en haut de l'écran (au pixel près : la fin de piste tombe entre deux
  // pixels) ; rien ne déborde en largeur.
  const sceneTop = await page
    .locator('[data-scene]')
    .evaluate((scene) => scene.getBoundingClientRect().top)
  expect(Math.abs(sceneTop)).toBeLessThan(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
})

test('desktop : le survol d’une carte montre son service, le clavier amène le sien en vedette', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  await scrollTrack(page, 0)
  await page.locator('#enfants [data-carte]').hover()
  await expect.poll(() => shownLabels(page)).toEqual(['0', '0', '1'])
  await page.mouse.move(700, 5)
  await expect.poll(() => shownLabels(page)).toEqual(['1', '0', '0'])
  // Une touche avant le focus : le navigateur le traite comme un focus clavier (:focus-visible).
  await page.keyboard.press('Shift')
  await page.locator('#grand-age [data-etiquette] a').focus()
  await expect.poll(() => featured(page)).toBe('grand-age')
  await expect(page.locator('#grand-age [data-etiquette] a')).toBeInViewport()
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('desktop : les services restent empilés, chacun avec son texte et son lien', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    for (const id of ['conciergerie', 'grand-age', 'enfants']) {
      await expect(page.locator(`#${id} [data-etiquette] a`)).toBeVisible()
    }
    await expect(page.locator('[data-carte-rang][aria-hidden]').first()).toBeHidden()
  })
})

test('mouvement réduit : les services restent empilés', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  expect(await page.locator('#enfants').evaluate((card) => getComputedStyle(card).position)).toBe(
    'static',
  )
  await expect(page.locator('[data-carte-rang][aria-hidden]').first()).toBeHidden()
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
