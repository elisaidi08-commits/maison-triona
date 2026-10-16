import { statSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Story 1.7 : carte au trait des Territoires, sur le banc d'essai (/fr/demo).

test('carte décorative, cinq points, rien de chargé hors du site', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const externes: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.origin !== origin) externes.push(request.url())
  })
  await page.goto('/fr/demo')

  const carte = page.locator('section[aria-labelledby="carte"] svg')
  await expect(carte).toHaveAttribute('aria-hidden', 'true')
  await expect(carte.locator('circle')).toHaveCount(5)
  await expect(carte.locator('path.fill-sapin-20')).toHaveCount(1)
  expect(externes).toEqual([])
})

test('tracé figé de moins de 60 ko', () => {
  expect(statSync('src/lib/carte-territoires.ts').size).toBeLessThanOrEqual(60_000)
})
