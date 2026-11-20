import { expect, test, type Locator, type Page } from '@playwright/test'

// Focus jamais masqué (WCAG 2.4.11, CLAUDE.md § Accessibilité) là où le défilement ne suffit pas :
// sommaires et médias collants, suggestion de langue affichée. Playwright navigue en anglais : sur
// une page française, la suggestion « This site is also available in English. » s'affiche.

test.use({ viewport: { width: 1280, height: 800 } })

async function settle(page: Page) {
  // Défilement doux (M12) : attendre que la page ne bouge plus.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = -1
        let still = 0
        const tick = () => {
          if (scrollY === last) still += 1
          else still = 0
          last = scrollY
          if (still >= 4) resolve()
          else requestAnimationFrame(tick)
        }
        tick()
        setTimeout(resolve, 2000)
      }),
  )
}

async function expectFocusVisible(page: Page, target: Locator) {
  await target.focus()
  await settle(page)
  const visible = await target.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const points: [number, number][] = [
      [box.left + box.width / 2, box.top + box.height / 2],
      [box.left + 2, box.top + 2],
      [box.right - 2, box.bottom - 2],
    ]
    return points.every(([x, y]) => {
      const top = document.elementFromPoint(x, y)
      return top !== null && (top === element || element.contains(top))
    })
  })
  expect(visible).toBe(true)
}

const suggestion = (page: Page) =>
  page.getByRole('complementary', { name: 'This site is also available in English.' })

async function expectSuggestion(page: Page) {
  await expect(suggestion(page)).toBeVisible()
}

test('le dernier lien du sommaire de la politique de confidentialité reste visible au focus', async ({
  page,
}) => {
  await page.goto('/fr/confidentialite')
  await expectSuggestion(page)
  await expectFocusVisible(page, page.locator('nav[aria-labelledby="sommaire-titre"] a').last())
})

test('le dernier lien du sommaire de La Maison reste visible au focus', async ({ page }) => {
  await page.goto('/fr/la-maison')
  await expectSuggestion(page)
  await expectFocusVisible(page, page.locator('nav[aria-labelledby="sommaire-titre"] a').last())
})

test('le bouton pause des scènes collantes passe au-dessus de la suggestion de langue', async ({
  page,
}) => {
  await page.goto('/fr/services')
  await expectSuggestion(page)
  const buttons = page.getByRole('button', { name: /vidéo/ })
  // Le bouton pause n'apparaît qu'après l'hydratation (PauseVideosButton, `useEffect`), qui peut
  // suivre l'événement `load` où `goto` rend la main : attendre le premier avant de compter (avec
  // un processeur ralenti six fois, compter tout de suite échouait 4 fois sur 10).
  await expect(buttons.first()).toBeVisible()
  expect(await buttons.count()).toBeGreaterThan(0)
  for (const button of await buttons.all()) await expectFocusVisible(page, button)
})

test('« Close » offre une cible de 48 px et rend la place en se fermant', async ({ page }) => {
  await page.goto('/fr/confidentialite')
  await expectSuggestion(page)
  const close = page.getByRole('button', { name: 'Close' })
  const box = await close.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(48)
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(48)
  await close.click()
  await expect(suggestion(page)).toHaveCount(0)
  const reserved = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--suggestion-langue-height'),
  )
  expect(reserved.trim()).toBe('0px')
})
