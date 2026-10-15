import { expect, test } from '@playwright/test'

// Story 2.5 : vidéos conditionnelles (desktop, sans mouvement réduit), bouton pause, aucune vidéo
// en mobile ni en mouvement réduit.

const videoRequests = (page: import('@playwright/test').Page) => {
  const urls: string[] = []
  page.on('request', (request) => {
    if (/\.(mp4|webm)(\?|$)/.test(request.url())) urls.push(request.url())
  })
  return urls
}

test('aucune vidéo téléchargée en mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const urls = videoRequests(page)
  await page.goto('/fr')
  await page.waitForTimeout(2500)
  expect(urls).toEqual([])
})

test('aucune vidéo en mouvement réduit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const urls = videoRequests(page)
  await page.goto('/fr')
  await page.waitForTimeout(2500)
  expect(urls).toEqual([])
  await expect(page.locator('#seuil-passage')).toHaveCount(0)
})

test('desktop : la vidéo du seuil joue et se met en pause au clavier', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr')
  const pause = page.getByRole('button', { name: 'Mettre la vidéo en pause' }).first()
  await expect(pause).toBeVisible({ timeout: 10000 })
  await pause.focus()
  await page.keyboard.press('Enter')
  // Le nom accessible change avec l'état et contient le mot visible (WCAG 2.5.3).
  const play = page.getByRole('button', { name: 'Lire la vidéo' }).first()
  await expect(play).toHaveText('Lire')
  await expect(play).toBeFocused()
})
