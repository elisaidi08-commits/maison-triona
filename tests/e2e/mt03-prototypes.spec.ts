import { expect, test, type Page } from '@playwright/test'

// Prototypes MT-03 : P01, le seuil V4 (les quatre entrées par besoin sous la phrase, D36 gardé) ;
// P02, le passage de pièce M20 (l'image de la conciergerie va de l'accueil au haut de sa page,
// React <ViewTransition>, desktop). Le changement de page simple reste le repli partout.

const entries = (page: Page) =>
  page
    .locator('section[aria-labelledby="accueil-titre"] ul a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))

// Compte les transitions de vue demandées par React et note les groupes animés.
const watchTransitions = (page: Page) =>
  page.addInitScript(() => {
    const w = window as Window & { vt?: number; groups?: string[] }
    w.vt = 0
    w.groups = []
    const start = document.startViewTransition?.bind(document)
    if (!start) return
    document.startViewTransition = ((...args: Parameters<typeof start>) => {
      w.vt = (w.vt ?? 0) + 1
      const transition = start(...args)
      transition.ready
        .then(() => {
          for (const animation of document.documentElement.getAnimations({ subtree: true })) {
            const effect = animation.effect as KeyframeEffect | null
            // Chaque entrée : la pseudo-couche animée et sa durée, par exemple
            // « ::view-transition-group(piece-conciergerie) 500 ».
            if (effect?.pseudoElement)
              w.groups?.push(
                `${effect.pseudoElement} ${Math.round(Number(effect.getComputedTiming().duration))}`,
              )
          }
        })
        .catch(() => {})
      return transition
    }) as typeof document.startViewTransition
  })

const counts = (page: Page) =>
  page.evaluate(() => {
    const w = window as Window & { vt?: number; groups?: string[] }
    return { vt: w.vt ?? 0, groups: w.groups ?? [] }
  })

// File de cartes (M21) : au haut de sa piste, la conciergerie est en vedette et son lien visible.
const goToConciergeLink = async (page: Page) => {
  await page.locator('[data-zoom]').evaluate((track) => {
    const top = track.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top, behavior: 'instant' })
  })
  return page.locator('#conciergerie [data-etiquette] a')
}

test.describe('P01 · le seuil V4', () => {
  test('quatre vraies entrées sous la phrase, en français et en anglais', async ({ page }) => {
    await page.goto('/fr')
    expect(await entries(page)).toEqual(['#conciergerie', '#grand-age', '#enfants', '/fr/contact'])
    await expect(page.getByRole('link', { name: /Organiser le quotidien/ })).toHaveCount(1)
    await page.goto('/en')
    expect(await entries(page)).toEqual(['#conciergerie', '#grand-age', '#enfants', '/en/contact'])
    await expect(page.getByRole('link', { name: /Discuss a particular request/ })).toHaveCount(1)
  })

  for (const [width, height, all] of [
    [390, 844, false],
    [834, 1112, true],
    [1280, 720, false],
    [1440, 900, true],
  ] as const) {
    test(`premier choix visible sans défiler en ${width} × ${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/fr')
      const bar = page.locator('[data-barre-mobile]')
      const limit = (await bar.isVisible()) ? (await bar.boundingBox())!.y : height
      const first = await page.getByRole('link', { name: /Organiser le quotidien/ }).boundingBox()
      expect(first!.y + first!.height).toBeLessThanOrEqual(limit)
      if (all) {
        // Le libellé de la quatrième entrée est visible lui aussi.
        const last = await page.getByText('Évoquer une demande particulière').boundingBox()
        expect(last!.y + last!.height).toBeLessThanOrEqual(limit)
      }
    })
  }

  test('une entrée mène à sa pièce et place le focus sur son titre', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    await page.getByRole('link', { name: /Accompagner un proche/ }).click()
    await expect(page).toHaveURL(/#grand-age$/)
    await expect(page.locator('#grand-age-titre')).toBeFocused()
    await expect(page.locator('#grand-age-titre')).toBeInViewport()
  })

  test('au clavier, les quatre entrées se suivent avec un focus visible', async ({
    page,
    browserName,
  }) => {
    // Safari ne parcourt les liens qu'avec Option+Tab (réglage par défaut du navigateur).
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    const links = page.locator('section[aria-labelledby="accueil-titre"] ul a')
    await links.first().focus()
    for (let i = 0; i < 4; i += 1) {
      await expect(links.nth(i)).toBeFocused()
      const outline = await links.nth(i).evaluate((link) => getComputedStyle(link).outlineWidth)
      expect(outline).toBe('3px')
      if (i < 3) await page.keyboard.press(tab)
    }
  })

  for (const [width, height, label] of [
    [390, 844, 'mobile'],
    [640, 360, 'zoom 200 % sur 1280 × 720'],
    [320, 640, 'zoom 400 % sur 1280'],
  ] as const) {
    test(`aucun débordement horizontal (${label})`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/fr')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await expect(page.getByRole('link', { name: /Organiser le quotidien/ })).toBeVisible()
    })
  }

  test('mouvement réduit : le titre est là tout de suite, aucune vidéo', async ({ page }) => {
    const videos: string[] = []
    page.on('request', (request) => {
      if (/\.(mp4|webm)(\?|$)/.test(request.url())) videos.push(request.url())
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    await page.waitForTimeout(1500)
    expect(
      await page.locator('#accueil-titre').evaluate((h1) => getComputedStyle(h1).opacity),
    ).toBe('1')
    expect(videos).toEqual([])
  })
})

test.describe('P01 · sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('les quatre entrées et le contact fonctionnent', async ({ page }) => {
    await page.goto('/fr')
    expect(await entries(page)).toEqual(['#conciergerie', '#grand-age', '#enfants', '/fr/contact'])
    await page.getByRole('link', { name: /Évoquer une demande particulière/ }).click()
    await expect(page).toHaveURL(/\/fr\/contact$/)
  })
})

test.describe('P02 · passage de pièce', () => {
  test('desktop : l’image de la conciergerie va au haut de sa page, un seul fondu', async ({
    page,
  }) => {
    await watchTransitions(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    const link = await goToConciergeLink(page)
    await link.click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect.poll(async () => (await counts(page)).vt).toBe(1)
    const { groups } = await counts(page)
    expect(groups).toContain('::view-transition-group(piece-conciergerie) 500')
    // Le fondu croisé de la page entière est coupé : seul M6 fait apparaître la page.
    expect(groups.some((pseudo) => /-(old|new)\(root\)/.test(pseudo))).toBe(false)
    await expect(page.locator('main > div').first()).toHaveClass(/animate-page/)
  })

  test('en anglais aussi', async ({ page }) => {
    await watchTransitions(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/en')
    const link = await goToConciergeLink(page)
    await link.click()
    await expect(page).toHaveURL(/\/en\/services\/concierge$/)
    await expect
      .poll(async () => (await counts(page)).groups)
      .toContain('::view-transition-group(piece-conciergerie) 500')
  })

  test('retour : la position est rendue, l’image ne repart pas en sens inverse', async ({
    page,
  }) => {
    await watchTransitions(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    const link = await goToConciergeLink(page)
    const before = await page.evaluate(() => window.scrollY)
    await link.click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    await expect.poll(async () => (await counts(page)).vt).toBe(1)
    await page.goBack()
    await expect(page).toHaveURL(/\/fr$/)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 80)
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(before + 80)
    const { groups } = await counts(page)
    // Aucune nouvelle transition au retour : rien ne repart en sens inverse.
    await page.waitForTimeout(600)
    expect((await counts(page)).vt).toBe(1)
    expect(groups.length).toBeGreaterThan(0)
  })

  test('les autres liens ne déclenchent aucun passage de pièce', async ({ page }) => {
    await watchTransitions(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    await page.getByRole('link', { name: 'Où nous travaillons' }).click()
    await expect(page).toHaveURL(/\/fr\/territoires$/)
    await page.waitForTimeout(600)
    const { groups } = await counts(page)
    expect(groups.some((pseudo) => pseudo.includes('piece-conciergerie'))).toBe(false)
  })

  test('sans support des transitions de vue : navigation normale', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error simulation d'un navigateur sans l'API
      delete Document.prototype.startViewTransition
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    const link = await goToConciergeLink(page)
    await link.click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('mouvement réduit : le changement de page est immédiat', async ({ page }) => {
    await watchTransitions(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    const link = await goToConciergeLink(page)
    await link.click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    const durations = await page.evaluate(() =>
      document.documentElement
        .getAnimations({ subtree: true })
        // Seules les couches de la transition de vue comptent (le filet du lien cliqué, `::after`,
        // garde les 0,01 ms de la règle globale de mouvement réduit).
        .filter((animation) =>
          (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith(
            '::view-transition',
          ),
        )
        .map((animation) => Number(animation.effect?.getComputedTiming().duration ?? 0)),
    )
    expect(durations.every((duration) => duration <= 1)).toBe(true)
  })

  test('mobile : pas de passage de pièce, la navigation reste simple', async ({ page }) => {
    await watchTransitions(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fr')
    await page.locator('#conciergerie [data-etiquette] a').click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    await page.waitForTimeout(600)
    const { groups } = await counts(page)
    const moving = groups.filter(
      (entry) => entry.includes('piece-conciergerie') && !entry.endsWith(' 0'),
    )
    expect(moving).toEqual([])
  })

  test('rechargement direct de la page : titre et image présents', async ({ page }) => {
    await page.goto('/fr/services/conciergerie')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('img', { name: /vase rond et des clés/ })).toHaveCount(1)
  })

  test('après le passage, le focus part du titre de la page', async ({ page, browserName }) => {
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/fr')
    const link = await goToConciergeLink(page)
    await link.click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
    // La tabulation suivante reste dans le contenu de la page, et non au pied de page.
    await page.keyboard.press(tab)
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('main') && document.activeElement?.tagName,
      ),
    ).toMatch(/^(A|BUTTON)$/)
  })
})
