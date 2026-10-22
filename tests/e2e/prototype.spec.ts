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
  await expect(page.locator('#conciergerie video')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /bouquet de fleurs blanches/ })).toHaveCount(1)
  await expect(page.getByRole('img', { name: /main âgée/ })).toHaveCount(1)
})

test('desktop : les portes s’ouvrent seules, puis suivent le défilement', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  const video = page.locator('#ouverture video')
  await expect(video).toHaveAttribute('src', /ouverture-scrub\.mp4$/)
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
    .toBeGreaterThan(15.5)
})

test('desktop : le geste suit le défilement dans sa pièce, légende légère', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype#conciergerie')
  const room = page.locator('#conciergerie')
  await expect(room.locator('ul')).toHaveCount(0)
  await expect(room.getByText(/^Une résidence prête à votre arrivée/)).toBeVisible()
  await expect(room.getByRole('link')).toHaveCount(1)
  const video = room.locator('video')
  await expect(video).toHaveAttribute('src', /conciergerie-scrub\.mp4$/)
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLVideoElement>('#conciergerie video')
    return !!element && element.readyState >= 2
  })
  const start = await video.evaluate((element: HTMLVideoElement) => element.currentTime)
  await page.evaluate(() => {
    const element = document.getElementById('conciergerie')!
    const top = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + element.offsetHeight - window.innerHeight, behavior: 'instant' })
  })
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(start + 6)
  await expect(video).toHaveJSProperty('paused', true)
})

test('desktop : le voilage s’écarte en défilant, le filet suit le film ; rien en mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  const right = page.locator('#ouverture .w-voilage')
  await expect(right).toHaveCount(1)
  // Le pan gauche ne passe jamais sous le titre.
  const pane = await page.locator('#ouverture .w-voilage-etroit').boundingBox()
  const title = await page.locator('#seuil-titre').boundingBox()
  expect((pane?.x ?? 0) + (pane?.width ?? 0)).toBeLessThan(title?.x ?? 0)
  await page.evaluate(() => {
    const element = document.getElementById('ouverture')!
    window.scrollTo({ top: element.offsetHeight - window.innerHeight, behavior: 'instant' })
  })
  await expect
    .poll(() => right.evaluate((element) => element.style.transform))
    .toBe('translateX(105%)')
  await expect
    .poll(() =>
      page.locator('#film > div[aria-hidden] span').evaluate((element) => element.style.transform),
    )
    .not.toBe('scaleX(0)')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr/prototype')
  await expect(page.locator('#ouverture .w-voilage')).toHaveCount(0)
})

test('desktop : le salon s’enchaîne sans couture, légende légère avec la précision', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype#grand-age')
  const room = page.locator('#grand-age')
  await expect(room.locator('ul')).toHaveCount(0)
  await expect(room.getByText(/^Une présence, pas des soins/)).toBeVisible()
  await expect(room.getByRole('link')).toHaveCount(1)
  await expect(room.locator('video')).toHaveAttribute('src', /salon-scrub\.mp4$/)
  // L'image de la pièce reste masquée tant que la pièce n'est pas en haut de l'écran.
  await page.evaluate(() => {
    const element = document.getElementById('grand-age')!
    window.scrollTo({
      top: element.getBoundingClientRect().top + window.scrollY - 300,
      behavior: 'instant',
    })
  })
  await expect(room.locator('> div').first()).toHaveClass(/opacity-0/)
})
