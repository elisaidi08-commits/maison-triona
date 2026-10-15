import { test as base, expect } from '@playwright/test'

// Visiteur qui a déjà vu l'ouverture de l'accueil pendant sa visite (D25) : les tests du reste du
// site ne passent pas par le film. L'ouverture a ses propres tests (tests/e2e/ouverture.spec.ts).

export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('mt-ouverture-vue', '1')
      } catch {
        // Stockage indisponible : l'ouverture s'affichera.
      }
    })
    await provide(page)
  },
})

export { expect }
