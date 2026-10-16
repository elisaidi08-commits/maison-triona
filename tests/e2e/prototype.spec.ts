import { expect, test, type Page } from '@playwright/test'

// Prototype V5 de l'accueil (/prototype) : invitation, franchissement, attention, services,
// confiance, contact. Jamais indexé ; la version fixe (mobile, mouvement réduit) est complète.

const videoRequests = (page: Page) => {
  const urls: string[] = []
  page.on('request', (request) => {
    if (/\.(mp4|webm)(\?|$)/.test(request.url())) urls.push(request.url())
  })
  return urls
}

test('invitation : titre, phrase métier, question et quatre vrais liens vers les services', async ({
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
    .locator('section[aria-labelledby="seuil-titre"] ul a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(hrefs).toEqual(['#conciergerie', '#grand-age', '#enfants', '#demande-particuliere'])
  for (const href of hrefs) await expect(page.locator(`${href}-titre`)).toHaveCount(1)
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

test('un choix mène à son service et place le focus sur son titre', async ({ page }) => {
  await page.goto('/fr/prototype')
  await page.getByRole('link', { name: /Accompagner un proche/ }).click()
  await expect(page).toHaveURL(/#grand-age$/)
  await expect(page.locator('#grand-age-titre')).toBeFocused()
  await page.getByRole('link', { name: /Évoquer une demande particulière/ }).click()
  await expect(page.locator('#demande-particuliere-titre')).toBeFocused()
})

test('mobile et mouvement réduit : aucune vidéo, ni franchissement, ni bouton', async ({
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
  await expect(page.locator('#franchissement')).toHaveCount(0)
  await expect(page.locator('section[aria-labelledby="promesse-titre"] button')).toHaveCount(0)
  // La dernière image du geste tient lieu de vidéo.
  await expect(page.getByRole('img', { name: /bouquet de fleurs blanches/ })).toBeVisible()
})

test('desktop : le franchissement suit le défilement', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  const track = page.locator('#franchissement')
  await expect(track).toHaveCount(1)
  const video = track.locator('video')
  await expect(video).toHaveAttribute('src', /V10-V11-franchissement-scrub\.mp4$/)
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLVideoElement>('#franchissement video')
    return !!element && element.readyState >= 1
  })
  await page.evaluate(() => {
    const element = document.getElementById('franchissement')!
    const top = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({
      top: top + (element.offsetHeight - window.innerHeight) / 2,
      behavior: 'instant',
    })
  })
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(6)
})

test('desktop : le geste se met en pause au clavier, puis se relance', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  await page.locator('#promesse-titre').scrollIntoViewIfNeeded()
  const button = page.locator('section[aria-labelledby="promesse-titre"] button')
  await expect(button).toHaveAccessibleName('Mettre la vidéo en pause', { timeout: 10000 })
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveText('Lire')
  await expect(button).toHaveAccessibleName('Lire la vidéo')
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAccessibleName('Mettre la vidéo en pause')
})
