import { expect, test, type Page } from '@playwright/test'

// MT-03B : le retour arrière et le focus après une navigation interne. Causes mesurées et corrigées :
// le défilement doux (M12) animait la restauration du navigateur et la remontée de Next.js, et le
// focus partait au titre de l'accueil au retour. Les positions sont vérifiées à 2 px près.

const desktop = { width: 1440, height: 900 }

type Recorded = Window & { clickY?: number; afterBack?: number[] }

// Position au moment du clic (après le défilement automatique de Playwright vers le lien) : c'est
// celle que le navigateur note pour l'entrée quittée. Puis chaque position prise après un retour.
const record = (page: Page) =>
  page.addInitScript(() => {
    const w = window as Recorded
    document.addEventListener('click', () => (w.clickY = Math.round(window.scrollY)), true)
    addEventListener('popstate', () => (w.afterBack = []))
    addEventListener('scroll', () => w.afterBack?.push(Math.round(window.scrollY)), {
      passive: true,
    })
  })

const clickY = (page: Page) => page.evaluate(() => (window as Recorded).clickY ?? -1)
const afterBack = (page: Page) => page.evaluate(() => (window as Recorded).afterBack ?? [])
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY))

// Le temps d'un geste humain entre deux actions.
const pause = (page: Page) => page.waitForTimeout(300)

// Place la conciergerie à une position donnée (part de la hauteur de l'écran). Services empilés
// (téléphone, mouvement réduit) : le haut de son bloc à cette hauteur. File de cartes (M21) : une
// position du premier tiers de la piste, où la conciergerie est en vedette et son lien visible.
const conciergeLink = async (page: Page, at = 0.42) => {
  await page.evaluate((at) => {
    const track = document.querySelector<HTMLElement>('[data-zoom]')!
    const block = document.getElementById('conciergerie')!
    const top =
      getComputedStyle(block).position === 'absolute'
        ? track.getBoundingClientRect().top +
          window.scrollY +
          (track.offsetHeight - window.innerHeight) * at * 0.4
        : block.getBoundingClientRect().top + window.scrollY - window.innerHeight * at
    window.scrollTo({ top, behavior: 'instant' })
  }, at)
  return page.locator('#conciergerie [data-etiquette] a')
}

const expectBackAt = (page: Page, before: number) =>
  expect.poll(async () => Math.abs((await scrollY(page)) - before)).toBeLessThanOrEqual(2)

const roundTrip = async (page: Page, at = 0.42, wait = 300) => {
  await (await conciergeLink(page, at)).click()
  await expect(page).toHaveURL(/\/services\/(conciergerie|concierge)$/)
  const before = await clickY(page)
  await page.waitForTimeout(wait)
  await page.goBack()
  await expect(page).toHaveURL(/\/(fr|en)$/)
  await expectBackAt(page, before)
  return before
}

test.beforeEach(async ({ page }) => {
  await record(page)
  await page.setViewportSize(desktop)
})

test.describe('MT-03B · retour arrière', () => {
  for (const [label, wait] of [
    ['aussitôt (50 ms)', 50],
    ['après trois secondes', 3000],
  ] as const) {
    test(`retour ${label} : la position exacte, sans glissement`, async ({ page }) => {
      await page.goto('/fr')
      const before = await roundTrip(page, 0.42, wait)
      await page.waitForTimeout(300)
      // Aucune position intermédiaire : la page revient d'un coup, elle ne glisse pas.
      expect((await afterBack(page)).filter((y) => Math.abs(y - before) > 2)).toEqual([])
    })
  }

  for (const afterRoundTrip of [false, true]) {
    test(`une entrée du seuil défile toujours en douceur (M12)${afterRoundTrip ? ', après un retour' : ''}`, async ({
      page,
    }) => {
      await page.goto('/fr')
      if (afterRoundTrip) {
        await roundTrip(page)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await pause(page)
      }
      const positions = await page.evaluate(() => {
        const seen: number[] = []
        addEventListener('scroll', () => seen.push(Math.round(window.scrollY)), { passive: true })
        return new Promise<number[]>((resolve) => {
          document.querySelector<HTMLElement>('a[href="#conciergerie"]')!.click()
          setTimeout(() => resolve(seen), 1200)
        })
      })
      // Plusieurs positions intermédiaires : le défilement est animé, il ne saute pas.
      expect(new Set(positions).size).toBeGreaterThan(3)
    })
  }

  test('trois allers-retours, depuis trois positions', async ({ page }) => {
    await page.goto('/fr')
    for (const at of [0.2, 0.42, 0.7]) await roundTrip(page, at)
  })

  test('en anglais', async ({ page }) => {
    await page.goto('/en')
    await roundTrip(page)
  })

  test('mouvement réduit', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/fr')
    await roundTrip(page)
  })

  test('téléphone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fr')
    await roundTrip(page, 0.3)
  })

  test('au clavier : au retour, le focus revient sur le lien suivi', async ({
    page,
    browserName,
  }) => {
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
    await page.goto('/fr')
    const link = await conciergeLink(page)
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    const before = await clickY(page)
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
    await pause(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/fr$/)
    await expectBackAt(page, before)
    await expect(page.locator('#conciergerie [data-etiquette] a')).toBeFocused()
    // La tabulation suivante continue dans l'accueil, au service suivant, sans remonter.
    await page.keyboard.press(tab)
    await expect(page.locator('#grand-age [data-etiquette] a')).toBeFocused()
    expect(await scrollY(page)).toBeGreaterThan(before - 2)
  })

  test('historique de plusieurs pages : deux retours ramènent à l’accueil', async ({ page }) => {
    await page.goto('/fr')
    await (await conciergeLink(page)).click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    const before = await clickY(page)
    await pause(page)
    await page.locator('header a[href="/fr/la-maison"]:visible').click()
    await expect(page).toHaveURL(/\/fr\/la-maison$/)
    await pause(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    await pause(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/fr$/)
    await expectBackAt(page, before)
    await expect(page.locator('#conciergerie [data-etiquette] a')).toBeFocused()
  })

  test('sans l’API Navigation (Safari avant 26.2) : la position revient, sans erreur', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      // @ts-expect-error simulation d'un navigateur sans l'API
      delete window.navigation
      Object.defineProperty(window, 'navigation', { value: undefined })
    })
    await page.goto('/fr')
    await roundTrip(page)
    expect(errors).toEqual([])
  })

  test('réseau lent et processeur ralenti (Chromium)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'ralentissement par le protocole de Chromium')
    await page.goto('/fr')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400,
      downloadThroughput: 200_000,
      uploadThroughput: 90_000,
    })
    await roundTrip(page, 0.42, 150)
  })

  test('page de service actualisée, puis retour', async ({ page }) => {
    await page.goto('/fr')
    await (await conciergeLink(page)).click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    const before = await clickY(page)
    await page.reload({ waitUntil: 'networkidle' })
    await pause(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/fr$/)
    await expectBackAt(page, before)
  })
})

test.describe('MT-03B · arrivée et focus', () => {
  test('un lien suivi loin du haut ouvre la page suivante tout en haut, en-tête visible', async ({
    page,
  }) => {
    await page.goto('/fr')
    await (await conciergeLink(page)).click()
    await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
    await expect.poll(() => scrollY(page)).toBe(0)
    await page.waitForTimeout(600)
    expect(await scrollY(page)).toBe(0)
    await expect(page.locator('header').first()).toBeInViewport()
  })

  test('depuis le pied de page aussi', async ({ page }) => {
    await page.goto('/fr')
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    )
    await page.locator('footer a[href="/fr/mentions-legales"]:visible').click()
    await expect(page).toHaveURL(/\/fr\/mentions-legales$/)
    await page.waitForTimeout(600)
    expect(await scrollY(page)).toBe(0)
    await expect(page.locator('header').first()).toBeInViewport()
  })

  test('accès direct à une adresse : le focus ne bouge pas', async ({ page }) => {
    await page.goto('/fr/services/conciergerie')
    await pause(page)
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY')
  })

  test('aucun écouteur ajouté à chaque navigation (Chromium)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'inventaire des écouteurs par le protocole de Chromium')
    await page.goto('/fr')
    const cdp = await page.context().newCDPSession(page)
    const listeners = async () => {
      const counts: Record<string, number> = {}
      for (const target of ['window', 'document']) {
        const { result } = await cdp.send('Runtime.evaluate', { expression: target })
        const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
          objectId: result.objectId!,
        })
        for (const { type } of listeners)
          counts[`${target} ${type}`] = (counts[`${target} ${type}`] ?? 0) + 1
      }
      return counts
    }
    // Un premier aller-retour installe ce que Next.js et React installent une fois pour toutes.
    await roundTrip(page)
    const start = await listeners()
    for (let round = 0; round < 3; round++) await roundTrip(page)
    expect(await listeners()).toEqual(start)
  })
})

test.describe('MT-03B · passage de pièce', () => {
  // Départ en 4:5, arrivée en 0,67 (1024 px) ou 0,89 (1920 px) : chaque instantané agrandi doit rester
  // dans son cadre, sinon les deux images se voient l'une sur l'autre pendant le fondu.
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    test(`les deux instantanés restent dans leur cadre (${viewport.width} px)`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const w = window as Window & { clipped?: string[] }
        const start = document.startViewTransition?.bind(document)
        if (!start) return
        document.startViewTransition = ((...args: Parameters<typeof start>) => {
          const transition = start(...args)
          transition.ready
            .then(() => {
              w.clipped = ['old', 'new'].map(
                (part) =>
                  getComputedStyle(
                    document.documentElement,
                    `::view-transition-${part}(piece-conciergerie)`,
                  ).overflow,
              )
            })
            .catch(() => {})
          return transition
        }) as typeof document.startViewTransition
      })
      await page.setViewportSize(viewport)
      await page.goto('/fr')
      await (await conciergeLink(page)).click()
      await expect(page).toHaveURL(/\/fr\/services\/conciergerie$/)
      await expect
        .poll(() => page.evaluate(() => (window as Window & { clipped?: string[] }).clipped))
        .toEqual(['clip', 'clip'])
    })
  }
})
