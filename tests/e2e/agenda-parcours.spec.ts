import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import pg from 'pg'

import { codeTotp, secretDeLUri } from '../integration/totp'

// Agenda des appels de Cat, de bout en bout (story 3.13 ; docs/reservation-appel.md §3.2) : lien depuis
// l'accueil du coffre (TOTP) ; heures et statuts sans clé, aucun nom ni numéro dans la page ; noms,
// numéros (lien tel:), langue, « pas de message vocal » et origine déchiffrés dans le navigateur avec
// un paquet de clé ; ni le nom ni le numéro ne passent par le serveur (aucune requête, aucune
// réponse), ni par le stockage du navigateur, ni par la base en clair ; « Fait » sur un appel passé,
// rattachement à une demande ; verrouillage ; journal sans contenu ; axe WCAG 2.2 AA ; aucune
// violation de la CSP.
// IGNORÉ PAR DÉFAUT sans `RESERVATION_E2E_DATABASE_URL`, comme reservation-parcours.spec.ts : même
// projet Playwright `reservation`, même serveur dédié (port 3200), même base jetable (nom en _test,
// VIDÉE par chaque test ; les deux fichiers ne tournent jamais en même temps : `workers: 1` sur le
// projet). Le paquet de clé est produit ici, et les appels sont scellés avec sa clé publique et
// écrits directement en base : la clé publique du serveur ne sert pas (l'agenda ne scelle rien).
// En local : voir reservation-parcours.spec.ts. Données factices uniquement.

const BASE = process.env.RESERVATION_E2E_DATABASE_URL
const RACINE = `${resolve(__dirname, '../..')}/`
const EMAIL = 'agenda-e2e@exemple.test'
const MOT_DE_PASSE = 'mot-de-passe-factice-e2e-agenda-000001'
const PHRASE = 'phrase factice du parcours de l’agenda, assez longue'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const FUSEAU = 'Europe/Brussels'

// Deux appels passés, confirmés et finis : « à qualifier », toujours affichés (dans la vue du jour,
// ou parmi ceux d'avant si le test tourne juste après minuit).
const HORTENSE = {
  nom: 'Hortense Agenda-Factice',
  telephone: '+32 470 98 76 54',
  langue: 'fr',
  sms: false,
  origine: 'salon',
}
const YSOLDE = {
  nom: 'Ysolde Agenda-Factice',
  telephone: '+33 6 12 34 56 78',
  langue: 'en',
  sms: false,
  origine: null,
}
const INTERDITS = ['hortense', 'ysolde', '98 76 54', '470987654', '12 34 56 78', '612345678']

interface Jeu {
  paquet: unknown
  hortense: { id: string; debut: string }
  ysolde: { id: string; debut: string }
  demande: string
}

// Base vidée, migrée, rôles posés, compte factice ; paquet de clé, deux appels scellés avec sa clé
// publique, une demande. Par un sous-processus Node (modules du projet), la phrase par
// l'environnement.
function preparer(): Jeu {
  const url = (chemin: string) => JSON.stringify(pathToFileURL(`${RACINE}${chemin}`).href)
  const script = `
    import { randomBytes, randomUUID } from 'node:crypto'
    import { readFile } from 'node:fs/promises'
    import { fileURLToPath } from 'node:url'
    import pg from 'pg'
    import { migrate } from ${url('src/lib/db/migrate.ts')}
    import { creerAuth } from ${url('src/lib/auth/auth.ts')}
    import { creerCompte } from ${url('src/lib/auth/comptes.ts')}
    import { createKeyPacket } from ${url('src/lib/vault/key-packet.ts')}
    import { sealBooking } from ${url('src/lib/vault/seal.ts')}
    import { insertRequest } from ${url('src/lib/vault/repository.ts')}
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
    const { packet, publicKey } = await createKeyPacket(process.env.PHRASE)
    const appel = async (champs, minutes) => {
      const id = randomUUID()
      const debut = new Date(Date.now() + minutes * 60000)
      const fin = new Date(debut.getTime() + 30 * 60000)
      // Appels passés : posés hors des bornes de la base (0014), le temps de l'instruction.
      const client = await admin.connect()
      try {
        await client.query('BEGIN')
        await client.query('SET LOCAL session_replication_role = replica')
        await client.query(
          \`INSERT INTO bookings (id, starts_at, ends_at, slot, privacy_version, retention_until, sealed)
           VALUES ($1, $2, $3, tstzrange($2, $4), '2026-11-19', $2::timestamptz + interval '1 year', $5)\`,
          [id, debut, fin, new Date(fin.getTime() + 15 * 60000), await sealBooking(champs, publicKey)],
        )
        await client.query('COMMIT')
      } finally {
        client.release()
      }
      return { id, debut: debut.toISOString() }
    }
    const hortense = await appel(JSON.parse(process.env.HORTENSE), -40)
    const ysolde = await appel(JSON.parse(process.env.YSOLDE), -100)
    const demande = await insertRequest(admin, {
      kind: 'request', service: 'conciergerie', country: 'BE', locale: 'fr', urgency: 'aucune',
      source: null, sealed: new Uint8Array(randomBytes(64)),
      retentionUntil: new Date(Date.now() + 365 * 86400000), privacyVersion: '2026-11-19',
    })
    await admin.end(); await coffre.end()
    process.stdout.write(JSON.stringify({ paquet: packet, hortense, ysolde, demande }))
  `
  const sortie = execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script],
    {
      cwd: RACINE,
      env: {
        ...process.env,
        BASE,
        EMAIL,
        MDP: MOT_DE_PASSE,
        PHRASE,
        ORIGINE: origine(),
        HORTENSE: JSON.stringify(HORTENSE),
        YSOLDE: JSON.stringify(YSOLDE),
      },
    },
  )
  return JSON.parse(sortie.toString('utf8')) as Jeu
}

function origine(): string {
  return new URL(test.info().project.use.baseURL ?? 'http://localhost:3200').origin
}

function jourBruxelles(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(instant)
}

// Toute la base en texte : ce qu'un lecteur de la base verrait.
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

async function attendreEnBase(base: pg.Pool, sql: string, params: unknown[], attendu: unknown) {
  await expect
    .poll(async () => (await base.query(sql, params)).rows[0]?.valeur, { timeout: 15_000 })
    .toEqual(attendu)
}

async function connecter(page: Page): Promise<void> {
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
}

function appelDe(page: Page, nom: string): Locator {
  return page.locator('li').filter({ hasText: nom })
}

test.describe('agenda des appels de bout en bout', () => {
  test.skip(
    !BASE,
    'RESERVATION_E2E_DATABASE_URL absente : base et serveur dédiés requis (voir en tête)',
  )
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('heures sans clé, noms et numéros déchiffrés dans le navigateur seulement, statut, rattachement', async ({
    page,
  }) => {
    const jeu = preparer()
    const base = new pg.Pool({ connectionString: BASE })
    const violations: string[] = []
    page.on('console', (message) => {
      if (message.text().includes('Content Security Policy')) violations.push(message.text())
    })
    // Tout ce qui part vers le serveur et tout ce qui en revient, en texte.
    const echanges: string[] = []
    page.on('request', (requete) => {
      echanges.push(`${requete.url()}\n${requete.postData() ?? ''}`)
    })
    page.on('response', async (reponse) => {
      if (!reponse.url().startsWith(origine())) return
      const type = reponse.request().resourceType()
      if (type !== 'document' && type !== 'fetch' && type !== 'xhr') return
      try {
        echanges.push(await reponse.text())
      } catch {
        // Corps indisponible (redirection) : rien à lire.
      }
    })

    try {
      await connecter(page)
      await page.getByRole('link', { name: 'Agenda des appels' }).click()
      await page.waitForURL(/\/coffre\/appels$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Appels')

      // Sans clé : heures et statuts, rien de la personne.
      await expect(page.getByText('À qualifier', { exact: true })).toHaveCount(2)
      await expect(page.getByText('Nom et numéro chiffrés.')).toHaveCount(2)
      const html = (await page.content()).toLowerCase()
      for (const interdit of INTERDITS) expect(html).not.toContain(interdit)
      const { rows: listes } = await base.query(
        "SELECT actor, booking_id, request_id FROM vault_access_log WHERE action = 'booking_list'",
      )
      expect(listes.length).toBeGreaterThanOrEqual(1)
      expect(listes[0]).toEqual({ actor: EMAIL, booking_id: null, request_id: null })

      // Déverrouillage dans le navigateur : paquet de clé et phrase.
      await page.locator('#paquet').setInputFiles({
        name: 'paquet-agenda.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(jeu.paquet)),
      })
      await page.locator('#phrase').fill(PHRASE)
      await page.getByRole('button', { name: 'Déverrouiller et lire' }).click()
      await expect(page.getByText(HORTENSE.nom)).toBeVisible({ timeout: 90_000 })
      await expect(page.getByText(YSOLDE.nom)).toBeVisible()
      // Le formulaire disparaît avec sa saisie ; il revient vide au verrouillage.
      await expect(page.locator('#phrase')).toHaveCount(0)

      const hortense = appelDe(page, HORTENSE.nom)
      const ysolde = appelDe(page, YSOLDE.nom)
      await expect(hortense.getByRole('link', { name: HORTENSE.telephone })).toHaveAttribute(
        'href',
        'tel:+32470987654',
      )
      await expect(ysolde.getByRole('link', { name: YSOLDE.telephone })).toHaveAttribute(
        'href',
        'tel:+33612345678',
      )
      await expect(hortense).toContainText('Français')
      await expect(hortense).toContainText('Salon')
      await expect(hortense).toContainText('Ne pas en laisser')
      await expect(ysolde).toContainText('Anglais')

      // Une ligne `booking_read` par appel, sans rien d'autre.
      const { rows: lectures } = await base.query(
        `SELECT booking_id FROM vault_access_log WHERE action = 'booking_read' ORDER BY booking_id`,
      )
      expect(lectures.map((ligne) => ligne.booking_id).sort()).toEqual(
        [jeu.hortense.id, jeu.ysolde.id].sort(),
      )

      // Rien dans le stockage du navigateur.
      const stockage = await page.evaluate(async () => ({
        local: JSON.stringify({ ...localStorage }),
        session: JSON.stringify({ ...sessionStorage }),
        cookies: document.cookie,
        bases: (await indexedDB.databases()).map((une) => une.name ?? ''),
        caches: 'caches' in window ? await caches.keys() : [],
      }))
      expect(stockage.bases).toEqual([])
      expect(stockage.caches).toEqual([])
      const stocke = JSON.stringify(stockage).toLowerCase()
      for (const interdit of INTERDITS) expect(stocke).not.toContain(interdit)

      const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze()
      expect(axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.length }))).toEqual([])

      // « Fait » sur l'appel d'Hortense : en base, journalisé ; le contenu déchiffré reste affiché.
      await hortense.getByRole('button', { name: /^Fait/ }).click()
      await attendreEnBase(
        base,
        'SELECT status AS valeur FROM bookings WHERE id = $1',
        [jeu.hortense.id],
        'done',
      )
      if (jourBruxelles(new Date(jeu.hortense.debut)) === jourBruxelles(new Date())) {
        await expect(hortense.getByText('Fait', { exact: true })).toBeVisible()
        await expect(hortense.getByText('Statut enregistré.')).toBeVisible()
        await expect(page.getByText(HORTENSE.nom)).toBeVisible()
      } else {
        // Appel d'hier (test juste après minuit) : qualifié, il quitte « Restent à qualifier ».
        await expect(hortense).toHaveCount(0)
      }

      // Rattachement de l'appel d'Ysolde à la demande.
      await ysolde.getByLabel(/^Demande rattachée/).selectOption(jeu.demande)
      await ysolde.getByRole('button', { name: /^Enregistrer le rattachement/ }).click()
      await attendreEnBase(
        base,
        'SELECT request_id AS valeur FROM bookings WHERE id = $1',
        [jeu.ysolde.id],
        jeu.demande,
      )
      await expect(
        ysolde.getByRole('link', { name: /^Lire la demande rattachée/ }),
      ).toHaveAttribute('href', `/coffre/demandes/${jeu.demande}`)
      await expect(page.getByText(YSOLDE.nom)).toBeVisible()

      // Verrouiller : plus rien de la personne dans la page.
      await page.getByRole('button', { name: 'Verrouiller' }).click()
      await expect(page.getByText('Lecture verrouillée : les clés ont été effacées.')).toBeVisible()
      await expect(page.locator('#phrase')).toHaveValue('')
      await expect(page.getByText('Nom et numéro chiffrés.').first()).toBeVisible()
      const verrouillee = (await page.locator('main').innerText()).toLowerCase()
      for (const interdit of INTERDITS) expect(verrouillee).not.toContain(interdit)

      // Journal : les actions de l'agenda, sans contenu.
      const { rows: journal } = await base.query(
        `SELECT action, booking_id, request_id FROM vault_access_log
         WHERE action IN ('booking_status', 'booking_attach') ORDER BY id`,
      )
      expect(journal).toEqual([
        { action: 'booking_status', booking_id: jeu.hortense.id, request_id: null },
        { action: 'booking_attach', booking_id: jeu.ysolde.id, request_id: jeu.demande },
      ])
      const tout = await toutLeTexte(base)
      for (const interdit of INTERDITS) expect(tout).not.toContain(interdit)

      // Ni le nom ni le numéro n'ont circulé entre le navigateur et le serveur.
      const circule = echanges.join('\n').toLowerCase()
      expect(echanges.length).toBeGreaterThan(5)
      for (const interdit of INTERDITS) expect(circule).not.toContain(interdit)
      expect(violations).toEqual([])
    } finally {
      await base.end()
    }
  })
})
