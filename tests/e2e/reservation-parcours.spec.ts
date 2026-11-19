import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import pg from 'pg'

import { codeTotp, secretDeLUri } from '../integration/totp'

// Réservation d'un appel de bout en bout (story 3.10) : lien créé dans le coffre (TOTP), affiché une
// fois, journalisé sans valeur ; page de réservation sans JavaScript (une GET ne modifie rien, erreurs
// et saisie conservée, réservation, confirmation, fichier .ics) ; lien consommé ; créneau pris par
// une autre personne (« Ce créneau vient d'être pris », voisins en tête, saisie conservée) ; axe
// WCAG 2.2 AA en FR et EN ; aucune violation de la CSP ; jeton jamais en clair en base.
// IGNORÉ PAR DÉFAUT sans `RESERVATION_E2E_DATABASE_URL` : il lui faut une base jetable (nom en _test,
// VIDÉE par le test) et un serveur branché dessus, avec les deux rôles. Projet Playwright
// `reservation` : playwright.config.ts démarre alors ce serveur dédié, sur le port 3200 (variables
// posées par la configuration), à côté du serveur de la suite (3100), qui garde son formulaire
// « fermé ». En CI : .github/workflows/ci.yml (base sur le service Postgres, clé produite à la volée).
// En local :
//   createdb maison_triona_reservation_e2e_test
//   npm run build
//   RESERVATION_E2E_DATABASE_URL=postgres://localhost:5432/maison_triona_reservation_e2e_test \
//     npm run test:e2e:reservation
//   (puis dropdb maison_triona_reservation_e2e_test)
// Migrations, rôles et compte factice : posés par le test lui-même (preparer).
// Clé publique du coffre : `RESERVATION_E2E_VAULT_PUBLIC_KEY` (CI, produite à la volée), sinon une
// clé factice dont la clé privée n'a pas été gardée : rien de ce qui est scellé ici ne se rouvre.
// Données factices uniquement.

const BASE = process.env.RESERVATION_E2E_DATABASE_URL
const RACINE = `${resolve(__dirname, '../..')}/`
const EMAIL = 'reservation-e2e@exemple.test'
const MOT_DE_PASSE = 'mot-de-passe-factice-e2e-reservation-0001'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const NOM = 'Hortense Parcours-Factice'
const NUMERO = '+32 470 98 76 54'

// Origine du serveur dédié (projet `reservation`, port 3200).
function origine(): string {
  return new URL(test.info().project.use.baseURL ?? 'http://localhost:3200').origin
}

// Base vidée, migrée, rôles posés, compte factice : par un sous-processus Node (modules du projet).
function preparer(): void {
  const url = (chemin: string) => JSON.stringify(pathToFileURL(`${RACINE}${chemin}`).href)
  const script = `
    import { readFile } from 'node:fs/promises'
    import { fileURLToPath } from 'node:url'
    import pg from 'pg'
    import { migrate } from ${url('src/lib/db/migrate.ts')}
    import { creerAuth } from ${url('src/lib/auth/auth.ts')}
    import { creerCompte } from ${url('src/lib/auth/comptes.ts')}
    const base = process.env.BASE
    if (!decodeURIComponent(new URL(base).pathname.slice(1)).endsWith('_test')) {
      throw new Error('Base refusée : le nom doit finir par _test')
    }
    const admin = new pg.Pool({ connectionString: base })
    const coffre = new pg.Pool({ connectionString: base, options: '-c role=coffre' })
    await admin.query('DROP SCHEMA public CASCADE')
    await admin.query('CREATE SCHEMA public')
    await migrate(admin, fileURLToPath(${url('db/migrations')}))
    for (const role of ['site_public', 'coffre']) {
      await admin.query(await readFile(new URL(\`db/roles/\${role}.sql\`, ${url('')}), 'utf8'))
    }
    const auth = creerAuth(coffre, {
      BETTER_AUTH_SECRET: 'secret-factice-preparation-0123456789-abcdef',
      BETTER_AUTH_URL: process.env.ORIGINE,
    })
    await creerCompte(auth, coffre, { nom: 'Compte Factice', email: process.env.EMAIL, motDePasse: process.env.MDP })
    await admin.end(); await coffre.end()
  `
  execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script],
    { cwd: RACINE, env: { ...process.env, BASE, EMAIL, MDP: MOT_DE_PASSE, ORIGINE: origine() } },
  )
}

async function etatDesTables(base: pg.Pool): Promise<string> {
  const jetons = await base.query('SELECT * FROM booking_tokens ORDER BY id')
  const appels = await base.query('SELECT * FROM bookings ORDER BY id')
  return JSON.stringify([jetons.rows, appels.rows])
}

// Toute la base en texte (octets en hexadécimal) : ce qu'un lecteur de la base verrait.
async function toutLeTexte(base: pg.Pool): Promise<string> {
  const { rows: tables } = await base.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  )
  const morceaux: string[] = []
  for (const { table_name } of tables) {
    const { rows } = await base.query<{ ligne: string }>(
      `SELECT t::text AS ligne FROM "${table_name}" t`,
    )
    morceaux.push(...rows.map((row) => row.ligne))
  }
  return morceaux.join('\n').toLowerCase()
}

async function creerLien(page: Page, langue: 'Français' | 'Anglais' = 'Français'): Promise<string> {
  const section = page.getByRole('region', { name: 'Lien de réservation d’un appel' })
  await section.getByLabel(langue).check()
  const avant = await section.locator('code').count()
  await section.getByRole('button', { name: 'Créer un lien de réservation' }).click()
  const code = section.locator('code')
  if (avant > 0) {
    await expect(code).not.toHaveText(await code.innerText())
  }
  await expect(code).toContainText('/contact/appel/')
  return (await code.innerText()).trim()
}

async function sansJavaScript(browser: Browser) {
  const contexte = await browser.newContext({ javaScriptEnabled: false })
  return { contexte, page: await contexte.newPage() }
}

test.describe('réservation d’un appel de bout en bout', () => {
  test.skip(
    !BASE,
    'RESERVATION_E2E_DATABASE_URL absente : base et serveur dédiés requis (voir en tête)',
  )
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('lien du coffre, réservation sans JavaScript, créneau pris, confirmation et .ics', async ({
    page,
    browser,
  }) => {
    preparer()
    const base = new pg.Pool({ connectionString: BASE })
    const violations: string[] = []
    page.on('console', (message) => {
      if (message.text().includes('Content Security Policy')) violations.push(message.text())
    })

    try {
      // Connexion et enrôlement du TOTP.
      await page.goto('/coffre/connexion')
      await page.getByLabel('Adresse e-mail').fill(EMAIL)
      await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE)
      await page.getByRole('button', { name: 'Se connecter' }).click()
      await page.waitForURL('**/coffre/enrolement')
      await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE)
      await page.getByRole('button', { name: 'Afficher le secret' }).click()
      const uri = (await page.locator('code', { hasText: 'otpauth://' }).innerText()).trim()
      await page.locator('#code').fill(codeTotp(secretDeLUri(uri)))
      await page.getByRole('button', { name: 'Confirmer et ouvrir le coffre' }).click()
      await page.waitForURL(/\/coffre$/)

      // Un lien, affiché une fois, empreinte seule en base, journal sans valeur.
      const lien = await creerLien(page)
      const jeton = new URL(lien).pathname.split('/').at(-1) ?? ''
      expect(new URL(lien).origin).toBe(origine())
      expect(new URL(lien).pathname).toMatch(/^\/fr\/contact\/appel\/[A-Za-z0-9_-]{43}$/)
      const { rows: jetons } = await base.query('SELECT token_hash, used_at FROM booking_tokens')
      expect(jetons).toHaveLength(1)
      expect(jetons[0].token_hash.toString('hex')).toBe(
        createHash('sha256').update(jeton).digest('hex'),
      )
      const { rows: journal } = await base.query(
        `SELECT actor, request_id FROM vault_access_log WHERE action = 'booking_link'`,
      )
      expect(journal).toEqual([{ actor: EMAIL, request_id: null }])
      expect(await toutLeTexte(base)).not.toContain(jeton.toLowerCase())
      await page.reload()
      await expect(page.locator('code', { hasText: '/contact/appel/' })).toHaveCount(0)

      // Page de réservation sans JavaScript : une GET ne modifie rien.
      const avant = await etatDesTables(base)
      const nu = await sansJavaScript(browser)
      try {
        const reponse = await nu.page.goto(new URL(lien).pathname)
        expect(reponse?.headers()['referrer-policy']).toBe('strict-origin')
        expect(reponse?.headers()['cache-control']).toContain('no-store')
        expect(reponse?.headers()['set-cookie']).toBeUndefined()
        await nu.page.reload()
        expect(await etatDesTables(base)).toBe(avant)
        await expect(nu.page.getByRole('heading', { level: 1 })).toHaveText('Convenons d’un appel.')
        const tete = nu.page.getByRole('group', { name: 'Les prochains moments libres' })
        await expect(tete.getByRole('radio')).toHaveCount(3)
        await expect(nu.page.getByText('Nous ne laissons jamais de message vocal.')).toBeVisible()

        // Envoi incomplet : résumé d'erreurs, saisie conservée.
        await nu.page.getByLabel('Votre nom').fill(NOM)
        await nu.page.getByRole('button', { name: 'Convenir de cet appel' }).click()
        await expect(nu.page.getByRole('alert')).toContainText('3 points à revoir')
        await expect(nu.page.getByLabel('Votre nom')).toHaveValue(NOM)
        expect(await etatDesTables(base)).toBe(avant)

        // Case SMS masquée tant que le fournisseur n'est pas choisi (BOOKING_SMS_OPT_IN absente).
        await expect(nu.page.getByLabel('Me prévenir aussi par SMS')).toHaveCount(0)

        // Réservation : premier créneau, numéro, consentement.
        const premier = tete.getByRole('radio').first()
        const libellePremier = (
          await nu.page.locator(`label[for="${await premier.getAttribute('id')}"]`).innerText()
        ).trim()
        await premier.check()
        await nu.page.getByLabel('Votre numéro').fill(NUMERO)
        await nu.page.getByLabel(/^J’accepte que Maison Triona/).check()
        await nu.page.getByRole('button', { name: 'Convenir de cet appel' }).click()
        await nu.page.waitForURL(/\/confirmation$/)
        await expect(nu.page.getByRole('heading', { level: 1 })).toHaveText(
          'Votre appel est convenu.',
        )
        const [jour, heure] = libellePremier.split(', ')
        await expect(nu.page.locator('main')).toContainText(`${jour}, à ${heure}`)

        // Fichier .ics produit sur le serveur : UID stable, rien de sensible.
        const href = await nu.page
          .getByRole('link', { name: 'Ajouter à mon agenda' })
          .getAttribute('href')
        const ics = await nu.page.request.get(href ?? '')
        expect(ics.status()).toBe(200)
        expect(ics.headers()['content-type']).toContain('text/calendar')
        expect(ics.headers()['cache-control']).toContain('no-store')
        const texte = await ics.text()
        expect(texte).toMatch(/^BEGIN:VCALENDAR\r\n/)
        expect(texte).toMatch(/\r\nUID:[0-9a-f-]{36}-guest@maisontriona\.com\r\n/)
        for (const interdit of ['Hortense', '470', 'conciergerie', 'enfants', 'grand', jeton]) {
          expect(texte).not.toContain(interdit)
        }

        // En base : une réservation, scellée à taille fixe, lien consommé, jeton et nom illisibles.
        const { rows: appels } = await base.query(
          `SELECT status, octet_length(sealed) AS taille FROM bookings`,
        )
        expect(appels).toEqual([{ status: 'confirmed', taille: 2096 }])
        const { rows: consomme } = await base.query('SELECT used_at FROM booking_tokens')
        expect(consomme[0].used_at).not.toBeNull()
        const tout = await toutLeTexte(base)
        for (const interdit of [jeton.toLowerCase(), 'hortense', '98 76 54']) {
          expect(tout).not.toContain(interdit)
        }

        // Le lien ne rouvre plus la réservation.
        await nu.page.goto(new URL(lien).pathname)
        await expect(nu.page.getByRole('heading', { level: 1 })).toHaveText(
          'Ce lien n’est plus valable.',
        )
      } finally {
        await nu.contexte.close()
      }

      // Créneau pris entre-temps (avec JavaScript) : deux liens, même premier créneau.
      const lienA = await creerLien(page)
      const lienB = await creerLien(page, 'Anglais')
      expect(lienB).toContain('/en/contact/appel/')
      const pageB = await page.context().newPage()
      const pageA = await page.context().newPage()
      await pageA.goto(new URL(lienA).pathname)
      await pageB.goto(new URL(lienB).pathname)
      // axe sur la page de réservation, FR et EN.
      for (const ouverte of [pageA, pageB]) {
        const axe = await new AxeBuilder({ page: ouverte }).withTags(TAGS).analyze()
        expect(axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.length }))).toEqual([])
      }
      const choisi = pageA
        .getByRole('group', { name: 'Les prochains moments libres' })
        .getByRole('radio')
        .first()
      const valeur = await choisi.getAttribute('value')
      await pageB.locator(`input[name="creneau"][value="${valeur}"]`).check()
      await pageB.getByLabel('Your name').fill('Ysolde Factice')
      await pageB.getByLabel('Your number').fill('+33 6 12 34 56 78')
      await pageB.getByLabel(/^I agree that Maison Triona/).check()
      await pageB.getByRole('button', { name: 'Arrange this call' }).click()
      await pageB.waitForURL(/\/confirmation$/)
      await expect(pageB.getByRole('heading', { level: 1 })).toHaveText('Your call is arranged.')

      await choisi.check()
      await pageA.getByLabel('Votre nom').fill(NOM)
      await pageA.getByLabel('Votre numéro').fill(NUMERO)
      await pageA.locator('#appel-langue-en').check()
      await pageA.getByLabel(/^J’accepte que Maison Triona/).check()
      await pageA.getByRole('button', { name: 'Convenir de cet appel' }).click()
      const statut = pageA.locator('#appel-statut')
      await expect(statut).toContainText('Ce créneau vient d’être pris.')
      await expect(statut).toBeFocused()
      await expect(
        pageA.getByRole('group', { name: 'Les moments les plus proches' }).getByRole('radio'),
      ).toHaveCount(3)
      await expect(pageA.locator(`input[name="creneau"][value="${valeur}"]`)).toHaveCount(0)
      await expect(pageA.getByLabel('Votre nom')).toHaveValue(NOM)
      await expect(pageA.getByLabel('Votre numéro')).toHaveValue(NUMERO)
      await expect(pageA.locator('#appel-langue-en')).toBeChecked()
      await expect(pageA.getByLabel(/^J’accepte que Maison Triona/)).toBeChecked()

      // Un voisin, et la réservation aboutit.
      await pageA
        .getByRole('group', { name: 'Les moments les plus proches' })
        .getByRole('radio')
        .first()
        .check()
      await pageA.getByRole('button', { name: 'Convenir de cet appel' }).click()
      await pageA.waitForURL(/\/confirmation$/)
      const { rows: total } = await base.query(
        `SELECT count(*)::int AS n, count(DISTINCT starts_at)::int AS d FROM bookings WHERE status = 'confirmed'`,
      )
      expect(total[0]).toEqual({ n: 3, d: 3 })
      expect(violations).toEqual([])
    } finally {
      await base.end()
    }
  })
})
