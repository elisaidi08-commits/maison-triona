import { defineConfig, devices } from '@playwright/test'

import {
  FAUX_SERVICES_PORT,
  FAUX_SERVICES_URL,
  FAUX_UPSTASH_TOKEN,
  JOURNAL_SERVEUR,
  SECRET_ADRESSE_E2E,
} from './tests/e2e/support/parcours'

// Tests E2E et accessibilité sur un build de production (jamais `next dev`).
// En local, le build est lancé automatiquement (ou un serveur déjà ouvert sur le port est réutilisé) ;
// en CI, le build est fait par l'étape précédente.
const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${PORT}`

// Parcours de réservation avec base (story 3.10, tests/e2e/reservation-parcours.spec.ts), projet
// `reservation` : seulement si `RESERVATION_E2E_DATABASE_URL` est posée (base jetable en _test), un
// second serveur, sur son propre port, branché sur cette base (rôles `site_public` et `coffre`) et
// sur une clé publique de coffre. Le serveur de la suite (3100) n'a ni base ni clé : le formulaire de
// contact y reste « fermé ». Sans la variable, le projet n'a pas de serveur et son test s'ignore.
// Depuis la story 3.9, le même projet porte le parcours de la demande de lien
// (tests/e2e/demande-de-lien-parcours.spec.ts) : le serveur dédié reçoit aussi le compte de l'envoi,
// les e-mails (TEM redirigé vers un double de test par `--import`, sans rien changer au site), la
// limitation de débit (Upstash, double de test) et le secret des empreintes d'adresse ; son journal
// est recopié dans un fichier que le test relit (ni adresse ni jeton). Un seul processus de test à la
// fois (`workers: 1`) : les parcours vident la même base. Depuis la story 3.13, il porte aussi
// l'agenda des appels (tests/e2e/agenda-parcours.spec.ts).
// Secret du formulaire des serveurs de test (horodatage, sel des empreintes d'IP, lien de gestion).
const SECRET_FORMULAIRE_E2E = 'secret-factice-e2e-formulaire-0123456789-abcdef'

const RESERVATION_PORT = Number(process.env.RESERVATION_PORT ?? 3200)
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
      testIgnore: /-parcours\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    { name: 'a11y', testDir: './tests/a11y', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'reservation',
      testDir: './tests/e2e',
      testMatch: /(reservation|demande-de-lien|agenda)-parcours\.spec\.ts/,
      workers: 1,
      use: { ...devices['Desktop Chrome'], baseURL: reservationURL },
    },
  ],
  webServer: [
    {
      command: `${serveur} --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      // `next start` tourne en production : le secret du formulaire n'a plus de repli (story 3.11,
      // src/lib/security/secret.ts). Secret factice, jamais déployé.
      env: { FORM_SIGNING_SECRET: SECRET_FORMULAIRE_E2E },
    },
    ...(reservationBase
      ? [
          {
            // Doubles de test d'Upstash et de TEM (story 3.9).
            command: `node tests/e2e/support/faux-services.mjs ${FAUX_SERVICES_PORT}`,
            url: FAUX_SERVICES_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
            env: { FAUX_UPSTASH_TOKEN },
          },
          {
            // Le build est celui du serveur de la suite (même dossier .next) : démarrage seul. Le
            // journal du serveur est aussi écrit dans JOURNAL_SERVEUR, relu par le test.
            command: `npm run start -- --port ${RESERVATION_PORT} 2>&1 | tee "${JOURNAL_SERVEUR}"`,
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
              FORM_SIGNING_SECRET: SECRET_FORMULAIRE_E2E,
              BETTER_AUTH_URL: reservationURL,
              SITE_URL: reservationURL,
              // Demande de lien (story 3.9) : envoi, e-mails factices, limitation, empreintes.
              ENVOI_DATABASE_URL: avecRole(reservationBase, 'envoi'),
              TEM_SECRET_KEY: 'cle-factice-e2e-tem',
              TEM_PROJECT_ID: '6f1c1c3e-2b8a-4c55-9a0f-0d3f5b2e7a41',
              EMAIL_FROM: 'Maison Triona <envoi@exemple.test>',
              EMAIL_NOTIFY_TO: 'notification@exemple.test',
              EMAIL_ALERT_TO: 'alerte@exemple.test',
              UPSTASH_REDIS_REST_URL: FAUX_SERVICES_URL,
              UPSTASH_REDIS_REST_TOKEN: FAUX_UPSTASH_TOKEN,
              BOOKING_EMAIL_HMAC_SECRET: SECRET_ADRESSE_E2E,
              FAUX_TEM_URL: FAUX_SERVICES_URL,
              NODE_OPTIONS: '--import ./tests/e2e/support/rediriger-tem.mjs',
            },
          },
        ]
      : []),
  ],
})
