import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, test } from '@playwright/test'
import type { Request } from '@playwright/test'
import pg from 'pg'

import { codeTotp, secretDeLUri } from '../integration/totp'

// Page de lecture réelle du coffre (story 3.2, partie D), de bout en bout : connexion, TOTP, dépôt
// du paquet, lecture, export, verrouillages. Vérifie que ni le texte, ni la clé privée, ni la phrase
// ne partent dans une requête, ni dans le stockage du navigateur.
// IGNORÉ PAR DÉFAUT : il lui faut une base jetable (nom en _test, VIDÉE par le test) et un serveur
// branché dessus. Pour le lancer :
//   createdb maison_triona_e2e_test
//   npm run build
//   COFFRE_DATABASE_URL='postgres://localhost:5432/maison_triona_e2e_test?options=-c%20role%3Dcoffre' \
//     BETTER_AUTH_SECRET=secret-factice-e2e-0123456789-abcdefghijkl BETTER_AUTH_URL=http://localhost:3100 \
//     npx next start -p 3100 &
//   COFFRE_E2E_DATABASE_URL=postgres://localhost:5432/maison_triona_e2e_test \
//     npx playwright test tests/e2e/coffre-lecture.spec.ts
//   (arrêter le serveur, puis dropdb maison_triona_e2e_test)
// Données factices uniquement.

const BASE = process.env.COFFRE_E2E_DATABASE_URL
const RACINE = `${resolve(__dirname, '../..')}/`
const EMAIL = 'lecture-e2e@exemple.test'
const MOT_DE_PASSE = 'mot-de-passe-factice-e2e-tres-long-01'
const PHRASE = 'phrase factice de la lecture e2e, assez longue'
const CHAMPS = {
  nom: 'Nom-Temoin-E2E',
  email: 'temoin-e2e@exemple.test',
  telephone: '+32 470 11 22 33',
  pourQui: 'proche',
  creneau: 'matin',
  message: 'Mot-libre-temoin-E2E, avec « é » et <b>pas du HTML</b>.',
}

interface Jeu {
  id: string
  paquet: string
  privee: string
  priveeHex: string
  chiffreDuPaquet: string
}

// Base vidée, migrée, rôles posés, compte factice, paquet de clé et demande scellée : par un
// sous-processus Node (modules du projet tels quels), la phrase passée par l'environnement.
function preparer(paquet: string): Jeu {
  const url = (chemin: string) => JSON.stringify(pathToFileURL(`${RACINE}${chemin}`).href)
  const script = `
    import { readFile, writeFile } from 'node:fs/promises'
    import { fileURLToPath } from 'node:url'
    import pg from 'pg'
    import { migrate } from ${url('src/lib/db/migrate.ts')}
    import { creerAuth } from ${url('src/lib/auth/auth.ts')}
    import { creerCompte } from ${url('src/lib/auth/comptes.ts')}
    import { createKeyPacket } from ${url('src/lib/vault/key-packet.ts')}
    import { unlockPrivateKey } from ${url('src/lib/vault/open.ts')}
    import { sealRequest } from ${url('src/lib/vault/seal.ts')}
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
      BETTER_AUTH_URL: 'http://localhost:3100',
    })
    await creerCompte(auth, coffre, { nom: 'Compte Factice', email: process.env.EMAIL, motDePasse: process.env.MDP })
    const { packet, publicKey } = await createKeyPacket(process.env.PHRASE)
    await writeFile(process.env.PAQUET, JSON.stringify(packet), { mode: 0o600 })
    const cles = await unlockPrivateKey(packet, process.env.PHRASE)
    const sealed = await sealRequest(JSON.parse(process.env.CHAMPS), publicKey)
    const id = await insertRequest(admin, {
      kind: 'request', service: 'grand-age', country: 'BE', locale: 'fr', urgency: 'semaines',
      source: 'salon', sealed, retentionUntil: new Date(Date.now() + 365 * 86400000),
      privacyVersion: '2026-11-18',
    })
    process.stdout.write(JSON.stringify({
      id,
      paquet: process.env.PAQUET,
      privee: Buffer.from(cles.privateKey).toString('base64'),
      priveeHex: Buffer.from(cles.privateKey).toString('hex'),
      chiffreDuPaquet: packet.ciphertext,
    }))
    await admin.end(); await coffre.end()
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
        PAQUET: paquet,
        CHAMPS: JSON.stringify(CHAMPS),
      },
    },
  )
  return JSON.parse(sortie.toString('utf8')) as Jeu
}

test.describe('page de lecture réelle du coffre', () => {
  test.skip(!BASE, 'COFFRE_E2E_DATABASE_URL absente : base et serveur dédiés requis (voir en tête)')
  test.describe.configure({ mode: 'serial', timeout: 180_000 })

  test('lit, exporte et verrouille sans rien laisser partir ni rien stocker', async ({
    page,
    context,
  }, testInfo) => {
    const jeu = preparer(testInfo.outputPath('paquet.json'))
    const secrets = [
      PHRASE,
      CHAMPS.nom,
      CHAMPS.email,
      CHAMPS.telephone,
      'Mot-libre-temoin-E2E',
      jeu.privee,
      jeu.priveeHex.slice(0, 32),
      jeu.chiffreDuPaquet,
    ]
    const envois: string[] = []
    // Adresse, en-têtes et corps de chaque requête, tels quels et décodés.
    const noter = (requete: Request) => {
      const texte = [
        requete.url(),
        JSON.stringify(requete.headers()),
        requete.postDataBuffer()?.toString('utf8') ?? '',
      ].join('\n')
      let decode = texte
      try {
        decode = decodeURIComponent(texte)
      } catch {
        // Texte qui n'est pas encodé en URL : gardé tel quel.
      }
      envois.push(`${texte}\n${decode}`)
    }
    page.on('request', noter)
    await page.clock.install()

    // Connexion, enrôlement du TOTP (QR code affiché), confirmation.
    await page.goto('/coffre/connexion')
    await page.getByLabel('Adresse e-mail').fill(EMAIL)
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.waitForURL('**/coffre/enrolement')
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE)
    await page.getByRole('button', { name: 'Afficher le secret' }).click()
    await expect(page.getByRole('img', { name: /QR code du secret/ })).toBeVisible()
    const uri = (await page.locator('code', { hasText: 'otpauth://' }).innerText()).trim()
    await page.locator('#code').fill(codeTotp(secretDeLUri(uri)))
    await page.getByRole('button', { name: 'Confirmer et ouvrir le coffre' }).click()
    await page.waitForURL(/\/coffre$/)
    await expect(
      page.getByText(
        /Attention : la conservation automatique n’a encore jamais tourné\. Les demandes échues/,
      ),
    ).toBeVisible()

    // Lecture.
    await page.getByRole('link', { name: /Lire la demande du/ }).click()
    await page.waitForURL(`**/coffre/demandes/${jeu.id}`)
    const deverrouiller = async () => {
      await page.locator('#paquet').setInputFiles(jeu.paquet)
      await page.locator('#phrase').fill(PHRASE)
      await page.getByRole('button', { name: 'Déverrouiller et lire' }).click()
      await expect(page.getByRole('heading', { name: 'Contenu déchiffré' })).toBeVisible({
        timeout: 60_000,
      })
    }
    await deverrouiller()
    await expect(page.getByText(CHAMPS.message)).toBeVisible()
    await expect(page.locator('#phrase')).toHaveCount(0)

    // Export : fichier composé dans le navigateur.
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporter en fichier texte' }).click(),
    ])
    expect(telechargement.suggestedFilename()).toBe(`demande-${jeu.id}.txt`)
    await expect(page.getByText('Fichier texte téléchargé')).toBeVisible()

    // Rien dans le stockage du navigateur.
    const stockage = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      indexedDB: (await indexedDB.databases()).length,
      caches: 'caches' in window ? (await caches.keys()).length : 0,
      cookie: document.cookie,
    }))
    expect(stockage).toEqual({ local: 0, session: 0, indexedDB: 0, caches: 0, cookie: '' })
    const cookies = JSON.stringify(await context.cookies())
    for (const secret of secrets) expect(cookies).not.toContain(secret)

    // 15 minutes sans interaction : verrouillée.
    await page.clock.fastForward('15:30')
    await expect(page.getByRole('heading', { name: 'Contenu déchiffré' })).toHaveCount(0)
    await expect(page.getByText(/verrouillée après 15 minutes sans activité/)).toBeVisible()
    await expect(page.getByText(CHAMPS.message)).toHaveCount(0)

    // Quitter la page (pagehide, cache arrière) : verrouillée aussi.
    await deverrouiller()
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    )
    await expect(page.getByRole('heading', { name: 'Contenu déchiffré' })).toHaveCount(0)
    await expect(page.getByText(/verrouillée en quittant la page/)).toBeVisible()

    // Aucune requête n'a emporté la phrase, la clé privée, le paquet ni le texte.
    expect(envois.length).toBeGreaterThan(5)
    for (const envoi of envois) {
      for (const secret of secrets) expect(envoi).not.toContain(secret)
    }

    // Journal : une lecture par déverrouillage, un export, une liste ; jamais de contenu.
    const admin = new pg.Pool({ connectionString: BASE })
    try {
      const { rows } = await admin.query<{ action: string; request_id: string | null }>(
        `SELECT action, request_id FROM vault_access_log WHERE actor = $1 ORDER BY id`,
        [EMAIL],
      )
      expect(rows.map((row) => row.action)).toEqual([
        'login',
        'totp_enrolled',
        'list',
        'read',
        'export',
        'read',
      ])
      const brut = JSON.stringify((await admin.query('SELECT * FROM vault_access_log')).rows)
      for (const secret of secrets) expect(brut).not.toContain(secret)
    } finally {
      await admin.end()
    }
  })
})
