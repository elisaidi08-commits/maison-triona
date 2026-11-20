import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { migrate } from '../../src/lib/db/migrate.ts'
import { applyRoles, coffrePool, resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Agenda des appels (story 3.13, db/migrations/0013_agenda.sql), contre PostgreSQL 17 avec les vrais
// rôles : changements de statut acceptés par la base (qualification d'un appel commencé, sous tout
// rôle), rattachement à une demande remis à nul quand elle est effacée, droits du rôle `coffre` (les
// deux seules colonnes `status` et `request_id`), aucun droit nouveau pour `site_public`, quatre
// actions de l'agenda au journal, chacune avec sa forme. Données factices uniquement.
// Le déclencheur compare au `now()` de la base : les appels sont placés autour de l'heure réelle.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const REFUS = { code: '42501' }
const CONTROLE = { code: '23514' }
const CLE_ETRANGERE = { code: '23503' }
const SCELLE = 2048 + 48
const ACTEUR = 'cat-agenda@exemple.test'
const MINUTE = 60_000

const admin = testPool()
const coffre = coffrePool()
const site = new pg.Pool({
  connectionString: TEST_DATABASE_URL,
  options: '-c role=site_public',
  max: 2,
})

// Appel de 30 minutes qui commence dans `minutes` minutes (négatif : déjà commencé), pause de 15.
async function appel(minutes: number, statut = 'confirmed'): Promise<string> {
  const id = randomUUID()
  const debut = new Date(Date.now() + minutes * MINUTE)
  const fin = new Date(debut.getTime() + 30 * MINUTE)
  const occupe = new Date(fin.getTime() + 15 * MINUTE)
  await admin.query(
    `INSERT INTO bookings
       (id, starts_at, ends_at, slot, privacy_version, retention_until, sealed, status)
     VALUES ($1, $2, $3, tstzrange($2, $4), '2026-11-18', $2::timestamptz + interval '1 year', $5, $6)`,
    [id, debut, fin, occupe, Buffer.alloc(SCELLE, 7), statut],
  )
  return id
}

async function demande(): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO vault_requests (id, kind, locale, sealed, retention_until, privacy_version)
     VALUES ($1, 'request', 'fr', $2, now() + interval '1 year', '2026-11-18')`,
    [id, randomBytes(64)],
  )
  return id
}

async function statut(id: string): Promise<{ status: string; request_id: string | null }> {
  const { rows } = await admin.query('SELECT status, request_id FROM bookings WHERE id = $1', [id])
  return rows[0]
}

describe('agenda des appels : schéma et droits (0013)', () => {
  before(async () => {
    await resetDatabase(admin)
    await migrate(admin, MIGRATIONS)
    await applyRoles(admin)
  })
  beforeEach(async () => {
    await admin.query('DELETE FROM bookings')
    await admin.query('DELETE FROM vault_requests')
  })
  after(async () => {
    await site.end()
    await coffre.end()
    await admin.end()
  })

  it('un appel commencé se qualifie : fait, pas de réponse, et Cat peut corriger', async () => {
    // Plages disjointes : un appel qualifié garde la sienne dans la contrainte d'exclusion.
    const id = await appel(-100)
    await coffre.query("UPDATE bookings SET status = 'done' WHERE id = $1", [id])
    assert.equal((await statut(id)).status, 'done')
    await coffre.query("UPDATE bookings SET status = 'no_answer' WHERE id = $1", [id])
    assert.equal((await statut(id)).status, 'no_answer')
    await coffre.query("UPDATE bookings SET status = 'done' WHERE id = $1", [id])
    // Même statut (double clic) : rien ne change, rien n'est refusé.
    await coffre.query("UPDATE bookings SET status = 'done' WHERE id = $1", [id])
    assert.equal((await statut(id)).status, 'done')
    // Commencé mais pas fini : il se qualifie déjà (un appel sans réponse se sait tout de suite).
    const enCours = await appel(-5)
    await coffre.query("UPDATE bookings SET status = 'no_answer' WHERE id = $1", [enCours])
    assert.equal((await statut(enCours)).status, 'no_answer')
  })

  it('refuse de qualifier un appel à venir ou annulé, d’annuler un appel commencé, de revenir à « confirmé »', async () => {
    const aVenir = await appel(60)
    for (const nouveau of ['done', 'no_answer']) {
      await assert.rejects(
        coffre.query('UPDATE bookings SET status = $2 WHERE id = $1', [aVenir, nouveau]),
        CONTROLE,
        nouveau,
      )
    }
    const passe = await appel(-60)
    // Annuler un appel commencé : refusé (story 3.11 ; l'annulation d'un appel à venir est testée
    // dans gestion.test.ts).
    for (const id of [passe]) {
      for (const nouveau of ['cancelled_by_guest', 'cancelled_by_house']) {
        await assert.rejects(
          coffre.query('UPDATE bookings SET status = $2 WHERE id = $1', [id, nouveau]),
          CONTROLE,
          nouveau,
        )
      }
    }
    await coffre.query("UPDATE bookings SET status = 'done' WHERE id = $1", [passe])
    await assert.rejects(
      coffre.query("UPDATE bookings SET status = 'confirmed' WHERE id = $1", [passe]),
      CONTROLE,
    )
    const annule = await appel(-60, 'cancelled_by_guest')
    await assert.rejects(
      coffre.query("UPDATE bookings SET status = 'done' WHERE id = $1", [annule]),
      CONTROLE,
    )
    // « À qualifier » ne se stocke pas.
    await assert.rejects(
      admin.query("UPDATE bookings SET status = 'to_qualify' WHERE id = $1", [passe]),
      CONTROLE,
    )
    // Le déclencheur vaut pour tout rôle, propriétaire compris.
    await assert.rejects(
      admin.query("UPDATE bookings SET status = 'done' WHERE id = $1", [aVenir]),
      CONTROLE,
    )
    assert.equal((await statut(aVenir)).status, 'confirmed')
    assert.equal((await statut(passe)).status, 'done')
    assert.equal((await statut(annule)).status, 'cancelled_by_guest')
  })

  it('rattachement : une demande existante, remis à nul quand la demande est effacée', async () => {
    const id = await appel(-60)
    const premiere = await demande()
    const seconde = await demande()
    await coffre.query('UPDATE bookings SET request_id = $2 WHERE id = $1', [id, premiere])
    assert.equal((await statut(id)).request_id, premiere)
    await assert.rejects(
      coffre.query('UPDATE bookings SET request_id = $2 WHERE id = $1', [id, randomUUID()]),
      CLE_ETRANGERE,
    )
    await coffre.query('UPDATE bookings SET request_id = NULL WHERE id = $1', [id])
    assert.equal((await statut(id)).request_id, null)

    // Effacement par le coffre (à la main ou par la conservation) : le rattachement tombe, l'appel
    // reste, sans droit supplémentaire du rôle sur `bookings`.
    const autre = await appel(30)
    await coffre.query('UPDATE bookings SET request_id = $2 WHERE id = ANY ($1)', [
      [id, autre],
      seconde,
    ])
    await coffre.query('DELETE FROM vault_requests WHERE id = $1', [seconde])
    assert.equal((await statut(id)).request_id, null)
    assert.equal((await statut(autre)).request_id, null)
    assert.equal((await statut(autre)).status, 'confirmed')
  })

  it('coffre ne modifie que le statut, le rattachement et (3.11) le créneau', async () => {
    await appel(-60)
    for (const sql of [
      // `sealed` : remis à NULL pour un appel annulé seulement, par un déclencheur (D78,
      // conservation.test.ts) : pas un refus de droit ici.
      'UPDATE bookings SET sequence = sequence + 1',
      'UPDATE bookings SET retention_until = now()',
      "UPDATE bookings SET privacy_version = 'v'",
      'UPDATE bookings SET access_token_id = NULL',
      'UPDATE bookings SET created_at = now()',
      'UPDATE bookings SET id = gen_random_uuid()',
      "INSERT INTO bookings (id, starts_at, ends_at, slot, sealed, privacy_version, retention_until) VALUES (gen_random_uuid(), now(), now() + interval '1 hour', tstzrange(now(), now() + interval '1 hour'), '\\x00', 'v', now())",
      'TRUNCATE bookings',
      'UPDATE vault_access_log SET booking_id = NULL',
      'DELETE FROM vault_access_log',
    ]) {
      await assert.rejects(coffre.query(sql), REFUS, sql)
    }
    const { rows } = await coffre.query('SELECT id, request_id, status FROM bookings')
    assert.equal(rows.length, 1)
  })

  it('site_public n’a ni le rattachement, ni le statut, ni le journal (même après la 3.11)', async () => {
    const id = await appel(-60)
    const { rows } = await admin.query<{ privilege: string; permis: boolean }>(
      `SELECT p AS privilege, has_column_privilege('site_public', 'bookings', 'request_id', p) AS permis
       FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) AS p`,
    )
    assert.deepEqual(
      rows.map((row) => [row.privilege, row.permis]),
      [
        ['SELECT', false],
        ['INSERT', false],
        ['UPDATE', false],
        ['REFERENCES', false],
      ],
    )
    for (const sql of [
      'SELECT request_id FROM bookings',
      "UPDATE bookings SET status = 'done'",
      'UPDATE bookings SET request_id = NULL',
      'SELECT booking_id FROM vault_access_log',
      "INSERT INTO vault_access_log (actor, action) VALUES ('x', 'booking_list')",
    ]) {
      await assert.rejects(site.query(sql), REFUS, sql)
    }
    // Une réservation du site public n'a jamais de rattachement.
    await assert.rejects(
      site.query(
        `INSERT INTO bookings (id, starts_at, ends_at, slot, privacy_version, retention_until, sealed,
           request_id)
         VALUES (gen_random_uuid(), now(), now() + interval '30 minutes',
           tstzrange(now(), now() + interval '45 minutes'), 'v', now() + interval '1 year', $1, NULL)`,
        [Buffer.alloc(SCELLE, 1)],
      ),
      REFUS,
    )
    assert.equal((await statut(id)).status, 'confirmed')
  })

  it('le journal accepte les quatre actions de l’agenda, chacune avec sa forme', async () => {
    const id = await appel(-60)
    const rattachee = await demande()
    const ecrire = (action: string, bookingId: string | null, requestId: string | null) =>
      coffre.query(
        'INSERT INTO vault_access_log (actor, action, booking_id, request_id) VALUES ($1, $2, $3, $4)',
        [ACTEUR, action, bookingId, requestId],
      )

    await ecrire('booking_list', null, null)
    await ecrire('booking_read', id, null)
    await ecrire('booking_status', id, null)
    await ecrire('booking_attach', id, rattachee)
    await ecrire('booking_attach', id, null)
    for (const [action, bookingId, requestId] of [
      ['booking_list', id, null],
      ['booking_list', null, rattachee],
      ['booking_read', null, null],
      ['booking_read', id, rattachee],
      ['booking_status', null, null],
      ['booking_status', id, rattachee],
      ['booking_attach', null, rattachee],
      // Aucune autre action ne vise un appel.
      ['read', id, rattachee],
      ['list', id, null],
      ['booking_link', id, null],
      ['availability', id, null],
    ] as const) {
      await assert.rejects(ecrire(action, bookingId, requestId), CONTROLE, action)
    }
    // Les compteurs de la conservation restent interdits sur ces lignes.
    await assert.rejects(
      coffre.query(
        `INSERT INTO vault_access_log (actor, action, booking_id, purged_bookings)
         VALUES ($1, 'booking_read', $2, 1)`,
        [ACTEUR, id],
      ),
      CONTROLE,
    )

    // La liste des actions existantes est reprise telle quelle.
    for (const action of [
      'login',
      'login_backup_code',
      'login_failed',
      'password_ok',
      'totp_enrolled',
      'rate_limited',
      'logout',
      'list',
      'read',
      'export',
      'delete',
      'purge',
      'freeze',
      'unfreeze',
      'availability',
      'booking_link',
    ]) {
      await ecrire(action, null, null)
    }
    await coffre.query(
      `INSERT INTO vault_access_log
         (actor, action, purged_requests, purged_sessions, purged_rate_limits, purged_verifications,
          purged_bookings, purged_tokens, purged_cancelled_calls)
       VALUES ('system', 'retention', 0, 0, 0, 0, 0, 0, 0)`,
    )
    await assert.rejects(ecrire('autre', null, null), CONTROLE)

    // La ligne survit à l'appel (pas de clé étrangère).
    await admin.query('DELETE FROM bookings WHERE id = $1', [id])
    const { rows } = await admin.query(
      "SELECT count(*)::int AS n FROM vault_access_log WHERE booking_id = $1 AND action = 'booking_read'",
      [id],
    )
    assert.equal(rows[0].n, 1)
  })
})
