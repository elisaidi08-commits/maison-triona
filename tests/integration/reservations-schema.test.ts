import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { migrate } from '../../src/lib/db/migrate.ts'
import { applyRoles, coffrePool, resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Tables de la réservation d'appel (story 3.10, db/migrations/0008_reservations.sql) : contrainte
// d'exclusion sur les créneaux confirmés, contrôles de la base, droits des deux rôles (`site_public` :
// disponibilités en lecture, créneau et statut des réservations, jetons à vérifier et consommer,
// insertion d'une réservation ; `coffre` : lecture des réservations, création d'un lien), nouvelle
// action `booking_link` au journal.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const REFUS = { code: '42501' }
const CONTROLE = { code: '23514' }
const EXCLUSION = { code: '23P01' }
const UNIQUE = { code: '23505' }
const SCELLE = 2048 + 48
const admin = testPool()
const coffre = coffrePool()
const site = new pg.Pool({
  connectionString: TEST_DATABASE_URL,
  options: '-c role=site_public',
  max: 2,
})

const octets = (taille: number, valeur = 7) => Buffer.alloc(taille, valeur)

// Jeton factice (empreinte de 32 octets), créé maintenant, valable 48 heures.
async function jeton(options: { hmac?: Buffer | null } = {}): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO booking_tokens (id, token_hash, purpose, email_hmac, created_at, expires_at)
     VALUES ($1, $2, 'access', $3, now(), now() + interval '48 hours')`,
    [id, octets(32, Math.floor(Math.random() * 255)), options.hmac ?? null],
  )
  return id
}

// Réservation : [début, fin + pause), comme la page publique l'écrit.
async function reserver(
  db: pg.Pool,
  debut: string,
  fin: string,
  occupe: string,
  options: { statut?: string; jetonId?: string | null } = {},
): Promise<string> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO bookings
       (id, access_token_id, starts_at, ends_at, slot, privacy_version, retention_until, sealed${
         options.statut ? ', status' : ''
       })
     VALUES ($1, $2, $3, $4, tstzrange($3, $5), '2026-11-18', $3::timestamptz + interval '1 year', $6${
       options.statut ? ', $7' : ''
     })`,
    [
      id,
      options.jetonId ?? null,
      debut,
      fin,
      occupe,
      octets(SCELLE),
      ...(options.statut ? [options.statut] : []),
    ],
  )
  return id
}

describe('tables de la réservation d’appel', () => {
  before(async () => {
    await resetDatabase(admin)
    await migrate(admin, MIGRATIONS)
    await applyRoles(admin)
  })
  after(async () => {
    await site.end()
    await coffre.end()
    await admin.end()
  })

  it('n’a pas besoin de btree_gist : la contrainte d’exclusion porte sur un seul tstzrange', async () => {
    const { rows } = await admin.query(
      `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`,
    )
    assert.equal(rows.length, 0)
    const { rows: contraintes } = await admin.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'bookings'::regclass AND contype = 'x'`,
    )
    assert.equal(contraintes.length, 1)
    assert.match(
      contraintes[0].def,
      // Depuis 0013 (agenda), les appels qualifiés gardent aussi leur plage.
      /EXCLUDE USING gist \(slot WITH &&\) WHERE \(\(status = ANY \(ARRAY\['confirmed'::text, 'done'::text, 'no_answer'::text\]\)\)\)/,
    )
  })

  it('refuse deux appels confirmés qui se chevauchent, pause comprise', async () => {
    await reserver(admin, '2027-03-02T09:30Z', '2027-03-02T10:00Z', '2027-03-02T10:15Z')
    // Commence pendant la pause du premier.
    await assert.rejects(
      reserver(admin, '2027-03-02T10:10Z', '2027-03-02T10:40Z', '2027-03-02T10:55Z'),
      EXCLUSION,
    )
    // Même créneau exactement.
    await assert.rejects(
      reserver(admin, '2027-03-02T09:30Z', '2027-03-02T10:00Z', '2027-03-02T10:15Z'),
      EXCLUSION,
    )
    // Accolé à la fin de la pause : accepté (plage semi-ouverte [début, fin + pause)).
    await reserver(admin, '2027-03-02T10:15Z', '2027-03-02T10:45Z', '2027-03-02T11:00Z')
    // Un appel annulé ne bloque rien.
    await reserver(admin, '2027-03-02T12:00Z', '2027-03-02T12:30Z', '2027-03-02T12:45Z', {
      statut: 'cancelled_by_guest',
    })
    await reserver(admin, '2027-03-02T12:00Z', '2027-03-02T12:30Z', '2027-03-02T12:45Z')
    await admin.query('DELETE FROM bookings')
  })

  it('refuse un créneau incohérent, un scellé d’une autre taille, un statut inconnu', async () => {
    const id = () => randomUUID()
    const valeurs = (
      debut: string,
      fin: string,
      plage: string,
      scelle: Buffer,
      statut = 'confirmed',
    ) => [id(), debut, fin, plage, scelle, statut]
    const sql = `INSERT INTO bookings
      (id, starts_at, ends_at, slot, sealed, status, privacy_version, retention_until)
      VALUES ($1, $2, $3, $4::tstzrange, $5, $6, '2026-11-18', '2028-01-01')`
    for (const [cas, params] of [
      [
        'fin avant le début',
        valeurs(
          '2027-03-02T10:00Z',
          '2027-03-02T09:30Z',
          '[2027-03-02T10:00Z,2027-03-02T10:15Z)',
          octets(SCELLE),
        ),
      ],
      [
        'plage qui ne part pas du début',
        valeurs(
          '2027-03-02T09:30Z',
          '2027-03-02T10:00Z',
          '[2027-03-02T09:00Z,2027-03-02T10:15Z)',
          octets(SCELLE),
        ),
      ],
      [
        'plage plus courte que l’appel',
        valeurs(
          '2027-03-02T09:30Z',
          '2027-03-02T10:00Z',
          '[2027-03-02T09:30Z,2027-03-02T09:45Z)',
          octets(SCELLE),
        ),
      ],
      [
        'plage sans fin',
        valeurs('2027-03-02T09:30Z', '2027-03-02T10:00Z', '[2027-03-02T09:30Z,)', octets(SCELLE)),
      ],
      [
        'plage fermée à droite',
        valeurs(
          '2027-03-02T09:30Z',
          '2027-03-02T10:00Z',
          '[2027-03-02T09:30Z,2027-03-02T10:15Z]',
          octets(SCELLE),
        ),
      ],
      [
        'scellé trop court',
        valeurs(
          '2027-03-02T09:30Z',
          '2027-03-02T10:00Z',
          '[2027-03-02T09:30Z,2027-03-02T10:15Z)',
          octets(SCELLE - 1),
        ),
      ],
      [
        'scellé trop long',
        valeurs(
          '2027-03-02T09:30Z',
          '2027-03-02T10:00Z',
          '[2027-03-02T09:30Z,2027-03-02T10:15Z)',
          octets(SCELLE + 1),
        ),
      ],
      [
        'statut inconnu',
        valeurs(
          '2027-03-02T09:30Z',
          '2027-03-02T10:00Z',
          '[2027-03-02T09:30Z,2027-03-02T10:15Z)',
          octets(SCELLE),
          'pending',
        ),
      ],
    ] as const) {
      await assert.rejects(admin.query(sql, [...params]), CONTROLE, cas)
    }
  })

  it('un jeton ne sert qu’à une réservation (contrainte d’unicité)', async () => {
    const jetonId = await jeton()
    await reserver(admin, '2027-03-03T09:30Z', '2027-03-03T10:00Z', '2027-03-03T10:15Z', {
      jetonId,
    })
    await assert.rejects(
      reserver(admin, '2027-03-04T09:30Z', '2027-03-04T10:00Z', '2027-03-04T10:15Z', { jetonId }),
      UNIQUE,
    )
    await admin.query('DELETE FROM bookings')
    await admin.query('DELETE FROM booking_tokens')
  })

  it('jetons : empreinte de 32 octets, 48 heures au plus, un seul lien vivant par adresse', async () => {
    const sql = `INSERT INTO booking_tokens (id, token_hash, purpose, created_at, expires_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4)`
    for (const [cas, params] of [
      ['empreinte courte', [octets(31), 'access', '2027-03-01T08:00Z', '2027-03-02T08:00Z']],
      ['empreinte longue', [octets(33), 'access', '2027-03-01T08:00Z', '2027-03-02T08:00Z']],
      ['plus de 48 heures', [octets(32), 'access', '2027-03-01T08:00Z', '2027-03-03T08:01Z']],
      [
        'expire avant sa création',
        [octets(32), 'access', '2027-03-01T08:00Z', '2027-03-01T07:00Z'],
      ],
      ['usage inconnu', [octets(32), 'autre', '2027-03-01T08:00Z', '2027-03-02T08:00Z']],
    ] as const) {
      await assert.rejects(admin.query(sql, [...params]), CONTROLE, cas)
    }
    await admin.query(sql, [octets(32, 1), 'access', '2027-03-01T08:00Z', '2027-03-03T08:00Z'])
    await assert.rejects(
      admin.query(sql, [octets(32, 1), 'access', '2027-03-01T08:00Z', '2027-03-03T08:00Z']),
      UNIQUE,
    )

    // Même adresse : un second lien vivant est refusé tant que le premier n'est pas annulé ou utilisé.
    const hmac = octets(32, 9)
    const premier = await jeton({ hmac })
    await assert.rejects(jeton({ hmac }), UNIQUE)
    await admin.query('UPDATE booking_tokens SET revoked_at = now() WHERE id = $1', [premier])
    await jeton({ hmac })
    await assert.rejects(
      admin.query(`UPDATE booking_tokens SET email_hmac = $1 WHERE email_hmac IS NULL`, [
        octets(31),
      ]),
      CONTROLE,
    )
    await admin.query('DELETE FROM booking_tokens')
  })

  it('un jeton ne se consomme qu’une fois, et seulement par une réservation (0010)', async () => {
    const jetonId = await jeton()
    const consommer = (db: pg.Pool, valeur = 'now()') =>
      db.query(`UPDATE booking_tokens SET used_at = ${valeur} WHERE id = $1`, [jetonId])
    // Sans réservation qui pointe vers lui : refusé, sous le rôle du site comme ailleurs.
    await assert.rejects(consommer(site), CONTROLE)
    await assert.rejects(consommer(site, 'NULL'), CONTROLE)
    await assert.rejects(consommer(admin), CONTROLE)
    await reserver(admin, '2027-03-09T09:30Z', '2027-03-09T10:00Z', '2027-03-09T10:15Z', {
      jetonId,
    })
    await consommer(site)
    // Déjà utilisé : ni une seconde date, ni un retour à zéro, même pour l'administrateur.
    await assert.rejects(consommer(site), CONTROLE)
    await assert.rejects(consommer(site, 'NULL'), CONTROLE)
    await assert.rejects(consommer(admin), CONTROLE)
    await assert.rejects(consommer(site), (erreur: Error) => !/\d/.test(erreur.message))
    // Les autres colonnes ne déclenchent rien.
    await admin.query('UPDATE booking_tokens SET revoked_at = now() WHERE id = $1', [jetonId])
    await admin.query('DELETE FROM bookings')
    await admin.query('DELETE FROM booking_tokens')
  })

  it('site_public lit les disponibilités, le créneau et le statut, jamais le scellé', async () => {
    const jetonId = await jeton()
    await reserver(admin, '2027-03-05T09:30Z', '2027-03-05T10:00Z', '2027-03-05T10:15Z', {
      jetonId,
    })

    for (const table of ['booking_settings', 'availability_rules', 'availability_exceptions']) {
      await site.query(`SELECT * FROM ${table}`)
    }
    const { rows } = await site.query(
      `SELECT id, access_token_id, starts_at, ends_at, lower(slot) AS debut, upper(slot) AS fin, status
       FROM bookings WHERE status = 'confirmed' AND slot && tstzrange($1, $2)`,
      ['2027-03-05T00:00Z', '2027-03-06T00:00Z'],
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0].access_token_id, jetonId)

    for (const sql of [
      'SELECT * FROM bookings',
      'SELECT sealed FROM bookings',
      'SELECT privacy_version FROM bookings',
      'SELECT created_at FROM bookings',
      'SELECT retention_until FROM bookings',
      "UPDATE bookings SET status = 'cancelled_by_house'",
      'UPDATE bookings SET sealed = sealed',
      'DELETE FROM bookings',
      'TRUNCATE bookings',
      'SELECT * FROM booking_tokens',
      'SELECT email_hmac FROM booking_tokens',
      'UPDATE booking_tokens SET revoked_at = now()',
      'UPDATE booking_tokens SET expires_at = now()',
      // Depuis la story 3.9, la création d'un lien est permise, jamais avec `used_at` ni `revoked_at`.
      "INSERT INTO booking_tokens (id, token_hash, expires_at, used_at) VALUES (gen_random_uuid(), '\\x00', now(), now())",
      "INSERT INTO booking_tokens (id, token_hash, expires_at, revoked_at) VALUES (gen_random_uuid(), '\\x00', now(), now())",
      'DELETE FROM booking_tokens',
      'UPDATE booking_settings SET daily_cap = 12',
      'DELETE FROM availability_exceptions',
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (6, '10:00', '11:00')",
      'SELECT * FROM vault_access_log',
      'SELECT * FROM vault_requests',
    ]) {
      await assert.rejects(site.query(sql), REFUS, sql)
    }

    // Vérifier un jeton, le consommer (verrou de ligne), insérer une réservation : permis.
    const client = await site.connect()
    try {
      await client.query('BEGIN')
      // Depuis la story 3.11, par la fonction de la base (le site public ne lit plus l'empreinte).
      const { rows: empreinte } = await admin.query(
        'SELECT token_hash FROM booking_tokens WHERE id = $1',
        [jetonId],
      )
      const { rows: jetons } = await client.query(
        'SELECT id, purpose, expires_at, used_at, revoked_at FROM lock_booking_token($1)',
        [empreinte[0].token_hash],
      )
      assert.equal(jetons.length, 1)
      await client.query('UPDATE booking_tokens SET used_at = now() WHERE id = $1', [jetonId])
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
    await reserver(site, '2027-03-05T10:15Z', '2027-03-05T10:45Z', '2027-03-05T11:00Z')
    // Le statut n'est pas à sa main : toujours « confirmé » par défaut.
    await assert.rejects(
      reserver(site, '2027-03-05T12:00Z', '2027-03-05T12:30Z', '2027-03-05T12:45Z', {
        statut: 'cancelled_by_house',
      }),
      REFUS,
    )
    await admin.query('DELETE FROM bookings')
    await admin.query('DELETE FROM booking_tokens')
  })

  it('coffre lit les réservations, crée un lien, efface pour la conservation, sans rien de plus', async () => {
    await reserver(admin, '2027-03-08T09:30Z', '2027-03-08T10:00Z', '2027-03-08T10:15Z')
    const { rows } = await coffre.query('SELECT id, sealed, status, privacy_version FROM bookings')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].sealed.length, SCELLE)
    await coffre.query(
      `INSERT INTO booking_tokens (id, token_hash, purpose, created_at, expires_at)
       VALUES (gen_random_uuid(), $1, 'access', now(), now() + interval '48 hours')`,
      [octets(32, 3)],
    )
    for (const sql of [
      "INSERT INTO bookings (id, starts_at, ends_at, slot, sealed, privacy_version, retention_until) VALUES (gen_random_uuid(), now(), now() + interval '1 hour', tstzrange(now(), now() + interval '1 hour'), '\\x00', 'v', now())",
      // Statut et rattachement : agenda de la story 3.13 (agenda-schema.test.ts) ; créneau : story
      // 3.11 (gestion.test.ts) ; rien d'autre.
      'UPDATE bookings SET sequence = sequence',
      'UPDATE bookings SET sealed = sealed',
      'UPDATE bookings SET retention_until = now()',
      'TRUNCATE bookings',
      'SELECT * FROM booking_tokens',
      'SELECT token_hash FROM booking_tokens',
      'SELECT used_at FROM booking_tokens',
      'UPDATE booking_tokens SET used_at = now()',
      'TRUNCATE booking_tokens',
    ]) {
      await assert.rejects(coffre.query(sql), REFUS, sql)
    }
    // Conservation planifiée (0010) : effacer, avec la seule lecture de l'identifiant et de
    // l'expiration des jetons.
    await coffre.query('DELETE FROM bookings WHERE retention_until <= now()')
    await coffre.query('DELETE FROM booking_tokens WHERE expires_at <= now()')
    await coffre.query('SELECT id, expires_at FROM booking_tokens')
    await admin.query('DELETE FROM bookings')
    await admin.query('DELETE FROM booking_tokens')
  })

  it('le journal accepte `booking_link`, sans demande visée, et garde les actions existantes', async () => {
    await coffre.query(
      "INSERT INTO vault_access_log (actor, action) VALUES ('u1@exemple.test', 'booking_link')",
    )
    await assert.rejects(
      coffre.query(
        `INSERT INTO vault_access_log (actor, action, request_id)
         VALUES ('u1@exemple.test', 'booking_link', gen_random_uuid())`,
      ),
      CONTROLE,
    )
    await assert.rejects(
      coffre.query(
        `INSERT INTO vault_access_log (actor, action, purged_requests)
         VALUES ('u1@exemple.test', 'booking_link', 1)`,
      ),
      CONTROLE,
    )
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
    ]) {
      await coffre.query(
        'INSERT INTO vault_access_log (actor, action, request_id) VALUES ($1, $2, NULL)',
        ['u1@exemple.test', action],
      )
    }
    await assert.rejects(
      coffre.query(
        "INSERT INTO vault_access_log (actor, action) VALUES ('u1@exemple.test', 'autre')",
      ),
      CONTROLE,
    )
  })
})
