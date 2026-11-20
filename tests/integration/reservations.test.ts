import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import sodium from 'libsodium-wrappers-sumo'
import pg from 'pg'

import {
  bookSlot,
  checkBookingLink,
  createBookingLink,
  issueAccessToken,
  readBookingLink,
  readConfirmation,
} from '../../src/lib/booking/bookings.ts'
import { lienDeReservationDuCoffre } from '../../src/lib/auth/acces.ts'
import { listConfirmedCalls } from '../../src/lib/booking/repository.ts'
import { generateToken, hashToken } from '../../src/lib/booking/tokens.ts'
import { zonedTimeToUtc } from '../../src/lib/booking/zoned-time.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { withTransaction } from '../../src/lib/db/transaction.ts'
import { openSealedBooking } from '../../src/lib/vault/open.ts'
import { sealBooking } from '../../src/lib/vault/seal.ts'
import { applyRoles, coffrePool, resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Réservation d'appel (story 3.10 ; docs/reservation-appel.md §4.2, §4.4) contre PostgreSQL 17, avec
// les vrais rôles : `site_public` pour la page publique, `coffre` pour la création d'un lien. Course
// à deux sur un même créneau, jeton consommé une seule fois, jeton expiré ou annulé refusé, plafond
// par jour et réglages de la 3.8 respectés, jeton jamais en clair en base ni dans les requêtes,
// journal sans contenu. Données factices uniquement.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const FUSEAU = 'Europe/Brussels'
const CAT = 'cat-reservations@exemple.test'
// Lundi 1er mars 2027, 9 h à Bruxelles. Avec le délai de 24 heures, le premier créneau libre est le
// mardi 2 mars à 10 h 30 (09:30 UTC).
const MAINTENANT = new Date('2027-03-01T08:00:00Z')
const PRIVACY = '2026-11-18'

const admin = testPool()
const coffre = coffrePool()
const sitePool = () =>
  new pg.Pool({ connectionString: TEST_DATABASE_URL, options: '-c role=site_public', max: 4 })
const site = sitePool()
// Deuxième pool du site public : deux fonctions serverless, deux connexions, au même instant.
const siteBis = sitePool()

let clePublique: string
let cles: { publicKey: Uint8Array; privateKey: Uint8Array }

const heure = (date: string, h: string) => zonedTimeToUtc(date, h, FUSEAU)
const MARDI_1030 = heure('2027-03-02', '10:30')
const MARDI_1115 = heure('2027-03-02', '11:15')
const MARDI_1600 = heure('2027-03-02', '16:00')

async function scelle(nom = 'Hortense Factice'): Promise<Uint8Array> {
  return sealBooking(
    { nom, telephone: '+32 470 12 34 56', langue: 'fr', sms: false, origine: null },
    clePublique,
  )
}

async function lien(): Promise<string> {
  return (await createBookingLink(coffre, CAT, MAINTENANT)).token
}

async function reserver(token: string, start: Date, pool: pg.Pool = site, nom?: string) {
  return bookSlot(pool, {
    token,
    start,
    sealed: await scelle(nom),
    privacyVersion: PRIVACY,
    now: MAINTENANT,
  })
}

async function compter(table: string): Promise<number> {
  const { rows } = await admin.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)
  return rows[0]?.n ?? 0
}

// Toutes les lignes de toutes les tables, en texte (octets en hexadécimal), et chaque colonne
// d'octets en échappement : ce qu'un lecteur de la base verrait.
async function toutLeTexte(): Promise<string> {
  const { rows: tables } = await admin.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  )
  const morceaux: string[] = []
  for (const { table_name } of tables) {
    const nom = `"${table_name.replaceAll('"', '""')}"`
    const { rows } = await admin.query<{ ligne: string }>(`SELECT t::text AS ligne FROM ${nom} t`)
    morceaux.push(...rows.map((row) => row.ligne))
    const { rows: colonnes } = await admin.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND data_type = 'bytea'`,
      [table_name],
    )
    for (const { column_name } of colonnes) {
      const { rows: octets } = await admin.query<{ texte: string }>(
        `SELECT encode("${column_name}", 'escape') AS texte FROM ${nom}`,
      )
      morceaux.push(...octets.map((row) => row.texte))
    }
  }
  return morceaux.join('\n').toLowerCase()
}

// Formes sous lesquelles un jeton pourrait fuir : texte, texte en hexadécimal, octets décodés.
function formes(token: string): string[] {
  return [
    token.toLowerCase(),
    Buffer.from(token, 'utf8').toString('hex'),
    Buffer.from(token, 'base64url').toString('hex'),
  ]
}

// Espion sur tous les clients PostgreSQL : texte SQL et paramètres de chaque requête.
async function espionner(action: () => Promise<unknown>): Promise<string> {
  const prototype = pg.Client.prototype as unknown as { query: (...args: unknown[]) => unknown }
  const original = prototype.query
  const appels: string[] = []
  const enTexte = (valeur: unknown): string =>
    valeur instanceof Uint8Array
      ? Buffer.from(valeur).toString('hex')
      : valeur instanceof Date
        ? valeur.toISOString()
        : Array.isArray(valeur)
          ? valeur.map(enTexte).join(' | ')
          : typeof valeur === 'object' && valeur !== null
            ? JSON.stringify(valeur)
            : String(valeur)
  prototype.query = function (this: unknown, ...args: unknown[]) {
    appels.push(
      args
        .filter((arg) => typeof arg !== 'function')
        .map(enTexte)
        .join(' | '),
    )
    return original.apply(this, args)
  }
  try {
    await action()
  } finally {
    prototype.query = original
  }
  return appels.join('\n').toLowerCase()
}

async function etatDesTables(): Promise<string> {
  const { rows: jetons } = await admin.query('SELECT * FROM booking_tokens ORDER BY id')
  const { rows: appels } = await admin.query('SELECT * FROM bookings ORDER BY id')
  const { rows: journal } = await admin.query('SELECT * FROM vault_access_log ORDER BY id')
  return JSON.stringify({ jetons, appels, journal })
}

describe('réservation d’appel', () => {
  before(async () => {
    await sodium.ready
    const paire = sodium.crypto_box_keypair()
    cles = { publicKey: paire.publicKey, privateKey: paire.privateKey }
    clePublique = sodium.to_base64(paire.publicKey, sodium.base64_variants.ORIGINAL)
    await resetDatabase(admin)
    await migrate(admin, MIGRATIONS)
    await applyRoles(admin)
  })
  beforeEach(async () => {
    await admin.query('DELETE FROM bookings')
    await admin.query('DELETE FROM booking_tokens')
    await admin.query('DELETE FROM vault_access_log')
    await admin.query('UPDATE booking_settings SET daily_cap = 4, min_notice_minutes = 1440')
    await admin.query("DELETE FROM availability_exceptions WHERE kind <> 'holiday'")
  })
  after(async () => {
    await siteBis.end()
    await site.end()
    await coffre.end()
    await admin.end()
  })

  it('crée un lien depuis le coffre : empreinte seule, 48 heures, journalisé sans contenu', async () => {
    const { token, expiresAt } = await createBookingLink(coffre, CAT, MAINTENANT)
    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(expiresAt.toISOString(), '2027-03-03T08:00:00.000Z')

    const { rows } = await admin.query('SELECT * FROM booking_tokens')
    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0].token_hash, hashToken(token))
    assert.equal(rows[0].purpose, 'access')
    assert.equal(rows[0].email_hmac, null)
    assert.equal(rows[0].used_at, null)
    assert.equal(rows[0].created_at.toISOString(), MAINTENANT.toISOString())

    const { rows: journal } = await admin.query('SELECT * FROM vault_access_log')
    assert.equal(journal.length, 1)
    assert.equal(journal[0].actor, CAT)
    assert.equal(journal[0].action, 'booking_link')
    assert.equal(journal[0].request_id, null)
    assert.equal(journal[0].purged_requests, null)
    const ligne = JSON.stringify(journal[0]).toLowerCase()
    for (const forme of [...formes(token), rows[0].token_hash.toString('hex')]) {
      assert.equal(ligne.includes(forme), false)
    }
  })

  it('le coffre ne crée un lien que pour une session ouverte par le TOTP', async () => {
    const compte = { id: 'u1', email: CAT, nom: 'Cat Factice' }
    for (const acces of [{ etat: 'anonyme' as const }, { etat: 'enrolement' as const, compte }]) {
      assert.equal(await lienDeReservationDuCoffre(coffre, acces, MAINTENANT), null)
    }
    assert.equal(await compter('booking_tokens'), 0)
    assert.equal(await compter('vault_access_log'), 0)
    const cree = await lienDeReservationDuCoffre(coffre, { etat: 'autorise', compte }, MAINTENANT)
    assert.match(cree?.token ?? '', /^[A-Za-z0-9_-]{43}$/)
    assert.equal(await compter('booking_tokens'), 1)
    const { rows } = await admin.query('SELECT actor, action FROM vault_access_log')
    assert.deepEqual(rows, [{ actor: CAT, action: 'booking_link' }])
  })

  it('le jeton n’est jamais en clair, ni en base ni dans les requêtes envoyées', async () => {
    let token = ''
    const envoye = await espionner(async () => {
      token = await lien()
      await readBookingLink(site, token, MAINTENANT)
      await reserver(token, MARDI_1030)
      await readConfirmation(site, token, MAINTENANT)
      await reserver(token, MARDI_1030)
    })
    assert.equal(await compter('bookings'), 1)
    const base = await toutLeTexte()
    for (const forme of formes(token)) {
      assert.equal(base.includes(forme), false, 'en base')
      assert.equal(envoye.includes(forme), false, 'dans les requêtes')
    }
    // Témoin : l'empreinte, elle, est bien envoyée et gardée.
    assert.ok(envoye.includes(hashToken(token).toString('hex')))
    assert.ok(base.includes(hashToken(token).toString('hex')))
  })

  it('une lecture par GET ne modifie rien et rend les créneaux ouverts', async () => {
    const token = await lien()
    const avant = await etatDesTables()
    const lu = await readBookingLink(site, token, MAINTENANT)
    await readBookingLink(site, token, MAINTENANT)
    await readConfirmation(site, token, MAINTENANT)
    assert.equal(await etatDesTables(), avant)
    assert.equal(lu.state, 'valid')
    if (lu.state !== 'valid') return
    assert.equal(lu.slots[0]?.start.toISOString(), MARDI_1030.toISOString())
    assert.equal(lu.slots[1]?.start.toISOString(), MARDI_1115.toISOString())
    // Jeton inconnu ou mal formé : même réponse, rien ne dit pourquoi.
    assert.deepEqual(await readBookingLink(site, generateToken().token, MAINTENANT), {
      state: 'invalid',
    })
    assert.deepEqual(await readBookingLink(site, 'pas-un-jeton', MAINTENANT), { state: 'invalid' })
  })

  it('vérifie un lien avant tout scellement, sans rien écrire : valable, réservé, sans valeur', async () => {
    const token = await lien()
    const avant = await etatDesTables()
    assert.equal(await checkBookingLink(site, token, MAINTENANT), 'valid')
    assert.equal(await checkBookingLink(site, generateToken().token, MAINTENANT), 'invalid')
    assert.equal(await checkBookingLink(site, 'court', MAINTENANT), 'invalid')
    assert.equal(
      await checkBookingLink(site, token, new Date('2027-03-03T08:00:00Z')),
      'invalid',
      'expiré',
    )
    assert.equal(await etatDesTables(), avant)
    await reserver(token, MARDI_1030)
    assert.equal(await checkBookingLink(site, token, MAINTENANT), 'booked')
    // L'appel passé, le lien ne vaut plus rien.
    assert.equal(await checkBookingLink(site, token, new Date('2027-03-02T10:00:00Z')), 'invalid')
  })

  it('réserve : créneau et pause en clair, personne scellée, jeton consommé une seule fois', async () => {
    const token = await lien()
    const resultat = await reserver(token, MARDI_1030, site, 'Ysolde Factice')
    assert.equal(resultat.status, 'booked')
    if (resultat.status !== 'booked') return

    const { rows } = await admin.query(
      `SELECT id, access_token_id, starts_at, ends_at, lower(slot) AS debut, upper(slot) AS fin,
              status, privacy_version, retention_until, sealed
       FROM bookings`,
    )
    assert.equal(rows.length, 1)
    const [appel] = rows
    assert.equal(appel.id, resultat.bookingId)
    assert.equal(appel.starts_at.toISOString(), '2027-03-02T09:30:00.000Z')
    assert.equal(appel.ends_at.toISOString(), '2027-03-02T10:00:00.000Z')
    assert.equal(appel.debut.toISOString(), '2027-03-02T09:30:00.000Z')
    assert.equal(appel.fin.toISOString(), '2027-03-02T10:15:00.000Z')
    assert.equal(appel.status, 'confirmed')
    assert.equal(appel.privacy_version, PRIVACY)
    assert.equal(appel.retention_until.toISOString(), '2028-03-02T09:30:00.000Z')
    assert.equal(appel.sealed.length, 2096)
    assert.equal(
      (await openSealedBooking(new Uint8Array(appel.sealed), cles)).nom,
      'Ysolde Factice',
    )
    assert.ok(!(await toutLeTexte()).includes('ysolde'))

    const { rows: jetons } = await admin.query('SELECT id, used_at FROM booking_tokens')
    assert.equal(jetons[0].used_at.toISOString(), MAINTENANT.toISOString())
    assert.equal(appel.access_token_id, jetons[0].id)

    // Le lien ne rouvre plus la réservation ; la confirmation, elle, se lit.
    assert.deepEqual(await readBookingLink(site, token, MAINTENANT), { state: 'invalid' })
    assert.deepEqual(await readConfirmation(site, token, MAINTENANT), {
      bookingId: resultat.bookingId,
      start: MARDI_1030,
      end: new Date('2027-03-02T10:00:00.000Z'),
    })
    // Renvoi du même formulaire (retour arrière, double clic) : la même réservation, rien de plus.
    assert.deepEqual(await reserver(token, MARDI_1115), {
      status: 'already-booked',
      bookingId: resultat.bookingId,
    })
    assert.equal(await compter('bookings'), 1)
    // L'appel passé, la confirmation ne se lit plus.
    assert.equal(await readConfirmation(site, token, new Date('2027-03-02T10:00:00Z')), null)
  })

  it('course à deux sur un même créneau : une seule réservation', async () => {
    for (const [date, h] of [
      ['2027-03-02', '10:30'],
      ['2027-03-02', '16:45'],
      ['2027-03-03', '11:15'],
      ['2027-03-04', '17:30'],
    ] as const) {
      const debut = heure(date, h)
      const [a, b] = [await lien(), await lien()]
      const resultats = await Promise.all([reserver(a, debut, site), reserver(b, debut, siteBis)])
      const statuts = resultats.map((r) => r.status).sort()
      assert.deepEqual(statuts, ['booked', 'taken'], `${date} ${h}`)
      const pris = resultats.find((r) => r.status === 'taken')
      assert.ok(pris?.status === 'taken')
      assert.ok(pris.slots.every((slot) => slot.start.getTime() !== debut.getTime()))
      // Le lien perdant reste valable, pour un autre créneau.
      const perdant = resultats[0]?.status === 'taken' ? a : b
      assert.equal((await readBookingLink(site, perdant, MAINTENANT)).state, 'valid')
    }
    const { rows } = await admin.query(
      `SELECT count(*)::int AS n, count(DISTINCT starts_at)::int AS d FROM bookings`,
    )
    assert.deepEqual(rows[0], { n: 4, d: 4 })
  })

  it('double envoi simultané du même lien : une seule réservation', async () => {
    const token = await lien()
    const resultats = await Promise.all([
      reserver(token, MARDI_1030, site),
      reserver(token, MARDI_1115, siteBis),
    ])
    assert.deepEqual(resultats.map((r) => r.status).sort(), ['already-booked', 'booked'])
    const ids = resultats.map((r) => ('bookingId' in r ? r.bookingId : null))
    assert.equal(ids[0], ids[1])
    assert.equal(await compter('bookings'), 1)
  })

  it('la contrainte d’exclusion tient seule, même sans verrou, à la même seconde', async () => {
    const un = await admin.connect()
    const deux = await admin.connect()
    const inserer = (client: pg.PoolClient) =>
      client.query(
        `INSERT INTO bookings (id, starts_at, ends_at, slot, privacy_version, retention_until, sealed)
         VALUES ($1, $2::timestamptz, $3::timestamptz, tstzrange($2::timestamptz, $4::timestamptz),
                 'v', '2028-01-01', $5)`,
        [
          randomUUID(),
          '2027-03-05T09:30Z',
          '2027-03-05T10:00Z',
          '2027-03-05T10:15Z',
          Buffer.alloc(2096),
        ],
      )
    try {
      await un.query('BEGIN')
      await deux.query('BEGIN')
      await inserer(un)
      // La seconde insertion attend la première, puis échoue quand elle est validée.
      const seconde = inserer(deux)
      await un.query('COMMIT')
      await assert.rejects(seconde, { code: '23P01' })
      await deux.query('ROLLBACK')
    } finally {
      un.release()
      deux.release()
    }
    assert.equal(await compter('bookings'), 1)
  })

  it('refuse un lien expiré, annulé ou inconnu, sans rien écrire', async () => {
    const expire = generateToken()
    const annule = generateToken()
    await admin.query(
      `INSERT INTO booking_tokens (id, token_hash, purpose, created_at, expires_at, revoked_at)
       VALUES ($1, $2, 'access', $3, $4, NULL), ($5, $6, 'access', $7, $8, $7)`,
      [
        randomUUID(),
        expire.hash,
        new Date('2027-02-27T07:00:00Z'),
        new Date('2027-03-01T07:00:00Z'),
        randomUUID(),
        annule.hash,
        new Date('2027-03-01T07:00:00Z'),
        new Date('2027-03-03T07:00:00Z'),
      ],
    )
    const avant = await etatDesTables()
    for (const token of [expire.token, annule.token, generateToken().token, 'court']) {
      assert.deepEqual(await readBookingLink(site, token, MAINTENANT), { state: 'invalid' })
      assert.deepEqual(await reserver(token, MARDI_1030), { status: 'invalid-link' })
      assert.equal(await readConfirmation(site, token, MAINTENANT), null)
    }
    assert.equal(await etatDesTables(), avant)
  })

  it('un nouveau lien annule l’ancien pour une même adresse (story 3.9)', async () => {
    const adresse = Buffer.alloc(32, 5)
    const autre = Buffer.alloc(32, 6)
    const emettre = (hmac: Buffer) =>
      withTransaction(admin, (client) =>
        issueAccessToken(client, { emailHmac: hmac, now: MAINTENANT }),
      )
    const premier = await emettre(adresse)
    const tiers = await emettre(autre)
    const second = await emettre(adresse)
    // Avec une empreinte, le lien prend l'heure de la base (story 3.9) : lu à l'heure réelle.
    const maintenant = new Date()
    assert.equal((await readBookingLink(site, premier.token, maintenant)).state, 'invalid')
    assert.equal((await readBookingLink(site, second.token, maintenant)).state, 'valid')
    assert.equal((await readBookingLink(site, tiers.token, maintenant)).state, 'valid')
    const { rows } = await admin.query(
      'SELECT count(*)::int AS n FROM booking_tokens WHERE revoked_at IS NOT NULL',
    )
    assert.equal(rows[0].n, 1)
  })

  it('respecte le plafond par jour, même en course', async () => {
    await admin.query('UPDATE booking_settings SET daily_cap = 2')
    assert.equal((await reserver(await lien(), MARDI_1030)).status, 'booked')
    assert.equal((await reserver(await lien(), MARDI_1115)).status, 'booked')
    const refuse = await reserver(await lien(), MARDI_1600)
    assert.equal(refuse.status, 'taken')
    if (refuse.status === 'taken') {
      // La journée pleine ne propose plus rien ; le lendemain, si.
      assert.ok(refuse.slots.every((slot) => slot.localDate !== '2027-03-02'))
      assert.equal(refuse.slots[0]?.localDate, '2027-03-03')
    }

    // Plafond de 1 : deux créneaux différents du même jour, au même instant.
    await admin.query('UPDATE booking_settings SET daily_cap = 1')
    const [a, b] = [await lien(), await lien()]
    const resultats = await Promise.all([
      reserver(a, heure('2027-03-04', '10:30'), site),
      reserver(b, heure('2027-03-04', '16:00'), siteBis),
    ])
    assert.deepEqual(resultats.map((r) => r.status).sort(), ['booked', 'taken'])
    const { rows } = await admin.query(
      `SELECT count(*)::int AS n FROM bookings WHERE starts_at >= '2027-03-04' AND starts_at < '2027-03-05'`,
    )
    assert.equal(rows[0].n, 1)
  })

  it('respecte les réglages de la 3.8 : délai minimal, journée bloquée, heure hors plage', async () => {
    const token = await lien()
    // Dans le délai de 24 heures.
    assert.equal((await reserver(token, heure('2027-03-01', '16:00'))).status, 'taken')
    // Hors de la semaine type (mardi 13 h) et hors du pas des créneaux (10 h 40).
    assert.equal((await reserver(token, heure('2027-03-02', '13:00'))).status, 'taken')
    assert.equal((await reserver(token, heure('2027-03-02', '10:40'))).status, 'taken')
    // Journée bloquée par Cat.
    await admin.query(
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('blocked', '2027-03-02', '2027-03-02')",
    )
    assert.equal((await reserver(token, MARDI_1030)).status, 'taken')
    assert.equal(await compter('bookings'), 0)
    // Le lien n'a pas servi : il vaut toujours.
    assert.equal((await readBookingLink(site, token, MAINTENANT)).state, 'valid')
    assert.equal((await reserver(token, heure('2027-03-03', '10:30'))).status, 'booked')
  })

  it('listConfirmedCalls lit les appels confirmés, pause comprise, pour les deux rôles', async () => {
    const token = await lien()
    await reserver(token, MARDI_1030)
    await admin.query(
      `INSERT INTO bookings (id, starts_at, ends_at, slot, status, privacy_version, retention_until, sealed)
       VALUES ($1, '2027-03-02T15:00Z', '2027-03-02T15:30Z', tstzrange('2027-03-02T15:00Z', '2027-03-02T15:45Z'),
               'cancelled_by_guest', 'v', '2028-01-01', $2)`,
      [randomUUID(), Buffer.alloc(2096)],
    )
    for (const pool of [site, coffre]) {
      const appels = await listConfirmedCalls(
        pool,
        new Date('2027-03-02T00:00Z'),
        new Date('2027-03-03T00:00Z'),
      )
      assert.deepEqual(
        appels.map((appel) => [appel.start.toISOString(), appel.occupiedUntil.toISOString()]),
        [['2027-03-02T09:30:00.000Z', '2027-03-02T10:15:00.000Z']],
      )
    }
    assert.deepEqual(
      await listConfirmedCalls(site, new Date('2027-03-03T00:00Z'), new Date('2027-03-04T00:00Z')),
      [],
    )
    // Le créneau pris disparaît de la page publique.
    const lu = await readBookingLink(site, await lien(), MAINTENANT)
    assert.ok(lu.state === 'valid')
    assert.ok(lu.slots.every((slot) => slot.start.getTime() !== MARDI_1030.getTime()))
  })
})
