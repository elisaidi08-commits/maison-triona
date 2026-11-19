import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import sodium from 'libsodium-wrappers-sumo'

import {
  agendaDuCoffre,
  demandesRecentesDuCoffre,
  rattachementAppelDuCoffre,
  scellesAppelsDuCoffre,
  statutAppelDuCoffre,
} from '../../src/lib/auth/acces.ts'
import type { AccesCoffre } from '../../src/lib/auth/acces.ts'
import {
  attachBooking,
  listAgendaLogged,
  readBookingsSealed,
  setBookingStatus,
} from '../../src/lib/booking/agenda-repository.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { openSealedBooking } from '../../src/lib/vault/open.ts'
import { deleteRequest, insertRequest } from '../../src/lib/vault/repository.ts'
import { sealBooking } from '../../src/lib/vault/seal.ts'
import { applyRoles, coffrePool, resetDatabase, testPool } from './helpers.ts'

// Agenda des appels (story 3.13 ; docs/reservation-appel.md §3.2) contre PostgreSQL 17, sous le rôle
// `coffre` : liste d'une période (heures, statuts, rattachements, jamais le scellé) et appels d'avant
// restés « à qualifier » ; octets scellés remis exacts, ouverts seulement avec la clé privée ; statut
// « fait » ou « pas de réponse » permis et refusé ; rattachement, retrait, demande inconnue, remise à
// zéro quand la demande est effacée ; chaque lecture et chaque action au journal, sans contenu ; rien
// sans session ouverte par le TOTP. Données factices uniquement.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const CAT = 'cat-agenda@exemple.test'
const MINUTE = 60_000
const NOM = 'Hortense Agenda-Factice'
const NUMERO = '+32 470 55 44 33'

const admin = testPool()
const coffre = coffrePool()
let clePublique: string
let cles: { publicKey: Uint8Array; privateKey: Uint8Array }

const autorise: AccesCoffre = {
  etat: 'autorise',
  compte: { id: 'u1', email: CAT, nom: 'Cat Factice' },
}

async function scelle(nom = NOM): Promise<Uint8Array> {
  return sealBooking(
    { nom, telephone: NUMERO, langue: 'en', sms: false, origine: 'salon' },
    clePublique,
  )
}

// Appel de 30 minutes (pause de 15) qui commence à `debut`, inséré par l'administrateur.
async function appel(debut: Date, statut = 'confirmed', nom = NOM): Promise<string> {
  const id = randomUUID()
  const fin = new Date(debut.getTime() + 30 * MINUTE)
  await admin.query(
    `INSERT INTO bookings
       (id, starts_at, ends_at, slot, privacy_version, retention_until, sealed, status)
     VALUES ($1, $2, $3, tstzrange($2, $4), '2026-11-18', $2::timestamptz + interval '1 year', $5, $6)`,
    [id, debut, fin, new Date(fin.getTime() + 15 * MINUTE), await scelle(nom), statut],
  )
  return id
}

const dans = (minutes: number) => new Date(Date.now() + minutes * MINUTE)

async function demande(): Promise<string> {
  return insertRequest(admin, {
    kind: 'request',
    service: 'conciergerie',
    country: 'BE',
    locale: 'fr',
    urgency: 'aucune',
    source: null,
    sealed: new Uint8Array(randomBytes(64)),
    retentionUntil: new Date(Date.now() + 365 * 24 * 60 * MINUTE),
    privacyVersion: '2026-11-18',
  })
}

interface Ligne {
  actor: string
  action: string
  booking_id: string | null
  request_id: string | null
}

async function journal(): Promise<Ligne[]> {
  const { rows } = await admin.query<Ligne>(
    'SELECT actor, action, booking_id, request_id FROM vault_access_log ORDER BY id',
  )
  return rows
}

async function statut(id: string): Promise<string> {
  const { rows } = await admin.query('SELECT status FROM bookings WHERE id = $1', [id])
  return rows[0]?.status
}

describe('agenda des appels (rôle coffre)', () => {
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
    await admin.query('DELETE FROM vault_requests')
    await admin.query('DELETE FROM vault_access_log')
  })
  after(async () => {
    await coffre.end()
    await admin.end()
  })

  it('liste la période sans le scellé, et les appels d’avant restés « à qualifier »', async () => {
    // Semaine du lundi 1er mars 2027 à Bruxelles (UTC+1), « maintenant » le mercredi 3 à 12 h.
    const from = new Date('2027-02-28T23:00:00Z')
    const to = new Date('2027-03-07T23:00:00Z')
    const now = new Date('2027-03-03T11:00:00Z')
    const lundi = await appel(new Date('2027-03-01T09:30:00Z'))
    const mardi = await appel(new Date('2027-03-02T15:00:00Z'), 'done')
    const jeudi = await appel(new Date('2027-03-04T09:30:00Z'))
    const annule = await appel(new Date('2027-03-05T09:30:00Z'), 'cancelled_by_guest')
    // Avant la période : un confirmé jamais qualifié (montré), un fait, un annulé (non montrés).
    const oublie = await appel(new Date('2027-02-25T15:00:00Z'))
    await appel(new Date('2027-02-24T09:30:00Z'), 'no_answer')
    await appel(new Date('2027-02-23T09:30:00Z'), 'cancelled_by_house')
    // Après la période : non montré.
    await appel(new Date('2027-03-08T09:30:00Z'))

    const lu = await listAgendaLogged(coffre, CAT, { from, to, now })
    assert.deepEqual(
      lu.calls.map((call) => [call.id, call.status]),
      [
        [lundi, 'confirmed'],
        [mardi, 'done'],
        [jeudi, 'confirmed'],
        [annule, 'cancelled_by_guest'],
      ],
    )
    assert.deepEqual(
      lu.earlierToQualify.map((call) => call.id),
      [oublie],
    )
    const premier = lu.calls[0]
    assert.deepEqual(Object.keys(premier ?? {}).sort(), [
      'endsAt',
      'id',
      'requestCreatedAt',
      'requestId',
      'startsAt',
      'status',
    ])
    assert.equal(premier?.startsAt.toISOString(), '2027-03-01T09:30:00.000Z')
    assert.equal(premier?.endsAt.toISOString(), '2027-03-01T10:00:00.000Z')
    assert.equal(JSON.stringify(lu).toLowerCase().includes('hortense'), false)

    assert.deepEqual(await journal(), [
      { actor: CAT, action: 'booking_list', booking_id: null, request_id: null },
    ])
    await assert.rejects(listAgendaLogged(coffre, CAT, { from: to, to: from, now }), RangeError)
  })

  it('une seule ligne `booking_list` par affichage, même rendu deux fois en même temps', async () => {
    const periode = {
      from: new Date('2027-02-28T23:00:00Z'),
      to: new Date('2027-03-01T23:00:00Z'),
      now: new Date('2027-03-01T08:00:00Z'),
    }
    await Promise.all([
      listAgendaLogged(coffre, CAT, periode),
      listAgendaLogged(coffre, CAT, periode),
    ])
    await listAgendaLogged(coffre, 'sady-agenda@exemple.test', periode)
    assert.deepEqual(
      (await journal()).map((ligne) => [ligne.actor, ligne.action]),
      [
        [CAT, 'booking_list'],
        ['sady-agenda@exemple.test', 'booking_list'],
      ],
    )
  })

  it('remet les octets scellés exacts, une ligne `booking_read` par appel, rien pour un inconnu', async () => {
    const a = await appel(new Date('2027-03-01T09:30:00Z'))
    const b = await appel(new Date('2027-03-01T15:00:00Z'), 'confirmed', 'Ysolde Factice')
    const lus = await readBookingsSealed(coffre, [b, a, randomUUID(), 'pas-un-id', a], CAT)
    assert.deepEqual(
      lus.map((lu) => lu.id),
      [a, b],
    )
    const { rows } = await admin.query('SELECT id, sealed FROM bookings ORDER BY starts_at')
    assert.deepEqual(Buffer.from(lus[0]?.sealed ?? []), rows[0].sealed)
    // Ouvert seulement avec la clé privée du coffre (ce que fait le navigateur).
    const ouvert = await openSealedBooking(lus[1]?.sealed ?? new Uint8Array(), cles)
    assert.deepEqual(ouvert, {
      nom: 'Ysolde Factice',
      telephone: NUMERO,
      langue: 'en',
      sms: false,
      origine: 'salon',
    })
    assert.deepEqual(await journal(), [
      { actor: CAT, action: 'booking_read', booking_id: a, request_id: null },
      { actor: CAT, action: 'booking_read', booking_id: b, request_id: null },
    ])

    await admin.query('DELETE FROM vault_access_log')
    assert.deepEqual(await readBookingsSealed(coffre, [randomUUID()], CAT), [])
    assert.deepEqual(await readBookingsSealed(coffre, [], CAT), [])
    assert.deepEqual(await journal(), [])
  })

  it('statut : « fait » ou « pas de réponse » sur un appel commencé, refus sinon', async () => {
    const passe = await appel(dans(-60))
    assert.equal(await setBookingStatus(coffre, passe, 'done', CAT), 'changed')
    assert.equal(await statut(passe), 'done')
    // Double clic : rien ne change, rien n'est écrit.
    assert.equal(await setBookingStatus(coffre, passe, 'done', CAT), 'unchanged')
    // Correction d'un clic.
    assert.equal(await setBookingStatus(coffre, passe, 'no_answer', CAT), 'changed')
    assert.equal(await statut(passe), 'no_answer')

    const aVenir = await appel(dans(90))
    const annule = await appel(dans(-90), 'cancelled_by_house')
    for (const id of [aVenir, annule]) {
      for (const choix of ['done', 'no_answer'] as const) {
        assert.equal(await setBookingStatus(coffre, id, choix, CAT), 'refused')
      }
    }
    assert.equal(await statut(aVenir), 'confirmed')
    assert.equal(await statut(annule), 'cancelled_by_house')
    assert.equal(await setBookingStatus(coffre, randomUUID(), 'done', CAT), 'not-found')
    assert.equal(await setBookingStatus(coffre, 'pas-un-id', 'done', CAT), 'not-found')
    await assert.rejects(setBookingStatus(coffre, passe, 'confirmed' as 'done', CAT), RangeError)

    assert.deepEqual(await journal(), [
      { actor: CAT, action: 'booking_status', booking_id: passe, request_id: null },
      { actor: CAT, action: 'booking_status', booking_id: passe, request_id: null },
    ])
  })

  it('rattachement, retrait, demande inconnue, remise à zéro quand la demande est effacée', async () => {
    const id = await appel(new Date('2027-03-01T09:30:00Z'))
    const premiere = await demande()
    const periode = {
      from: new Date('2027-02-28T23:00:00Z'),
      to: new Date('2027-03-01T23:00:00Z'),
      now: new Date('2027-03-01T08:00:00Z'),
    }

    assert.equal(await attachBooking(coffre, id, premiere, CAT), 'attached')
    assert.equal(await attachBooking(coffre, id, premiere, CAT), 'unchanged')
    const { rows } = await admin.query('SELECT created_at FROM vault_requests WHERE id = $1', [
      premiere,
    ])
    const lu = await listAgendaLogged(coffre, CAT, periode)
    assert.equal(lu.calls[0]?.requestId, premiere)
    assert.equal(lu.calls[0]?.requestCreatedAt?.toISOString(), rows[0].created_at.toISOString())

    assert.equal(await attachBooking(coffre, id, randomUUID(), CAT), 'unknown-request')
    assert.equal(await attachBooking(coffre, id, 'pas-un-id', CAT), 'unknown-request')
    assert.equal(await attachBooking(coffre, randomUUID(), premiere, CAT), 'not-found')
    assert.equal(await attachBooking(coffre, id, null, CAT), 'detached')
    assert.equal(await attachBooking(coffre, id, null, CAT), 'unchanged')

    // Rattaché de nouveau, puis la demande est effacée depuis le coffre : l'appel reste, sans
    // rattachement ; le journal garde les deux lignes.
    assert.equal(await attachBooking(coffre, id, premiere, CAT), 'attached')
    assert.equal(await deleteRequest(coffre, premiere, CAT), true)
    await admin.query('DELETE FROM vault_access_log WHERE action = $1', ['booking_list'])
    const apres = await listAgendaLogged(coffre, CAT, periode)
    assert.equal(apres.calls[0]?.requestId, null)
    assert.equal(apres.calls[0]?.requestCreatedAt, null)

    assert.deepEqual(
      (await journal()).filter((ligne) => ligne.action !== 'booking_list'),
      [
        { actor: CAT, action: 'booking_attach', booking_id: id, request_id: premiere },
        { actor: CAT, action: 'booking_attach', booking_id: id, request_id: null },
        { actor: CAT, action: 'booking_attach', booking_id: id, request_id: premiere },
        { actor: CAT, action: 'delete', booking_id: null, request_id: premiere },
      ],
    )
  })

  it('journal sans contenu : ni nom, ni numéro, ni octets scellés, ni heure, ni statut', async () => {
    const id = await appel(dans(-45))
    const rattachee = await demande()
    const from = dans(-24 * 60)
    await agendaDuCoffre(coffre, autorise, { from, to: dans(24 * 60), now: new Date() })
    await scellesAppelsDuCoffre(coffre, autorise, [id])
    await statutAppelDuCoffre(coffre, autorise, id, 'done')
    await rattachementAppelDuCoffre(coffre, autorise, id, rattachee)
    assert.deepEqual(
      (await journal()).map((ligne) => ligne.action),
      ['booking_list', 'booking_read', 'booking_status', 'booking_attach'],
    )

    const { rows } = await admin.query('SELECT * FROM vault_access_log')
    const { rows: appels } = await admin.query('SELECT sealed, starts_at FROM bookings')
    const brut = JSON.stringify(rows).toLowerCase()
    for (const interdit of [
      'hortense',
      '55 44 33',
      '470554433',
      'salon',
      'done',
      appels[0].sealed.toString('hex'),
      appels[0].starts_at.toISOString().toLowerCase(),
    ]) {
      assert.equal(brut.includes(interdit), false, interdit)
    }
    for (const ligne of rows) {
      for (const colonne of [
        'purged_requests',
        'purged_sessions',
        'purged_rate_limits',
        'purged_verifications',
        'purged_bookings',
        'purged_tokens',
      ]) {
        assert.equal(ligne[colonne], null)
      }
    }
  })

  it('sans session ouverte par le TOTP, rien n’est lu ni écrit', async () => {
    const id = await appel(dans(-45))
    const rattachee = await demande()
    const compte = { id: 'u1', email: CAT, nom: 'Cat Factice' }
    const periode = { from: dans(-60 * 24), to: dans(60 * 24), now: new Date() }
    for (const acces of [{ etat: 'anonyme' as const }, { etat: 'enrolement' as const, compte }]) {
      assert.equal(await agendaDuCoffre(coffre, acces, periode), null)
      assert.equal(await demandesRecentesDuCoffre(coffre, acces), null)
      assert.equal(await scellesAppelsDuCoffre(coffre, acces, [id]), null)
      assert.equal(await statutAppelDuCoffre(coffre, acces, id, 'done'), null)
      assert.equal(await rattachementAppelDuCoffre(coffre, acces, id, rattachee), null)
    }
    assert.deepEqual(await journal(), [])
    assert.equal(await statut(id), 'confirmed')
    // Session autorisée : les demandes récentes, colonnes en clair seulement.
    const recentes = await demandesRecentesDuCoffre(coffre, autorise)
    assert.deepEqual(
      recentes?.map((recente) => recente.id),
      [rattachee],
    )
    assert.equal(Object.hasOwn(recentes?.[0] ?? {}, 'sealed'), false)
  })
})
