import { execFileSync } from 'node:child_process'
import { createHash, createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, test } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import pg from 'pg'

import {
  emailsRecus,
  JOURNAL_SERVEUR,
  poserCle,
  remettreAZero,
  SECRET_ADRESSE_E2E,
  type EmailRecu,
} from './support/parcours'

// Demande d'un lien de réservation de bout en bout (story 3.9 ; docs/reservation-appel.md §2, §4.4,
// §4.5, §6), SANS JavaScript : formulaire natif, POST, redirection. E-mail capturé par le double de
// TEM, lien qui ouvre la page de réservation, nouveau lien qui annule l'ancien, FR et EN ; limites
// par adresse (3 par 24 heures) et par IP (3 par 10 minutes) PROUVÉES ici, avec le double d'Upstash ;
// réponse identique quelle que soit l'adresse (nouvelle, limitée, IP limitée, robot) ; aucun cookie ;
// jeton et adresse jamais en clair en base ni dans le journal du serveur.
// IGNORÉ PAR DÉFAUT sans `RESERVATION_E2E_DATABASE_URL` : même base jetable et même serveur dédié que
// reservation-parcours.spec.ts (projet `reservation`, un seul processus de test : la base est vidée
// par chaque parcours). En local, voir l'en-tête de reservation-parcours.spec.ts.
// L'adresse IP vient de `X-Forwarded-For`, comme derrière Vercel : chaque contexte de navigateur en
// porte une, ce qui sépare les deux limites. Données factices uniquement.

const BASE = process.env.RESERVATION_E2E_DATABASE_URL
const RACINE = `${resolve(__dirname, '../..')}/`
const LIEN = /https?:\/\/[^\s/]+(\/(?:fr|en)\/contact\/appel\/[A-Za-z0-9_-]{43})(?=\n)/

function preparer(): void {
  const url = (chemin: string) => JSON.stringify(pathToFileURL(`${RACINE}${chemin}`).href)
  const script = `
    import { readFile } from 'node:fs/promises'
    import { fileURLToPath } from 'node:url'
    import pg from 'pg'
    import { migrate } from ${url('src/lib/db/migrate.ts')}
    const base = process.env.BASE
    if (!decodeURIComponent(new URL(base).pathname.slice(1)).endsWith('_test')) {
      throw new Error('Base refusée : le nom doit finir par _test')
    }
    const admin = new pg.Pool({ connectionString: base })
    await admin.query('DROP SCHEMA public CASCADE')
    await admin.query('CREATE SCHEMA public')
    await migrate(admin, fileURLToPath(${url('db/migrations')}))
    for (const role of ['site_public', 'coffre', 'envoi']) {
      await admin.query(await readFile(new URL(\`db/roles/\${role}.sql\`, ${url('')}), 'utf8'))
    }
    await admin.end()
  `
  execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script],
    { cwd: RACINE, env: { ...process.env, BASE } },
  )
}

// Empreinte telle que le serveur la calcule (src/lib/booking/email-hmac.ts), avec le secret factice.
function empreinte(adresse: string): string {
  return createHmac('sha256', SECRET_ADRESSE_E2E)
    .update(`adresse:${adresse.trim().normalize('NFC').toLowerCase()}`, 'utf8')
    .digest('hex')
}

async function contexte(browser: Browser, ip: string): Promise<BrowserContext> {
  return browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: { 'x-forwarded-for': ip },
  })
}

const CHEMINS = { fr: '/fr/contact/appel', en: '/en/contact/call' } as const
const BOUTON = { fr: 'Recevoir mon lien', en: 'Send me my link' } as const
const CHAMP = { fr: 'Votre adresse e‑mail', en: 'Your email address' } as const
const ENVOYE = { fr: /\/fr\/contact\/appel\/envoye$/, en: /\/en\/contact\/call\/sent$/ } as const

interface Envoi {
  page: Page
  locale: 'fr' | 'en'
}

// Premier envoi sans JavaScript : la page statique n'a pas d'horodatage, la réponse en délivre un
// (« Patientez quelques secondes »). Le second envoi, plus de 3 secondes après, est la vraie demande.
async function preparerEnvoi(
  ctx: BrowserContext,
  adresse: string,
  locale: 'fr' | 'en' = 'fr',
  piege = false,
): Promise<Envoi> {
  const page = await ctx.newPage()
  const reponse = await page.goto(CHEMINS[locale])
  expect(reponse?.headers()['set-cookie']).toBeUndefined()
  if (piege) await page.locator('#lien-reference').fill('https://exemple.test', { force: true })
  await page.getByLabel(CHAMP[locale]).fill(adresse)
  await page.getByRole('button', { name: BOUTON[locale] }).click()
  await expect(page.locator('#lien-statut')).toBeVisible()
  await expect(page.locator('input[name="jeton"]')).toHaveValue(/^\d{13}\./)
  return { page, locale }
}

// La vraie demande ; rend ce que la personne voit ensuite.
async function envoyer({ page, locale }: Envoi): Promise<{ url: string; texte: string }> {
  const reponses: string[] = []
  page.on('response', (r) => {
    if (r.headers()['set-cookie']) reponses.push(r.url())
  })
  await page.getByRole('button', { name: BOUTON[locale] }).click()
  await page.waitForURL(ENVOYE[locale], { timeout: 15_000 })
  expect(reponses, 'aucun cookie').toEqual([])
  return { url: new URL(page.url()).pathname, texte: await page.locator('main').innerText() }
}

async function attendreLesEnvois(): Promise<void> {
  await new Promise((r) => setTimeout(r, 3200))
}

// Une demande complète : premier envoi, plus de 3 secondes, vraie demande.
async function demander(ctx: BrowserContext, adresse: string, locale: 'fr' | 'en' = 'fr') {
  const pret = await preparerEnvoi(ctx, adresse, locale)
  await attendreLesEnvois()
  return envoyer(pret)
}

async function emailsPour(adresse: string, attendus: number): Promise<EmailRecu[]> {
  await expect
    .poll(async () => (await emailsRecus()).filter((m) => m.to === adresse).length, {
      timeout: 15_000,
    })
    .toBe(attendus)
  // Un temps de plus : aucun e-mail en retard ne doit arriver après coup.
  await new Promise((r) => setTimeout(r, 1500))
  const recus = (await emailsRecus()).filter((m) => m.to === adresse)
  expect(recus.length).toBe(attendus)
  return recus
}

function cheminDuLien(email: EmailRecu): string {
  const trouve = LIEN.exec(email.text)
  expect(trouve, 'lien de réservation dans l’e-mail').not.toBeNull()
  return trouve![1]!
}

async function jetonsDe(base: pg.Pool, adresse: string) {
  const { rows } = await base.query<{ token_hash: Buffer; revoked_at: Date | null }>(
    `SELECT token_hash, revoked_at FROM booking_tokens WHERE encode(email_hmac, 'hex') = $1
     ORDER BY created_at`,
    [empreinte(adresse)],
  )
  return rows
}

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

test.describe('demande de lien de bout en bout', () => {
  test.skip(
    !BASE,
    'RESERVATION_E2E_DATABASE_URL absente : base et serveur dédiés requis (voir en tête)',
  )
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  let base: pg.Pool
  const jetons: string[] = []
  const adresses: string[] = []

  test.beforeAll(async () => {
    preparer()
    await remettreAZero()
    base = new pg.Pool({ connectionString: BASE })
  })

  test.afterAll(async () => {
    await base?.end()
  })

  test('lien reçu, page de réservation ouverte ; un nouveau lien annule l’ancien ; FR et EN', async ({
    browser,
  }) => {
    const adresse = 'Hortense.Lien@exemple.test'
    adresses.push(adresse)
    const ctx = await contexte(browser, '198.51.100.10')
    try {
      const reponse = await demander(ctx, adresse)
      expect(reponse.url).toBe('/fr/contact/appel/envoye')
      expect(reponse.texte).toContain('Un lien vient de vous être envoyé.')

      const [premier] = await emailsPour(adresse, 1)
      expect(premier!.subject).toBe('Votre lien personnel · Maison Triona')
      const chemin = cheminDuLien(premier!)
      expect(chemin).toMatch(/^\/fr\/contact\/appel\//)
      const jeton = chemin.split('/').at(-1)!
      jetons.push(jeton)

      // En base : l'empreinte du jeton et celle de l'adresse, rien en clair ; l'e-mail est parti.
      const lignes = await jetonsDe(base, adresse)
      expect(lignes).toHaveLength(1)
      expect(lignes[0]!.token_hash.toString('hex')).toBe(
        createHash('sha256').update(jeton).digest('hex'),
      )
      const { rows: boite } = await base.query(
        "SELECT status, request_id FROM outbox WHERE template = 'booking_access'",
      )
      expect(boite).toEqual([{ status: 'accepted', request_id: null }])

      // Le lien ouvre la page de réservation, sans cookie, sans rien écrire.
      const page = await ctx.newPage()
      const ouverte = await page.goto(chemin)
      expect(ouverte?.headers()['set-cookie']).toBeUndefined()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Convenons d’un appel.')
      await expect(
        page.getByRole('group', { name: 'Les prochains moments libres' }).getByRole('radio'),
      ).toHaveCount(3)

      // Un nouveau lien, à la même adresse autrement écrite : l'ancien ne vaut plus.
      const deuxieme = await demander(ctx, ' hortense.lien@EXEMPLE.test ')
      expect(deuxieme).toEqual(reponse)
      const recus = await emailsPour(adresse, 1)
      expect(recus).toHaveLength(1)
      const tous = (await emailsRecus()).filter((m) => m.to === 'hortense.lien@EXEMPLE.test')
      expect(tous).toHaveLength(1)
      const nouveau = cheminDuLien(tous[0]!)
      jetons.push(nouveau.split('/').at(-1)!)
      await page.goto(chemin)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Ce lien n’est plus valable.',
      )
      await expect(page.getByRole('link', { name: 'Recevoir un nouveau lien' })).toHaveAttribute(
        'href',
        '/fr/contact/appel',
      )
      await page.goto(nouveau)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Convenons d’un appel.')
      expect(await jetonsDe(base, adresse)).toHaveLength(2)
      expect((await jetonsDe(base, adresse)).filter((j) => j.revoked_at === null)).toHaveLength(1)

      // En anglais : chemin et réponse localisés, e-mail en anglais, lien vers la page anglaise.
      const anglaise = 'ysolde.link@exemple.test'
      adresses.push(anglaise)
      const en = await demander(ctx, anglaise, 'en')
      expect(en.url).toBe('/en/contact/call/sent')
      expect(en.texte).toContain('A link has just been sent to you.')
      const [mail] = await emailsPour(anglaise, 1)
      expect(mail!.subject).toBe('Your personal link · Maison Triona')
      const cheminEn = cheminDuLien(mail!)
      expect(cheminEn).toMatch(/^\/en\/contact\/appel\//)
      jetons.push(cheminEn.split('/').at(-1)!)
      await page.goto(cheminEn)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let us arrange a call.')
      expect(await ctx.cookies()).toEqual([])
    } finally {
      await ctx.close()
    }
  })

  test('limite par adresse : 3 liens par 24 heures, puis la même réponse sans e-mail', async ({
    browser,
  }) => {
    const adresse = 'camille.limite@exemple.test'
    adresses.push(adresse)
    // Quatre IP différentes : seule la limite par adresse peut jouer.
    const contextes = await Promise.all(
      ['203.0.113.1', '203.0.113.2', '203.0.113.3', '203.0.113.4'].map((ip) =>
        contexte(browser, ip),
      ),
    )
    try {
      const prets = []
      for (const ctx of contextes) prets.push(await preparerEnvoi(ctx, adresse))
      await attendreLesEnvois()
      const reponses = []
      for (const pret of prets) reponses.push(await envoyer(pret))
      // Les quatre réponses sont identiques, la quatrième comprise.
      for (const reponse of reponses) expect(reponse).toEqual(reponses[0])
      const recus = await emailsPour(adresse, 3)
      for (const mail of recus) jetons.push(cheminDuLien(mail).split('/').at(-1)!)
      // Trois liens seulement en base pour cette adresse, le dernier seul vivant.
      const lignes = await jetonsDe(base, adresse)
      expect(lignes).toHaveLength(3)
      expect(lignes.filter((j) => j.revoked_at === null)).toHaveLength(1)
    } finally {
      await Promise.all(contextes.map((ctx) => ctx.close()))
    }
  })

  test('horodatage rejoué : la même réponse, que l’adresse soit limitée ou non', async ({
    browser,
  }) => {
    // Avec JavaScript, pour pouvoir reposer dans la page un horodatage déjà servi. L'adresse
    // limitée vient du test précédent (3 liens en 24 heures).
    const limitee = 'camille.limite@exemple.test'
    const libre = 'rejeu@exemple.test'
    adresses.push(libre)
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '192.0.2.150' } })
    try {
      const premiere = await ctx.newPage()
      await premiere.goto('/fr/contact/appel')
      const champJeton = premiere.locator('input[name="jeton"]')
      await expect(champJeton).toHaveValue(/^\d{13}\./)
      const jeton = await champJeton.inputValue()
      await premiere.getByLabel(CHAMP.fr).fill(limitee)
      await attendreLesEnvois()
      await premiere.getByRole('button', { name: BOUTON.fr }).click()
      await premiere.waitForURL(ENVOYE.fr, { timeout: 15_000 })

      const rejouer = async (adresse: string) => {
        const page = await ctx.newPage()
        await page.goto('/fr/contact/appel')
        await expect(page.locator('input[name="jeton"]')).toHaveValue(/^\d{13}\./)
        await page.locator('input[name="jeton"]').evaluate((champ, valeur) => {
          ;(champ as HTMLInputElement).value = valeur
        }, jeton)
        await page.getByLabel(CHAMP.fr).fill(adresse)
        await page.getByRole('button', { name: BOUTON.fr }).click()
        const statut = page.locator('#lien-statut')
        await expect(statut).toContainText('Patientez quelques secondes')
        return { url: new URL(page.url()).pathname, texte: await statut.innerText() }
      }
      const surLimitee = await rejouer(limitee)
      const surLibre = await rejouer(libre)
      expect(surLibre).toEqual(surLimitee)
      await emailsPour(libre, 0)
      expect(await jetonsDe(base, libre)).toHaveLength(0)
    } finally {
      await ctx.close()
    }
  })

  test('limite par IP : 3 demandes par 10 minutes, puis la même réponse sans e-mail', async ({
    browser,
  }) => {
    const ctx = await contexte(browser, '192.0.2.77')
    const quatre = ['ip1@exemple.test', 'ip2@exemple.test', 'ip3@exemple.test', 'ip4@exemple.test']
    adresses.push(...quatre)
    try {
      const prets = []
      for (const adresse of quatre) prets.push(await preparerEnvoi(ctx, adresse))
      await attendreLesEnvois()
      const reponses = []
      for (const pret of prets) reponses.push(await envoyer(pret))
      for (const reponse of reponses) expect(reponse).toEqual(reponses[0])
      for (const adresse of quatre.slice(0, 3)) {
        const [mail] = await emailsPour(adresse, 1)
        jetons.push(cheminDuLien(mail!).split('/').at(-1)!)
      }
      await emailsPour(quatre[3]!, 0)
      expect(await jetonsDe(base, quatre[3]!)).toHaveLength(0)

      // Une autre IP passe encore pour cette quatrième adresse.
      const autre = await contexte(browser, '192.0.2.78')
      try {
        expect(await demander(autre, quatre[3]!)).toEqual(reponses[0])
        const [mail] = await emailsPour(quatre[3]!, 1)
        jetons.push(cheminDuLien(mail!).split('/').at(-1)!)
      } finally {
        await autre.close()
      }
    } finally {
      await ctx.close()
    }
  })

  test('robot (piège rempli) : la même réponse, ni lien ni e-mail', async ({ browser }) => {
    const ctx = await contexte(browser, '198.51.100.99')
    const adresse = 'robot@exemple.test'
    adresses.push(adresse)
    try {
      const page = await ctx.newPage()
      await page.goto('/fr/contact/appel')
      await page.locator('#lien-reference').fill('https://exemple.test', { force: true })
      await page.getByLabel(CHAMP.fr).fill(adresse)
      // Rejeté avant l'horodatage : la réponse arrive dès le premier envoi.
      await page.getByRole('button', { name: BOUTON.fr }).click()
      await page.waitForURL(ENVOYE.fr, { timeout: 15_000 })
      await expect(page.locator('main')).toContainText('Un lien vient de vous être envoyé.')
      await emailsPour(adresse, 0)
      expect(await jetonsDe(base, adresse)).toHaveLength(0)
    } finally {
      await ctx.close()
    }
  })

  // Plafond global (D72) : 100 demandes par jour UTC, bloquant ; au premier dépassement du jour,
  // une seule alerte à Sady, la date seulement, même pour plusieurs demandes refusées.
  test('plafond global : la même réponse sans lien, et une seule alerte à Sady', async ({
    browser,
  }) => {
    const cle = `mt:debit:lien-jour:${new Date().toISOString().slice(0, 10)}`
    await poserCle(cle, '100', 86_400)
    const deux = ['plafond1@exemple.test', 'plafond2@exemple.test']
    adresses.push(...deux)
    const contextes = [
      await contexte(browser, '203.0.113.21'),
      await contexte(browser, '203.0.113.22'),
    ]
    try {
      const prets = [
        await preparerEnvoi(contextes[0]!, deux[0]!),
        await preparerEnvoi(contextes[1]!, deux[1]!),
      ]
      await attendreLesEnvois()
      const reponses = [await envoyer(prets[0]!), await envoyer(prets[1]!)]
      expect(reponses[1]).toEqual(reponses[0])
      expect(reponses[0]!.texte).toContain('Un lien vient de vous être envoyé.')
      for (const adresse of deux) {
        await emailsPour(adresse, 0)
        expect(await jetonsDe(base, adresse)).toHaveLength(0)
      }
      const alertes = await emailsPour('alerte@exemple.test', 1)
      expect(alertes[0]!.subject).toBe('Alerte technique · Maison Triona')
      expect(alertes[0]!.text).toContain('Plafond des demandes de lien atteint')
      for (const valeur of [...deux, '203.0.113', 'exemple.test']) {
        expect(alertes[0]!.text).not.toContain(valeur)
      }
      const { rows } = await base.query<{ alert_subject: string | null }>(
        `SELECT alert_subject FROM outbox
         WHERE template = 'technical_alert' AND alert_event = 'link_cap'`,
      )
      expect(rows).toEqual([{ alert_subject: null }])
    } finally {
      for (const ctx of contextes) await ctx.close()
      await poserCle(cle, '0', 86_400)
    }
  })

  test('ni adresse ni jeton en clair, en base comme dans le journal du serveur', async () => {
    expect(jetons.length).toBeGreaterThanOrEqual(8)
    const tout = await toutLeTexte(base)
    for (const valeur of [...jetons, ...adresses]) {
      expect(tout).not.toContain(valeur.trim().toLowerCase())
    }
    // Le journal n'existe que si ce lancement a démarré le serveur (pas de serveur réutilisé).
    if (!existsSync(JOURNAL_SERVEUR)) {
      expect(process.env.CI, 'journal du serveur attendu en CI').toBeFalsy()
      return
    }
    const journal = readFileSync(JOURNAL_SERVEUR, 'utf8').toLowerCase()
    expect(journal).toContain('[lien] issued')
    expect(journal).toContain('[lien] rejected:rate')
    expect(journal).toContain('[lien] rejected:honeypot')
    expect(journal).toContain('[lien] alert:link-cap-sent')
    for (const valeur of [...jetons, ...adresses, 'exemple.test']) {
      expect(journal).not.toContain(valeur.trim().toLowerCase())
    }
  })
})
