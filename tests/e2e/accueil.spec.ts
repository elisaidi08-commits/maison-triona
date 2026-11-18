import { expect, test, type Page } from '@playwright/test'

// Accueil (maquette Figma D·01, D36) : le titre validé et ce que fait la maison face aux portes, les
// trois services en scènes alternées (D64 (3)), les territoires, le contact sur aplat sapin (D64 (4)).
// La version fixe (mobile, mouvement réduit, sans JavaScript) est complète.

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
      // Un seul lien par scène, celui du texte (l'image n'est pas un lien).
      .locator('section[aria-labelledby="services-titre"] li a')
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

// Scènes des services (D64 (3)) : boîte du texte et de l'image de chaque scène.
const SCENES = ['conciergerie', 'grand-age', 'enfants'] as const
const sceneBoxes = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((scene) => {
    const [text, image] = Array.from(scene.children).map((child) => child.getBoundingClientRect())
    return {
      text: { x: text!.x, top: text!.top, bottom: text!.bottom },
      image: { x: image!.x, top: image!.top, width: image!.width, height: image!.height },
      position: getComputedStyle(scene).position,
    }
  })

test('desktop : trois scènes, l’image 4:5 alterne à gauche et à droite du texte', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  for (const [index, id] of SCENES.entries()) {
    const { text, image, position } = await sceneBoxes(page, id)
    // Conciergerie et enfants : image à gauche ; grand âge : image à droite.
    if (index % 2 === 0) expect(image.x).toBeLessThan(text.x)
    else expect(image.x).toBeGreaterThan(text.x)
    expect(image.height / image.width).toBeCloseTo(1.25, 2)
    // Rien ne colle ni ne bouge.
    expect(position).toBe('static')
  }
  // Le nom du service en `title-h2`, comme le titre du bloc Contact, sous le titre de la section.
  const fontSize = (selector: string) =>
    page.locator(selector).evaluate((element) => getComputedStyle(element).fontSize)
  expect(await fontSize('#grand-age-titre')).toBe(await fontSize('#contact-titre'))
  await expect(page.locator('section[aria-labelledby="services-titre"] ol h3')).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
})

for (const [width, height] of [
  [834, 1112],
  [390, 844],
] as const) {
  test(`${width} px : le texte, puis l’image en pleine largeur`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/fr')
    for (const id of SCENES) {
      const { text, image } = await sceneBoxes(page, id)
      expect(image.top).toBeGreaterThan(text.bottom)
      expect(image.x).toBe(0)
      expect(image.width).toBe(width)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
  })
}

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('desktop : chaque service garde son image, son texte et son lien', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    for (const id of SCENES) {
      await expect(page.locator(`#${id} a`)).toBeVisible()
      await expect(page.locator(`#${id} img`)).toBeVisible()
    }
  })
})

// Bloc Contact (D64 (4), DA §7.5) : aplat sapin, label champagne, titre ivoire, bouton à bordure or.
test('le bloc Contact de l’accueil est sur aplat sapin, bouton à bordure or', async ({ page }) => {
  await page.goto('/fr')
  const contact = page.locator('section[aria-labelledby="contact-titre"]')
  await expect(contact).toHaveCSS('background-color', 'rgb(38, 56, 47)')
  await expect(page.locator('#contact-titre')).toHaveCSS('color', 'rgb(243, 237, 225)')
  const button = contact.getByRole('link', { name: 'Nous écrire' })
  await expect(button).toHaveAttribute('href', '/fr/contact')
  await expect(button).toHaveCSS('border-top-color', 'rgb(181, 142, 76)')
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48)
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
