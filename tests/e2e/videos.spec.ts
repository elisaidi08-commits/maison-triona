import { expect, test as base } from '@playwright/test'
import { test } from '../fixtures'

// Vidéos conditionnelles (desktop, sans mouvement réduit), bouton pause, aucune vidéo en mobile ni
// en mouvement réduit, ouverture comprise (`base` : premier passage, l'ouverture s'affiche).

const videoRequests = (page: import('@playwright/test').Page) => {
  const urls: string[] = []
  page.on('request', (request) => {
    if (/\.(mp4|webm)(\?|$)/.test(request.url())) urls.push(request.url())
  })
  return urls
}

base('aucune vidéo téléchargée en mobile, ouverture comprise', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const urls = videoRequests(page)
  await page.goto('/fr')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(2500)
  expect(urls).toEqual([])
})

base('aucune vidéo en mouvement réduit, ouverture comprise', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const urls = videoRequests(page)
  await page.goto('/fr')
  await page.waitForTimeout(2500)
  expect(urls).toEqual([])
})

test('desktop : la vidéo du premier écran joue et se met en pause au clavier', async ({ page }) => {
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
