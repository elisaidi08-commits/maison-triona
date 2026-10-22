import { expect, test, type Page } from '@playwright/test'

// Prototype V5 de l'accueil (/prototype) : le film d'entrée (ouverture, une pièce par service, la
// demande particulière), puis la promesse, la confiance, les territoires, le contact. Jamais
// indexé ; la version fixe (mobile, mouvement réduit) est complète.

const videoRequests = (page: Page) => {
  const urls: string[] = []
  page.on('request', (request) => {
    if (/\.(mp4|webm)(\?|$)/.test(request.url())) urls.push(request.url())
  })
  return urls
}

test('ouverture : titre, phrase métier, question et quatre vrais liens vers les pièces', async ({
  page,
}) => {
  await page.goto('/fr/prototype')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Une maison. Mille attentions.')
  await expect(
    page.getByText(/^Conciergerie privée et mise en relation personnalisée/),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /Comment pouvons-nous vous accompagner/ }),
  ).toBeVisible()
  const hrefs = await page
    .locator('#ouverture ul a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(hrefs).toEqual(['#conciergerie', '#grand-age', '#enfants', '#demande-particuliere'])
  for (const href of hrefs) await expect(page.locator(`${href}-titre`)).toHaveCount(1)
})

test('le film suit l’ordre de la référence, puis la promesse et le contact', async ({ page }) => {
  await page.goto('/fr/prototype')
  const order = await page
    .locator('main section[aria-labelledby]')
    .evaluateAll((nodes) => nodes.map((node) => node.id || node.getAttribute('aria-labelledby')))
  expect(order).toEqual([
    'ouverture',
    'conciergerie',
    'grand-age',
    'enfants',
    'demande-particuliere',
    'promesse-titre',
    'confiance-titre',
    'territoires-titre',
    'contact-titre',
  ])
})

test('jamais indexé, en français comme en anglais', async ({ page }) => {
  for (const path of ['/fr/prototype', '/en/prototype']) {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'One house. A thousand thoughtful touches.',
  )
})

test('voile du titre mesuré par langue : 20 % en français, 50 % en anglais, 60 % en mobile', async ({
  page,
}) => {
  const veil = () =>
    page
      .locator('#seuil-titre')
      .evaluate((title) => getComputedStyle(title.parentElement!).backgroundColor)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  expect(await veil()).toMatch(/0\.2\)$/)
  await page.goto('/en/prototype')
  expect(await veil()).toMatch(/0\.5\d*\)$/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr/prototype')
  expect(await veil()).toMatch(/0\.6\)$/)
})

for (const [width, height] of [
  [1440, 900],
  [834, 1194],
  [390, 844],
] as const) {
  test(`premier choix visible sans défiler (${width} × ${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/fr/prototype')
    const box = await page.getByRole('link', { name: /Organiser le quotidien/ }).boundingBox()
    const bar = page.locator('[data-barre-mobile]')
    const barBox = (await bar.isVisible()) ? await bar.boundingBox() : null
    const limit = barBox ? barBox.y : height
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(limit)
  })
}

test('un choix mène à sa pièce et place le focus sur son titre', async ({ page }) => {
  await page.goto('/fr/prototype')
  await page.getByRole('link', { name: /Accompagner un proche/ }).click()
  await expect(page).toHaveURL(/#grand-age$/)
  await expect(page.locator('#grand-age-titre')).toBeFocused()
  await expect(page.locator('#grand-age-titre')).toBeInViewport()
})

test('desktop : la légende d’une pièce reste lisible sur son aplat pendant le défilement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype#enfants')
  const title = page.locator('#enfants-titre')
  await expect(title).toBeInViewport()
  await page.mouse.wheel(0, 400)
  await expect(title).toBeInViewport()
  const surface = await title.evaluate((element) =>
    element.closest('[data-surface]')?.getAttribute('data-surface'),
  )
  expect(surface).toBe('sapin')
})

test('mobile et mouvement réduit : aucune vidéo, toutes les pièces en images fixes', async ({
  page,
}) => {
  const urls = videoRequests(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr/prototype')
  await page.waitForTimeout(2000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  await page.waitForTimeout(2000)
  expect(urls).toEqual([])
  await expect(page.locator('#conciergerie button')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /bouquet de fleurs blanches/ })).toHaveCount(1)
  await expect(page.getByRole('img', { name: /main âgée/ })).toHaveCount(1)
})

test('desktop : les portes s’ouvrent seules, puis suivent le défilement', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  const video = page.locator('#ouverture video')
  await expect(video).toHaveAttribute('src', /V10-portes-scrub\.mp4$/)
  // Ouverture jouée seule : trois secondes, puis arrêt.
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(2.9)
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true)
  await page.evaluate(() => {
    const element = document.getElementById('ouverture')!
    const top = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + element.offsetHeight - window.innerHeight, behavior: 'instant' })
  })
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(7.5)
})

test('desktop : le geste se lance dans sa pièce, se met en pause au clavier, se relance', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype#conciergerie')
  const button = page.locator('#conciergerie button')
  await expect(button).toHaveAccessibleName('Mettre la vidéo en pause', { timeout: 10000 })
  await expect
    .poll(() =>
      page.locator('#conciergerie video').evaluate((element: HTMLVideoElement) => element.paused),
    )
    .toBe(false)
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveText('Lire')
  await expect(button).toHaveAccessibleName('Lire la vidéo')
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAccessibleName('Mettre la vidéo en pause')
})
