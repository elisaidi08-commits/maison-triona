import { defineConfig, devices } from '@playwright/test'

// Tests E2E et accessibilité sur un build de production (jamais `next dev`).
// En local, le build est lancé automatiquement (ou un serveur déjà ouvert sur le port est réutilisé) ;
// en CI, le build est fait par l'étape précédente.
const PORT = 3100
const baseURL = `http://localhost:${PORT}`

// Parcours de réservation avec base (story 3.10, tests/e2e/reservation-parcours.spec.ts), projet
// `reservation` : seulement si `RESERVATION_E2E_DATABASE_URL` est posée (base jetable en _test), un
// second serveur, sur son propre port, branché sur cette base (rôles `site_public` et `coffre`) et
// sur une clé publique de coffre. Le serveur de la suite (3100) n'a ni base ni clé : le formulaire de
// contact y reste « fermé ». Sans la variable, le projet n'a pas de serveur et son test s'ignore.
const RESERVATION_PORT = 3200
const reservationURL = `http://localhost:${RESERVATION_PORT}`
const reservationBase = process.env.RESERVATION_E2E_DATABASE_URL

function avecRole(url: string, role: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}options=-c%20role%3D${role}`
}

const serveur = process.env.CI ? 'npm run start --' : 'npm run build && npm run start --'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'e2e',
      testDir: './tests/e2e',
      testIgnore: /reservation-parcours\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    { name: 'a11y', testDir: './tests/a11y', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'reservation',
      testDir: './tests/e2e',
      testMatch: /reservation-parcours\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: reservationURL },
    },
  ],
  webServer: [
    {
      command: `${serveur} --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    ...(reservationBase
      ? [
          {
            // Le build est celui du serveur de la suite (même dossier .next) : démarrage seul.
            command: `npm run start -- --port ${RESERVATION_PORT}`,
            url: reservationURL,
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
            env: {
              DATABASE_URL: avecRole(reservationBase, 'site_public'),
              COFFRE_DATABASE_URL: avecRole(reservationBase, 'coffre'),
              // Clé factice par défaut (clé privée non gardée) ; la CI en produit une à la volée.
              VAULT_PUBLIC_KEY:
                process.env.RESERVATION_E2E_VAULT_PUBLIC_KEY ??
                'wexjuk1fSzFzd2w6IQBjeT/dStKAPNwvb9+RUlVKmy8=',
              BETTER_AUTH_SECRET: 'secret-factice-e2e-reservation-0123456789-abcdef',
              BETTER_AUTH_URL: reservationURL,
              SITE_URL: reservationURL,
            },
          },
        ]
      : []),
  ],
})
