import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import sodium from 'libsodium-wrappers-sumo'
import pg from 'pg'

import {
  annulationAppelDuCoffre,
  appelDuCoffre,
  deplacementAppelDuCoffre,
  effacementAppelDuCoffre,
} from '../../src/lib/auth/acces.ts'
import type { AccesCoffre } from '../../src/lib/auth/acces.ts'
import {
  cancelBookingByHouse,
  deleteBooking,
  moveBookingByHouse,
} from '../../src/lib/booking/agenda-repository.ts'
import {
  bookSlot,
  cancelBookingByToken,
  createBookingLink,
  moveBookingByToken,
  readManageLink,
} from '../../src/lib/booking/bookings.ts'
import { listConfirmedCalls } from '../../src/lib/booking/repository.ts'
import { deriveManageToken, generateToken, hashToken } from '../../src/lib/booking/tokens.ts'
import {
  addDays,
  isoWeekday,
  zonedParts,
  zonedTimeToUtc,
} from '../../src/lib/booking/zoned-time.ts'
import { retentionDeadline } from '../../src/lib/vault/retention.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { sealBooking } from '../../src/lib/vault/seal.ts'
import { applyRoles, coffrePool, resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Déplacer et annuler un appel (story 3.11 ; docs/reservation-appel.md §2, étape 6, §3.2 ;
// db/migrations/0014_deplacer_annuler.sql), contre PostgreSQL 17 avec les vrais rôles : `site_public`
// par le lien de gestion, `coffre` depuis l'agenda. Déplacement atomique (l'ancien créneau n'est libéré
// qu'une fois le nouveau pris), plafond du jour, chevauchement refusé (23P01) même en course,
// annulation qui libère la plage, séquence de l'invitation posée par la base, déclencheurs sous tout
// rôle, droits minimaux, journal sans contenu, ni nom ni numéro ni jeton dans les requêtes ou en base.
// Données factices uniquement.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const FUSEAU = 'Europe/Brussels'
const MINUTE = 60_000
const CAT = 'cat-gestion@exemple.test'
const SECRET = 'secret-factice-des-tests-de-gestion-0123456'
const NOM = 'Philomène Factice-Gestion'
const NUMERO = '+32 470 11 22 33'
// Un lundi, 9 h à Bruxelles, au moins 7 jours après aujourd'hui : les déclencheurs de 0014 bornent un
// déplacement par l'horizon de réservation compté depuis l'heure de la BASE (now()), les dates du test
// suivent donc l'heure réelle. Premier créneau libre : le mardi à 10 h 30.
const AUJOURDHUI = zonedParts(new Date(), FUSEAU).date
const LUNDI = addDays(AUJOURDHUI, 7 + ((8 - isoWeekday(AUJOURDHUI)) % 7))
const MARDI = addDays(LUNDI, 1)
const MERCREDI = addDays(LUNDI, 2)
const MAINTENANT = zonedTimeToUtc(LUNDI, '09:00', FUSEAU)
const apres = (date: Date, minutes: number) => new Date(date.getTime() + minutes * MINUTE)
const PRIVACY = '2026-11-18'
const REFUS = { code: '42501' }
const CONTROLE = { code: '23514' }

const admin = testPool()
const coffre = coffrePool()
const sitePool = () =>
  new pg.Pool({ connectionString: TEST_DATABASE_URL, options: '-c role=site_public', max: 4 })
const site = sitePool()
const siteBis = sitePool()

const autorise: AccesCoffre = {
  etat: 'autorise',
  compte: { id: 'compte-gestion', email: CAT, nom: 'Compte Factice' },
}

let clePublique: string

const heure = (date: string, h: string) => zonedTimeToUtc(date, h, FUSEAU)
const MARDI_1030 = heure(MARDI, '10:30')
const MARDI_1115 = heure(MARDI, '11:15')
const MARDI_1200 = heure(MARDI, '12:00')
const MARDI_1600 = heure(MARDI, '16:00')
const MARDI_1645 = heure(MARDI, '16:45')
const MERCREDI_1030 = heure(MERCREDI, '10:30')

interface Reserve {
  id: string
  gestion: string
  acces: string
}

async function reserver(start: Date): Promise<Reserve> {
  const acces = (await createBookingLink(coffre, CAT, MAINTENANT)).token
  const gestion = deriveManageToken(acces, SECRET)
  const resultat = await bookSlot(site, {
    token: acces,
    manageToken: gestion,
    start,
    sealed: await sealBooking(
      { nom: NOM, telephone: NUMERO, langue: 'fr', sms: false, origine: null },
      clePublique,
    ),
    privacyVersion: PRIVACY,
    now: MAINTENANT,
  })
  assert.equal(resultat.status, 'booked')
  if (resultat.status !== 'booked') throw new Error('réservation attendue')
  return { id: resultat.bookingId, gestion, acces }
}

async function appel(id: string) {
  const { rows } = await admin.query(
    `SELECT starts_at, ends_at, lower(slot) AS debut, upper(slot) AS fin, status, sequence
     FROM bookings WHERE id = $1`,
    [id],
  )
  return rows[0]
}

async function echeanceGestion(id: string): Promise<string> {
  const { rows } = await admin.query(
    "SELECT expires_at FROM booking_tokens WHERE booking_id = $1 AND purpose = 'manage'",
    [id],
  )
  return rows[0]?.expires_at.toISOString()
}

const deplacer = (gestion: string, start: Date, pool: pg.Pool = site) =>
  moveBookingByToken(pool, { token: gestion, start, now: MAINTENANT })

// Appel inséré directement autour de l'heure réelle (les déclencheurs comparent au `now()` de la base).
async function appelReel(minutes: number, statut = 'confirmed'): Promise<string> {
  const id = randomUUID()
  const debut = new Date(Date.now() + minutes * MINUTE)
  const fin = new Date(debut.getTime() + 30 * MINUTE)
  await admin.query(
    `INSERT INTO bookings (id, starts_at, ends_at, slot, privacy_version, retention_until, sealed, status)
     VALUES ($1, $2, $3, tstzrange($2, $4), 'v', $2::timestamptz + interval '1 year', $5, $6)`,
    [id, debut, fin, new Date(fin.getTime() + 15 * MINUTE), Buffer.alloc(2096, 3), statut],
  )
  return id
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

describe('déplacer et annuler un appel (3.11)', () => {
  before(async () => {
    await sodium.ready
    clePublique = sodium.to_base64(
      sodium.crypto_box_keypair().publicKey,
      sodium.base64_variants.ORIGINAL,
    )
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
    // Les dates suivent l'heure réelle : aucun jour férié ne doit tomber dans la semaine du test.
    await admin.query("UPDATE availability_exceptions SET active = false WHERE kind = 'holiday'")
  })
  after(async () => {
    await siteBis.end()
    await site.end()
    await coffre.end()
    await admin.end()
  })

  it('déplace dans la même ligne : nouvelle plage, ancienne libérée, séquence et échéance suivent', async () => {
    const a = await reserver(MARDI_1030)
    assert.equal(await echeanceGestion(a.id), apres(MARDI_1030, 30).toISOString())
    // La page de gestion propose les créneaux sans cet appel : le sien y figure.
    const lu = await readManageLink(site, a.gestion, MAINTENANT, { withSlots: true })
    assert.ok(lu.state === 'valid')
    assert.ok(lu.slots.some((slot) => slot.start.getTime() === MARDI_1030.getTime()))

    const deplace = await deplacer(a.gestion, MARDI_1600)
    assert.equal(deplace.status, 'moved')
    const ligne = await appel(a.id)
    assert.equal(ligne.starts_at.toISOString(), MARDI_1600.toISOString())
    assert.equal(ligne.ends_at.toISOString(), apres(MARDI_1600, 30).toISOString())
    assert.equal(ligne.fin.toISOString(), apres(MARDI_1600, 45).toISOString())
    assert.equal(ligne.status, 'confirmed')
    assert.equal(ligne.sequence, 1)
    assert.equal(await echeanceGestion(a.id), apres(MARDI_1600, 30).toISOString())
    // L'ancien créneau est libre : une autre personne le prend.
    const b = await reserver(MARDI_1030)
    assert.notEqual(b.id, a.id)
    // Même créneau (double envoi) : rien n'est écrit.
    assert.equal((await deplacer(a.gestion, MARDI_1600)).status, 'unchanged')
    assert.equal((await appel(a.id)).sequence, 1)
    // Encore un déplacement : séquence 2.
    assert.equal((await deplacer(a.gestion, MERCREDI_1030)).status, 'moved')
    assert.equal((await appel(a.id)).sequence, 2)
  })

  it('créneau pris, hors des règles ou passé : rien ne bouge, l’ancien créneau reste', async () => {
    const a = await reserver(MARDI_1030)
    await reserver(MARDI_1600)
    for (const cible of [
      MARDI_1600, // pris
      heure(MARDI, '13:00'), // hors de la semaine type
      heure(LUNDI, '16:00'), // dans le délai minimal
    ]) {
      const issue = await deplacer(a.gestion, cible)
      assert.equal(issue.status, 'taken', cible.toISOString())
      if (issue.status === 'taken') {
        assert.ok(issue.slots.every((slot) => slot.start.getTime() !== MARDI_1600.getTime()))
      }
    }
    const ligne = await appel(a.id)
    assert.equal(ligne.starts_at.toISOString(), MARDI_1030.toISOString())
    assert.equal(ligne.sequence, 0)
  })

  it('plafond du jour : sa propre place lui est rendue, pas celle d’un autre jour', async () => {
    const mardi = [
      await reserver(MARDI_1030),
      await reserver(MARDI_1115),
      await reserver(MARDI_1200),
      await reserver(MARDI_1600),
    ]
    const mercredi = await reserver(MERCREDI_1030)
    // Le mardi est au plafond (4) : un appel du mercredi n'y entre pas.
    assert.equal((await deplacer(mercredi.gestion, MARDI_1645)).status, 'taken')
    // Un appel du mardi se déplace dans le mardi : il garde sa place.
    assert.equal((await deplacer(mardi[0]!.gestion, MARDI_1645)).status, 'moved')
    const { rows } = await admin.query(
      `SELECT count(*)::int AS n FROM bookings
       WHERE status = 'confirmed' AND starts_at >= $1 AND starts_at < $2`,
      [heure(MARDI, '00:00'), heure(MERCREDI, '00:00')],
    )
    assert.equal(rows[0].n, 4)
    // Une annulation libère une place du plafond.
    assert.equal(
      await cancelBookingByToken(site, { token: mardi[1]!.gestion, now: MAINTENANT }),
      'cancelled',
    )
    assert.equal((await deplacer(mercredi.gestion, MARDI_1115)).status, 'moved')
  })

  it('course : deux déplacements vers le même créneau, une réservation et un déplacement', async () => {
    const a = await reserver(MARDI_1030)
    const b = await reserver(MARDI_1115)
    const issues = await Promise.all([
      deplacer(a.gestion, MARDI_1600, site),
      deplacer(b.gestion, MARDI_1600, siteBis),
    ])
    assert.deepEqual(issues.map((issue) => issue.status).sort(), ['moved', 'taken'])
    const { rows } = await admin.query(
      'SELECT count(*)::int AS n FROM bookings WHERE starts_at = $1',
      [MARDI_1600],
    )
    assert.equal(rows[0].n, 1)
    // Le perdant n'a pas bougé.
    const perdant = issues[0]!.status === 'taken' ? a : b
    const depart = perdant === a ? MARDI_1030 : MARDI_1115
    assert.equal((await appel(perdant.id)).starts_at.toISOString(), depart.toISOString())
  })

  it('la contrainte d’exclusion tient seule : un déplacement qui chevauche lève 23P01', async () => {
    const a = await reserver(MARDI_1030)
    await reserver(MARDI_1600)
    await assert.rejects(
      admin.query(
        `UPDATE bookings SET starts_at = $2, ends_at = $3, slot = tstzrange($2, $4) WHERE id = $1`,
        [a.id, heure(MARDI, '16:10'), heure(MARDI, '16:40'), heure(MARDI, '16:55')],
      ),
      { code: '23P01' },
    )
    assert.equal((await appel(a.id)).starts_at.toISOString(), MARDI_1030.toISOString())
  })

  it('annule : la plage se libère, la séquence monte, pas de retour en arrière', async () => {
    const a = await reserver(MARDI_1030)
    assert.equal(
      await cancelBookingByToken(site, { token: a.gestion, now: MAINTENANT }),
      'cancelled',
    )
    const ligne = await appel(a.id)
    assert.equal(ligne.status, 'cancelled_by_guest')
    assert.equal(ligne.sequence, 1)
    assert.deepEqual(
      await listConfirmedCalls(site, heure(MARDI, '00:00'), heure(MERCREDI, '00:00')),
      [],
    )
    // Le créneau se reprend.
    await reserver(MARDI_1030)
    // Déjà annulé : rien de plus ; ne se déplace plus.
    assert.equal(
      await cancelBookingByToken(site, { token: a.gestion, now: MAINTENANT }),
      'already-cancelled',
    )
    assert.equal((await deplacer(a.gestion, MARDI_1600)).status, 'not-movable')
    // La page de gestion le dit, jusqu'à l'heure de fin prévue.
    const lu = await readManageLink(site, a.gestion, MAINTENANT, { withSlots: true })
    assert.ok(lu.state === 'valid')
    assert.equal(lu.phase, 'cancelled')
    assert.deepEqual(lu.slots, [])
    // Sous tout rôle, jamais de retour à « confirmé » ni de qualification.
    for (const statut of ['confirmed', 'done', 'no_answer', 'cancelled_by_house']) {
      await assert.rejects(
        admin.query('UPDATE bookings SET status = $2 WHERE id = $1', [a.id, statut]),
        CONTROLE,
        statut,
      )
    }
    assert.equal((await appel(a.id)).sequence, 1)
  })

  it('déclencheurs : un appel commencé ne se déplace ni ne s’annule, pas vers le passé', async () => {
    const commence = await appelReel(-5)
    const aVenir = await appelReel(3 * 24 * 60)
    const dans = (minutes: number) => new Date(Date.now() + minutes * MINUTE)
    const vers = (id: string, debut: Date) =>
      admin.query(
        `UPDATE bookings SET starts_at = $2, ends_at = $2::timestamptz + interval '30 minutes',
           slot = tstzrange($2, $2::timestamptz + interval '45 minutes') WHERE id = $1`,
        [id, debut],
      )
    await assert.rejects(vers(commence, dans(4 * 24 * 60)), CONTROLE)
    await assert.rejects(vers(aVenir, dans(-60)), CONTROLE)
    for (const statut of ['cancelled_by_guest', 'cancelled_by_house']) {
      await assert.rejects(
        admin.query('UPDATE bookings SET status = $2 WHERE id = $1', [commence, statut]),
        CONTROLE,
      )
    }
    // Un appel qualifié ne se déplace pas.
    const fait = await appelReel(-60, 'done')
    await assert.rejects(vers(fait, dans(4 * 24 * 60)), CONTROLE)
    // Un appel à venir se déplace sous tout rôle (coffre) : séquence et échéance posées par la base.
    const nouveau = dans(5 * 24 * 60)
    await coffre.query(
      `UPDATE bookings SET starts_at = $2, ends_at = $2::timestamptz + interval '30 minutes',
         slot = tstzrange($2, $2::timestamptz + interval '45 minutes') WHERE id = $1`,
      [aVenir, nouveau],
    )
    assert.equal((await appel(aVenir)).sequence, 1)
    const { rows: echeance } = await admin.query(
      'SELECT retention_until FROM bookings WHERE id = $1',
      [aVenir],
    )
    assert.equal(
      echeance[0].retention_until.toISOString(),
      retentionDeadline(nouveau, 12).toISOString(),
    )
    // La personne, par sa fonction et l'empreinte de SON lien, annule ; une seconde fois, rien.
    const lien = generateToken()
    await admin.query(
      `INSERT INTO booking_tokens (id, token_hash, purpose, booking_id, expires_at)
       SELECT $1, $2, 'manage', id, ends_at FROM bookings WHERE id = $3`,
      [randomUUID(), lien.hash, aVenir],
    )
    const { rows } = await site.query('SELECT cancel_booking_as_guest($1) AS fait', [lien.hash])
    assert.equal(rows[0].fait, true)
    const { rows: encore } = await site.query('SELECT cancel_booking_as_guest($1) AS fait', [
      lien.hash,
    ])
    assert.equal(encore[0].fait, false)
    assert.equal((await appel(aVenir)).status, 'cancelled_by_guest')
    assert.equal((await appel(aVenir)).sequence, 2)
  })

  it('bornes d’un déplacement sous tout rôle : durée, pause, horizon, échéance recalculée', async () => {
    const id = await appelReel(3 * 24 * 60)
    const dans = (minutes: number) => new Date(Date.now() + minutes * MINUTE)
    const vers = (debut: Date, duree: number, occupe: number) =>
      coffre.query(
        `UPDATE bookings SET starts_at = $2, ends_at = $3, slot = tstzrange($2, $4) WHERE id = $1`,
        [id, debut, apres(debut, duree), apres(debut, occupe)],
      )
    const debut = dans(4 * 24 * 60)
    // Durée changée, pause démesurée (plage jusqu'en 2100), au-delà de l'horizon (21 jours).
    await assert.rejects(vers(debut, 60, 75), CONTROLE, 'durée')
    await assert.rejects(vers(debut, 30, 30 + 16), CONTROLE, 'pause')
    await assert.rejects(
      coffre.query(`UPDATE bookings SET slot = tstzrange(starts_at, '2100-01-01') WHERE id = $1`, [
        id,
      ]),
      CONTROLE,
      'plage jusqu’en 2100',
    )
    await assert.rejects(vers(dans(23 * 24 * 60), 30, 45), CONTROLE, 'horizon')
    // Dans les bornes : passe, échéance recalculée depuis le nouveau début.
    await vers(debut, 30, 45)
    const { rows } = await admin.query('SELECT retention_until FROM bookings WHERE id = $1', [id])
    assert.equal(rows[0].retention_until.toISOString(), retentionDeadline(debut, 12).toISOString())
    // Le cas d'un 29 février : même règle que retentionDeadline (fin de février de l'année suivante).
    const { rows: bissextile } = await admin.query<{ fin: Date }>(
      `SELECT (('2028-02-29T10:00:00Z'::timestamptz at time zone 'UTC') + interval '12 months')
         at time zone 'UTC' AS fin`,
    )
    assert.equal(
      bissextile[0]!.fin.toISOString(),
      retentionDeadline(new Date('2028-02-29T10:00:00Z'), 12).toISOString(),
    )
  })

  it('droits du site public : aucune écriture directe sur les appels, aucune empreinte lue', async () => {
    const a = await reserver(MARDI_1030)
    for (const sql of [
      // Relecture sécurité : ni déplacement direct (plage jusqu'en 2100, 3 h du matin…), ni statut.
      'UPDATE bookings SET starts_at = starts_at',
      "UPDATE bookings SET slot = tstzrange(starts_at, '2100-01-01')",
      'UPDATE bookings SET ends_at = ends_at',
      "UPDATE bookings SET status = 'cancelled_by_house'",
      "UPDATE bookings SET status = 'cancelled_by_guest'",
      "UPDATE bookings SET status = 'done'",
      'UPDATE bookings SET sequence = 7',
      'UPDATE bookings SET sealed = sealed',
      'UPDATE bookings SET retention_until = now()',
      'UPDATE bookings SET access_token_id = NULL',
      'UPDATE bookings SET request_id = NULL',
      'SELECT id FROM bookings FOR UPDATE',
      'DELETE FROM bookings',
      'SELECT sealed FROM bookings',
      'SELECT token_hash FROM booking_tokens',
      'SELECT email_hmac FROM booking_tokens',
      "SELECT cancel_booking_as_guest(token_hash) FROM booking_tokens WHERE purpose = 'manage'",
      'UPDATE booking_tokens SET expires_at = expires_at',
      'UPDATE booking_tokens SET booking_id = NULL',
      'UPDATE booking_tokens SET revoked_at = now()',
      'DELETE FROM booking_tokens',
      "INSERT INTO vault_access_log (actor, action, booking_id) VALUES ('x', 'booking_move', gen_random_uuid())",
    ]) {
      await assert.rejects(site.query(sql), REFUS, sql)
    }
    // L'ancienne signature (un identifiant d'appel) n'existe plus : `SELECT
    // cancel_booking_as_guest(id) FROM bookings` n'annule rien.
    await assert.rejects(site.query('SELECT cancel_booking_as_guest(id) FROM bookings'), {
      code: '42883',
    })
    assert.equal((await appel(a.id)).status, 'confirmed')
    await assert.rejects(
      site.query(
        `INSERT INTO booking_tokens (id, token_hash, purpose, booking_id, expires_at)
         VALUES ($1, $2, 'manage', $3, now() + interval '1 year')`,
        [randomUUID(), generateToken().hash, a.id],
      ),
      REFUS,
    )
    // La fonction ne crée rien pour un appel qui a déjà son lien, ni pour un lien d'accès inconnu,
    // ni pour un appel réservé dans une autre transaction (C1 : `created_at = now()`).
    const { rows: acces } = await admin.query(
      'SELECT access_token_id FROM bookings WHERE id = $1',
      [a.id],
    )
    const ancien = generateToken()
    const ancienId = randomUUID()
    await admin.query(
      `INSERT INTO booking_tokens (id, token_hash, purpose, created_at, expires_at)
       VALUES ($1, $2, 'access', now() - interval '1 hour', now() + interval '1 hour')`,
      [ancienId, ancien.hash],
    )
    const sansLien = await appelReel(3 * 24 * 60)
    await admin.query(
      "UPDATE bookings SET access_token_id = $2, created_at = now() - interval '1 minute' WHERE id = $1",
      [sansLien, ancienId],
    )
    await admin.query('UPDATE booking_tokens SET used_at = now() WHERE id = $1', [ancienId])
    for (const cible of [acces[0].access_token_id, randomUUID(), ancienId]) {
      const { rows } = await site.query('SELECT issue_manage_token($1, $2, $3) AS cree', [
        randomUUID(),
        generateToken().hash,
        cible,
      ])
      assert.equal(rows[0].cree, false)
    }
    // Le coffre n'appelle aucune fonction du site public.
    for (const sql of [
      'SELECT issue_manage_token(gen_random_uuid(), $1, gen_random_uuid())',
      'SELECT cancel_booking_as_guest($1)',
      'SELECT * FROM lock_call_as_guest($1)',
      "SELECT move_booking_as_guest($1, now(), now() + interval '30 minutes', now() + interval '45 minutes')",
      'SELECT * FROM find_booking_token($1)',
    ]) {
      await assert.rejects(coffre.query(sql, [generateToken().hash]), REFUS, sql)
    }
    await assert.rejects(coffre.query('UPDATE bookings SET sequence = 0'), REFUS)
    const { rows: liens } = await admin.query(
      "SELECT count(*)::int AS n FROM booking_tokens WHERE purpose = 'manage'",
    )
    assert.equal(liens[0].n, 1)
  })

  it('fonctions du site public : empreinte inconnue, d’accès, expirée ou annulée → rien', async () => {
    const a = await reserver(MARDI_1030)
    const fermer = await reserver(MARDI_1600)
    await admin.query(
      "UPDATE booking_tokens SET revoked_at = now() WHERE booking_id = $1 AND purpose = 'manage'",
      [fermer.id],
    )
    // Lien expiré : celui d'un appel dont l'échéance est passée (posée à la main pour le test).
    const expire = await reserver(MERCREDI_1030)
    await admin.query(
      `UPDATE booking_tokens SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
       WHERE booking_id = $1`,
      [expire.id],
    )
    const debut = heure(MERCREDI, '16:00')
    for (const hash of [
      generateToken().hash,
      hashToken(a.acces),
      hashToken(fermer.gestion),
      hashToken(expire.gestion),
    ]) {
      const verrou = await site.query('SELECT * FROM lock_call_as_guest($1)', [hash])
      assert.equal(verrou.rows.length, 0)
      const { rows: deplace } = await site.query(
        'SELECT move_booking_as_guest($1, $2, $3, $4) AS fait',
        [hash, debut, apres(debut, 30), apres(debut, 45)],
      )
      assert.equal(deplace[0].fait, false)
      const { rows: annule } = await site.query('SELECT cancel_booking_as_guest($1) AS fait', [
        hash,
      ])
      assert.equal(annule[0].fait, false)
    }
    for (const id of [a.id, fermer.id, expire.id]) {
      const ligne = await appel(id)
      assert.equal(ligne.status, 'confirmed')
      assert.equal(ligne.sequence, 0)
    }
    // Avec le bon lien, la fonction déplace l'appel de ce lien, et lui seul, dans les bornes.
    const { rows } = await site.query('SELECT move_booking_as_guest($1, $2, $3, $4) AS fait', [
      hashToken(a.gestion),
      debut,
      apres(debut, 30),
      apres(debut, 45),
    ])
    assert.equal(rows[0].fait, true)
    assert.equal((await appel(a.id)).starts_at.toISOString(), debut.toISOString())
    await assert.rejects(
      site.query('SELECT move_booking_as_guest($1, $2, $3, $4)', [
        hashToken(a.gestion),
        debut,
        apres(debut, 30),
        new Date('2100-01-01T00:00:00Z'),
      ]),
      CONTROLE,
    )
  })

  it('un lien de gestion inconnu, d’accès, expiré ou annulé ne touche à rien', async () => {
    const a = await reserver(MARDI_1030)
    await admin.query(
      "UPDATE booking_tokens SET revoked_at = now() WHERE booking_id = $1 AND purpose = 'manage'",
      [a.id],
    )
    const b = await reserver(MARDI_1600)
    for (const jeton of [a.gestion, b.acces, generateToken().token, 'court']) {
      assert.deepEqual(await deplacer(jeton, MERCREDI_1030), { status: 'invalid-link' })
      assert.equal(
        await cancelBookingByToken(site, { token: jeton, now: MAINTENANT }),
        'invalid-link',
      )
      assert.deepEqual(await readManageLink(site, jeton, MAINTENANT), { state: 'invalid' })
    }
    // Après la fin de l'appel, le lien ne vaut plus.
    assert.deepEqual(
      await moveBookingByToken(site, {
        token: b.gestion,
        start: MERCREDI_1030,
        now: apres(MARDI_1600, 30),
      }),
      { status: 'invalid-link' },
    )
    assert.equal((await appel(a.id)).starts_at.toISOString(), MARDI_1030.toISOString())
    assert.equal((await appel(b.id)).starts_at.toISOString(), MARDI_1600.toISOString())
  })

  it('coffre : déplacer, annuler, effacer, chacun journalisé sans contenu', async () => {
    const a = await reserver(MARDI_1030)
    const b = await reserver(MARDI_1115)
    const lu = await appelDuCoffre(coffre, autorise, a.id, MAINTENANT)
    assert.ok(lu)
    assert.equal(lu.phase, 'upcoming')
    assert.ok(lu.slots.some((slot) => slot.start.getTime() === MARDI_1030.getTime()))

    const deplace = await deplacementAppelDuCoffre(coffre, autorise, a.id, MARDI_1600, MAINTENANT)
    assert.equal(deplace?.status, 'moved')
    // Le lien de gestion de la personne suit.
    const vu = await readManageLink(site, a.gestion, MAINTENANT)
    assert.ok(vu.state === 'valid')
    assert.equal(vu.call.start.toISOString(), MARDI_1600.toISOString())
    assert.equal(vu.call.sequence, 1)
    // Pris par un autre appel : refusé, sans journal.
    assert.equal(
      (await moveBookingByHouse(coffre, b.id, MARDI_1600, CAT, MAINTENANT)).status,
      'taken',
    )

    assert.equal(await annulationAppelDuCoffre(coffre, autorise, b.id, MAINTENANT), 'cancelled')
    assert.equal((await appel(b.id)).status, 'cancelled_by_house')
    assert.equal(await cancelBookingByHouse(coffre, b.id, CAT, MAINTENANT), 'already-cancelled')
    const parLaPersonne = await readManageLink(site, b.gestion, MAINTENANT)
    assert.ok(parLaPersonne.state === 'valid' && parLaPersonne.phase === 'cancelled')

    assert.equal(await effacementAppelDuCoffre(coffre, autorise, b.id), true)
    assert.equal(await deleteBooking(coffre, b.id, CAT), false)
    const { rows: restes } = await admin.query(
      'SELECT count(*)::int AS n FROM bookings WHERE id = $1',
      [b.id],
    )
    assert.equal(restes[0].n, 0)
    // Lien de gestion (clé étrangère) et lien d'accès effacés avec lui.
    const { rows: liens } = await admin.query(
      'SELECT count(*)::int AS n FROM booking_tokens WHERE token_hash = ANY ($1::bytea[])',
      [[hashToken(b.gestion), hashToken(b.acces)]],
    )
    assert.equal(liens[0].n, 0)
    assert.deepEqual(await readManageLink(site, b.gestion, MAINTENANT), { state: 'invalid' })

    const { rows: journal } = await admin.query(
      `SELECT * FROM vault_access_log WHERE action LIKE 'booking_%' AND action <> 'booking_link'
       ORDER BY id`,
    )
    assert.deepEqual(
      journal.map((ligne) => [ligne.actor, ligne.action, ligne.booking_id, ligne.request_id]),
      [
        [CAT, 'booking_move', a.id, null],
        [CAT, 'booking_cancel', b.id, null],
        [CAT, 'booking_delete', b.id, null],
      ],
    )
    const texte = JSON.stringify(journal).toLowerCase()
    for (const interdit of [
      NOM.toLowerCase(),
      '470',
      MARDI_1600.toISOString().slice(0, 13).toLowerCase(),
      'cancelled_by',
    ]) {
      assert.equal(texte.includes(interdit), false, interdit)
    }
  })

  it('le journal refuse les nouvelles actions sans appel visé, ou avec une demande', async () => {
    const ecrire = (action: string, bookingId: string | null, requestId: string | null) =>
      coffre.query(
        'INSERT INTO vault_access_log (actor, action, booking_id, request_id) VALUES ($1, $2, $3, $4)',
        [CAT, action, bookingId, requestId],
      )
    for (const action of ['booking_move', 'booking_cancel', 'booking_delete']) {
      await ecrire(action, randomUUID(), null)
      await assert.rejects(ecrire(action, null, null), CONTROLE, action)
    }
    // Les actions de la 3.13 et d'avant restent acceptées.
    await ecrire('booking_list', null, null)
    await ecrire('availability', null, null)
    await ecrire('booking_link', null, null)
  })

  it('sans session ouverte par le TOTP, rien n’est lu ni écrit', async () => {
    const a = await reserver(MARDI_1030)
    const compte = autorise.etat === 'autorise' ? autorise.compte : null
    for (const acces of [
      { etat: 'anonyme' as const },
      { etat: 'enrolement' as const, compte: compte! },
    ]) {
      assert.equal(await appelDuCoffre(coffre, acces, a.id, MAINTENANT), null)
      assert.equal(
        await deplacementAppelDuCoffre(coffre, acces, a.id, MARDI_1600, MAINTENANT),
        null,
      )
      assert.equal(await annulationAppelDuCoffre(coffre, acces, a.id, MAINTENANT), null)
      assert.equal(await effacementAppelDuCoffre(coffre, acces, a.id), false)
    }
    assert.equal((await appel(a.id)).status, 'confirmed')
    const { rows } = await admin.query('SELECT count(*)::int AS n FROM vault_access_log')
    assert.equal(rows[0].n, 1) // la ligne `booking_link` du lien de réservation
  })

  it('ni nom, ni numéro, ni jeton dans les requêtes ni en base', async () => {
    let a: Reserve | null = null
    const envoye = await espionner(async () => {
      a = await reserver(MARDI_1030)
      await readManageLink(site, a.gestion, MAINTENANT, { withSlots: true })
      await deplacer(a.gestion, MARDI_1600)
      await cancelBookingByToken(site, { token: a.gestion, now: MAINTENANT })
    })
    assert.ok(a)
    const { acces, gestion } = a as Reserve
    const { rows } = await admin.query(
      `SELECT (SELECT json_agg(b)::text FROM bookings b) || (SELECT json_agg(t)::text FROM booking_tokens t) AS tout`,
    )
    const base = String(rows[0].tout).toLowerCase()
    for (const interdit of [
      NOM.toLowerCase(),
      NUMERO.replace(/\s/g, ''),
      '470 11 22',
      acces.toLowerCase(),
      gestion.toLowerCase(),
      Buffer.from(gestion, 'base64url').toString('hex'),
    ]) {
      assert.equal(envoye.includes(interdit), false, `requêtes : ${interdit}`)
      assert.equal(base.includes(interdit), false, `base : ${interdit}`)
    }
    // Témoin : l'empreinte du lien de gestion, elle, circule.
    assert.ok(envoye.includes(hashToken(gestion).toString('hex')))
  })
})
