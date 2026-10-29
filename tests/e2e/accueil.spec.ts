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

test('desktop : l’image des services suit le service que l’on lit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const visible = () =>
    page
      .locator('[data-vitrine-images] > *')
      .evaluateAll((layers) => layers.map((layer) => getComputedStyle(layer).opacity))
  await page.evaluate(() => {
    const block = document.getElementById('enfants')!
    const top = block.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top - window.innerHeight * 0.42, behavior: 'instant' })
  })
  await expect.poll(visible).toEqual(['0', '0', '1'])
  // Au clavier : le focus sur un service montre son image.
  await page.locator('#conciergerie a').focus()
  await expect.poll(visible).toEqual(['1', '0', '0'])
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
