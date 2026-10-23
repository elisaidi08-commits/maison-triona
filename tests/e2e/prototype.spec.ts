import { expect, test, type Page } from '@playwright/test'

// Prototype V5, accueil calme (/prototype, maquette Figma D·01) : le titre validé et ce que fait la
// maison face aux portes, les trois services avec leurs images, les territoires, le contact sur
// pierre. Jamais indexé ; la version fixe (mobile, mouvement réduit) est complète. En desktop, le
// film d'entrée passe d'abord (D31), et l'en-tête ouvre le menu plein écran à aplats.

const videoRequests = (page: Page) => {
  const urls: string[] = []
  page.on('request', (request) => {
    if (/\.(mp4|webm)(\?|$)/.test(request.url())) urls.push(request.url())
  })
  return urls
}

const passerLeFilm = async (page: Page) => {
  await page.getByRole('button', { name: 'Passer' }).click()
  await expect(page.locator('[data-film-accueil]')).toHaveCount(0)
}

test('premier écran : le titre validé et la phrase qui dit ce que fait la maison', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Une seconde vie, comme des vacances qui ne s’arrêtent pas.',
  )
  const intro = page.getByText(/^Conciergerie de luxe, accompagnement/)
  await expect(intro).toBeInViewport()
  await expect(page.getByRole('img', { name: /deux portes de bois/ })).toBeInViewport()
})

test('une idée par section, dans l’ordre de la maquette', async ({ page }) => {
  await page.goto('/fr/prototype')
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
  await page.goto('/fr/prototype')
  expect(await links()).toEqual([
    '/fr/services/conciergerie',
    '/fr/services/grand-age',
    '/fr/services/enfants',
  ])
  await page.goto('/en/prototype')
  expect(await links()).toEqual([
    '/en/services/concierge',
    '/en/services/senior-companionship',
    '/en/services/childcare',
  ])
  await expect(page.getByRole('link', { name: 'Write to us' }).last()).toHaveAttribute(
    'href',
    '/en/contact',
  )
})

test('jamais indexé, en français comme en anglais', async ({ page }) => {
  for (const path of ['/fr/prototype', '/en/prototype']) {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A second life, like a holiday that never ends.',
  )
})

test('desktop : les portes s’ouvrent une fois, cinq secondes, sans boucle', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  const video = page.locator('section[aria-labelledby="accueil-titre"] video')
  // Les portes attendent la fin du film d'entrée.
  await page.waitForTimeout(1500)
  await expect(video).toHaveCount(0)
  await passerLeFilm(page)
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
  await page.goto('/fr/prototype')
  await passerLeFilm(page)
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
  await page.goto('/fr/prototype')
  await page.waitForTimeout(2000)
  for (const id of ['conciergerie', 'grand-age', 'enfants']) {
    await expect(page.locator(`#${id} img`)).toBeVisible()
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  await page.waitForTimeout(2000)
  expect(urls).toEqual([])
})

test('desktop : le film d’entrée passe avant l’accueil, Passer a le focus, Échap le passe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  const film = page.getByRole('dialog', { name: 'Film d’entrée' })
  await expect(film).toBeVisible()
  await expect(page.getByRole('button', { name: 'Passer' })).toBeFocused()
  await expect(film.getByRole('list', { name: 'Plans du film' }).getByRole('button')).toHaveText([
    'Conciergerie de luxe',
    'Accompagnement du grand âge',
    'Garde d’enfants',
    'La Maison',
  ])
  // L'accueil est déjà rendu derrière le film.
  await expect(page.getByRole('heading', { level: 1, includeHidden: true })).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-film-accueil]')).toHaveCount(0)
  await page.locator('#conciergerie a').focus()
  await expect(page.locator('#conciergerie a')).toBeFocused()
})

test('desktop : la pause suspend le plan, un plan se choisit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Lecture' })).toBeVisible()
  const state = () =>
    page
      .locator('[data-progression]')
      .evaluate((line) => line.getAnimations()[0]?.playState ?? 'aucune')
  await expect.poll(state).toBe('paused')
  await page.getByRole('button', { name: 'Garde d’enfants' }).click()
  await expect(page.getByRole('button', { name: 'Garde d’enfants' })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await expect(page.locator('[data-film-accueil] [data-bande]')).toContainText('03 / 04')
})

test('desktop : au dernier plan, la scène rejoint les portes de l’accueil, qui s’ouvrent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  await page.getByRole('button', { name: 'La Maison' }).click()
  await expect(page.locator('[data-film-accueil]')).toHaveAttribute('data-etat', 'arrivee', {
    timeout: 8000,
  })
  // Pendant l'arrivée, la scène se resserre exactement sur le cadre des portes de l'accueil.
  const frame = await page.locator('[data-accueil-portes]').boundingBox()
  const target = await page
    .locator('[data-scene]')
    .evaluate((scene: HTMLElement) => scene.style.clipPath)
  const [top, right, bottom, left] = (target.match(/-?[\d.]+/g) ?? []).map(Number)
  expect(top).toBeCloseTo(frame!.y, 1)
  expect(left).toBeCloseTo(frame!.x, 1)
  expect(right).toBeCloseTo(0, 1)
  expect(bottom).toBeCloseTo(0, 1)
  await expect(page.locator('[data-film-accueil]')).toHaveCount(0)
  await expect(page.locator('section[aria-labelledby="accueil-titre"] video')).toHaveCount(1)
})

test('mobile et mouvement réduit : pas de film, l’accueil tout de suite', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fr/prototype')
  await expect(page.locator('[data-film-accueil]')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  await expect(page.locator('[data-film-accueil]')).toHaveCount(0)
})

test('menu plein écran : aplats, quatre entrées, une pièce au survol, Échap le ferme', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/prototype')
  await passerLeFilm(page)
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', { name: 'Territoires' })).toBeHidden()
  const button = header.locator('[data-menu-panneau] summary')
  await expect(button.getByText('Menu', { exact: true })).toBeVisible()
  await button.click()
  const menu = header.locator('[data-menu-panneau]')
  await expect(
    menu.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link'),
  ).toHaveText(['La Maison', 'Services', 'Territoires', 'Contact'])
  await menu.getByRole('link', { name: 'Services' }).hover()
  await expect
    .poll(() =>
      menu.locator('[data-menu-image="1"]').evaluate((image) => getComputedStyle(image).opacity),
    )
    .toBe('1')
  await page.keyboard.press('Escape')
  await expect(menu).not.toHaveAttribute('open')
  await expect(button).toBeFocused()
})

test('ailleurs, l’en-tête ne change pas : navigation en ligne en desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', { name: 'Territoires' })).toBeVisible()
  await expect(header.locator('[data-menu-panneau]')).toBeHidden()
})
