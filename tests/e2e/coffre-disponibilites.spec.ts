import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import pg from 'pg'

import { codeTotp, secretDeLUri } from '../integration/totp'

// Page des disponibilités réelle (story 3.8, partie B), de bout en bout : connexion, TOTP, lien depuis
// l'accueil, valeurs par défaut, aperçu des créneaux, réglages, semaine type, absence, journée
// bloquée, jour férié décoché puis recoché, journal sans valeur, axe WCAG 2.2 AA, aucune violation
// de la CSP, action refusée sans session.
// IGNORÉ PAR DÉFAUT : il lui faut une base jetable (nom en _test, VIDÉE par le test) et un serveur
// branché dessus. Variable distincte de coffre-lecture.spec.ts : les deux vident la base, ils ne
// tournent jamais ensemble. Pour le lancer :
//   createdb maison_triona_e2e_test
//   npm run build
//   COFFRE_DATABASE_URL='postgres://localhost:5432/maison_triona_e2e_test?options=-c%20role%3Dcoffre' \
//     BETTER_AUTH_SECRET=secret-factice-e2e-0123456789-abcdefghijkl BETTER_AUTH_URL=http://localhost:3100 \
//     npx next start -p 3100 &
//   COFFRE_DISPONIBILITES_E2E_DATABASE_URL=postgres://localhost:5432/maison_triona_e2e_test \
//     npx playwright test tests/e2e/coffre-disponibilites.spec.ts
//   (arrêter le serveur, puis dropdb maison_triona_e2e_test)
// Données factices uniquement.

const BASE = process.env.COFFRE_DISPONIBILITES_E2E_DATABASE_URL
const RACINE = `${resolve(__dirname, '../..')}/`
const EMAIL = 'disponibilites-e2e@exemple.test'
const MOT_DE_PASSE = 'mot-de-passe-factice-e2e-disponibilites-01'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

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
      BETTER_AUTH_URL: 'http://localhost:3100',
    })
    await creerCompte(auth, coffre, { nom: 'Compte Factice', email: process.env.EMAIL, motDePasse: process.env.MDP })
    await admin.end(); await coffre.end()
  `
  execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script],
    { cwd: RACINE, env: { ...process.env, BASE, EMAIL, MDP: MOT_DE_PASSE } },
  )
}

async function statut(page: Page, texte: string) {
  await expect(page.getByRole('status')).toHaveText(texte)
}

test.describe('page des disponibilités réelle du coffre', () => {
  test.skip(
    !BASE,
    'COFFRE_DISPONIBILITES_E2E_DATABASE_URL absente : base et serveur dédiés requis (voir en tête)',
  )
  test.describe.configure({ mode: 'serial', timeout: 180_000 })

  test('règle les disponibilités, journalise sans valeur, sans violation de la CSP', async ({
    page,
    context,
  }) => {
    preparer()
    const base = new pg.Pool({ connectionString: BASE })
    const violations: string[] = []
    page.on('console', (message) => {
      if (message.text().includes('Content Security Policy')) violations.push(message.text())
    })

    try {
      // Connexion, enrôlement du TOTP, accueil, lien vers les disponibilités.
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
      await page.getByRole('link', { name: 'Disponibilités des appels' }).click()
      await page.waitForURL(/\/coffre\/disponibilites$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Disponibilités')

      // Valeurs par défaut de la spec §3.1 et aperçu des créneaux.
      await expect(page.locator('#duree')).toHaveValue('30')
      await expect(page.locator('#pause')).toHaveValue('15')
      await expect(page.locator('#delai')).toHaveValue('24')
      await expect(page.locator('#horizon')).toHaveValue('21')
      await expect(page.locator('#plafond')).toHaveValue('4')
      const lundi = page.locator('dl > div').filter({ hasText: 'Lundi' })
      await expect(lundi).toContainText('10 h 30 à 12 h 30')
      await expect(lundi).toContainText('16 h à 18 h')
      const apercu = page.getByRole('region', { name: 'Prochains créneaux' })
      // Une journée entière (le premier jour peut être entamé par le délai de 24 heures).
      const journeeEntiere = (heures: string) =>
        apercu.getByRole('listitem').filter({ hasText: heures }).first()
      await expect(
        journeeEntiere('10 h 30 · 11 h 15 · 12 h · 16 h · 16 h 45 · 17 h 30'),
      ).toBeVisible()
      expect(await apercu.getByRole('listitem').count()).toBeGreaterThan(5)

      const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze()
      expect(axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.length }))).toEqual([])

      // Réglages : 45 minutes, le pas de l'aperçu suit (45 + 15).
      await page.locator('#duree').fill('45')
      await page.getByRole('button', { name: 'Enregistrer les réglages' }).click()
      await statut(page, 'Les réglages des appels sont enregistrés.')
      await expect(page.locator('#duree')).toHaveValue('45')
      await expect(journeeEntiere('10 h 30 · 11 h 30 · 16 h · 17 h')).toBeVisible()
      await expect(apercu.getByRole('listitem').filter({ hasText: '11 h 15' })).toHaveCount(0)

      // Semaine type : ajout d'une plage le samedi, chevauchement refusé, retrait.
      await page.locator('#plage-jour').selectOption({ label: 'Samedi' })
      await page.locator('#plage-debut').fill('09:00')
      await page.locator('#plage-fin').fill('11:00')
      await page.getByRole('button', { name: 'Ajouter la plage' }).click()
      await statut(page, 'La plage est ajoutée à la semaine type.')
      const samedi = page.locator('dl > div').filter({ hasText: 'Samedi' })
      await expect(samedi).toContainText('9 h à 11 h')

      await page.locator('#plage-jour').selectOption({ label: 'Lundi' })
      await page.locator('#plage-debut').fill('12:00')
      await page.locator('#plage-fin').fill('13:00')
      await page.getByRole('button', { name: 'Ajouter la plage' }).click()
      await expect(page.locator('#erreurs-disponibilites')).toContainText(
        'Erreur : cette plage chevauche une autre plage du même jour.',
      )
      await expect(page.locator('#erreurs-disponibilites')).toBeFocused()

      await samedi.getByRole('button', { name: /Retirer la plage du samedi/ }).click()
      await statut(page, 'La plage est retirée de la semaine type.')
      await expect(page.locator('dl > div').filter({ hasText: 'Samedi' })).toContainText(
        'Aucune plage',
      )

      // « Bloquer cette journée » en un clic depuis l'aperçu, puis débloquer.
      const premier = apercu.getByRole('listitem').first()
      const date = (await premier.locator('p').first().innerText()).trim()
      await premier.getByRole('button', { name: /Bloquer cette journée/ }).click()
      await statut(page, 'La journée est bloquée.')
      await expect(apercu.getByRole('listitem').first()).not.toContainText(date)
      const absences = page.getByRole('region', { name: 'Absences' })
      await expect(absences).toContainText(`Journée bloquée : ${date}`)
      await absences.getByRole('button', { name: /^Débloquer/ }).click()
      await statut(page, 'L’absence est retirée.')
      await expect(apercu.getByRole('listitem').first()).toContainText(date)

      // Absence : une plage de dates.
      await page.locator('#absence-du').fill('2027-02-01')
      await page.locator('#absence-au').fill('2027-02-05')
      await page.getByRole('button', { name: 'Ajouter l’absence' }).click()
      await statut(page, 'L’absence est enregistrée.')
      await expect(absences).toContainText(
        'Congé : Du lundi 1er février 2027 au vendredi 5 février 2027',
      )

      // Jour férié décoché, puis recoché.
      const ferie = page.getByLabel(/Mercredi 21 juillet 2027 · Fête nationale/)
      await expect(ferie).toBeChecked()
      await ferie.uncheck()
      await page.getByRole('button', { name: 'Enregistrer les jours fériés' }).click()
      await statut(page, 'Les jours fériés sont enregistrés.')
      await expect(ferie).not.toBeChecked()
      await ferie.check()
      await page.getByRole('button', { name: 'Enregistrer les jours fériés' }).click()
      await expect(ferie).toBeChecked()

      // Journal : une ligne `availability` par modification (réglages, plage ajoutée, plage retirée,
      // journée bloquée, débloquée, absence, férié décoché, recoché), qui et quand seulement.
      const { rows } = await base.query(
        `SELECT * FROM vault_access_log WHERE action = 'availability' ORDER BY id`,
      )
      expect(rows).toHaveLength(8)
      for (const ligne of rows) {
        expect(
          Object.entries(ligne)
            .filter(([, valeur]) => valeur !== null)
            .map(([colonne]) => colonne)
            .sort(),
        ).toEqual(['action', 'actor', 'at', 'id'])
        expect(ligne.actor).toBe(EMAIL)
      }

      // Session perdue (cookies effacés) : l'action revérifie l'accès, n'écrit rien.
      await context.clearCookies()
      await page.locator('#duree').fill('60')
      await page.getByRole('button', { name: 'Enregistrer les réglages' }).click()
      await page.waitForURL(/\/coffre\/connexion$/)
      const { rows: reglages } = await base.query('SELECT duration_minutes FROM booking_settings')
      expect(reglages[0]?.duration_minutes).toBe(45)
      const { rows: apres } = await base.query(
        `SELECT count(*)::int AS n FROM vault_access_log WHERE action = 'availability'`,
      )
      expect(apres[0]?.n).toBe(8)

      expect(violations).toEqual([])
    } finally {
      await base.end()
    }
  })
})
