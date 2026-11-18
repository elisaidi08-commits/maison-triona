import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { migrate } from '../../src/lib/db/migrate.ts'
import { handleRetention, runRetention } from '../../src/lib/vault/conservation.ts'
import { insertRequest, setFrozen } from '../../src/lib/vault/repository.ts'
import type { NewVaultRequest } from '../../src/lib/vault/repository.ts'
import { applyRoles, coffrePool, resetDatabase, testPool } from './helpers.ts'

// Conservation planifiée (story 3.2, partie D), sous le rôle `coffre`, comme en production : la
// tâche efface les demandes échues non gelées, purge sessions, compteurs de débit et défis échus,
// inscrit un résumé en nombres, et refuse tout appel sans le secret. Données factices.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const SECRET = 'secret-factice-de-la-tache-0123456789abcdef'
const ENV = { CRON_SECRET: SECRET }
const MAINTENANT = new Date('2027-06-01T03:00:00Z')
const admin = testPool()
const coffre = coffrePool()

function demande(overrides: Partial<NewVaultRequest> = {}): NewVaultRequest {
  return {
    kind: 'request',
    service: 'grand-age',
    country: 'BE',
    locale: 'fr',
    urgency: 'aucune',
    source: null,
    sealed: new Uint8Array(randomBytes(64)),
    retentionUntil: new Date('2028-01-01T00:00:00Z'),
    privacyVersion: '2026-11-18',
    ...overrides,
  }
}

function requete(entetes: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cron/retention', { headers: entetes })
}

async function compter(table: string): Promise<number> {
  const { rows } = await admin.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)
  return rows[0]?.n ?? 0
}

// Un compte, une session active, une session échue, une session inactive ; deux compteurs de débit
// (un récent, un périmé) ; deux défis (un en cours, un expiré).
async function authentification(): Promise<void> {
  const instant = MAINTENANT.getTime()
  await admin.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('u1', 'Compte factice', 'u1@exemple.test', false)`,
  )
  await admin.query(
    `INSERT INTO "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId", "twoFactorVerified") VALUES
       ('active', $1, 't-active', $2, $2, 'u1', true),
       ('echue', $3, 't-echue', $3, $3, 'u1', true),
       ('inactive', $1, 't-inactive', $4, $4, 'u1', true)`,
    [
      new Date(instant + 60 * 60_000),
      new Date(instant - 60_000),
      new Date(instant - 9 * 60 * 60_000),
      new Date(instant - 16 * 60_000),
    ],
  )
  await admin.query(
    `INSERT INTO "rateLimit" (id, key, count, "lastRequest") VALUES
       ('recent', '203.0.113.1|/sign-in/email', 1, $1),
       ('perime', '203.0.113.2|/sign-in/email', 1, $2)`,
    [instant - 60_000, instant - 16 * 60_000],
  )
  await admin.query(
    `INSERT INTO "verification" (id, identifier, value, "expiresAt") VALUES
       ('encours', 'defi-1', 'u1', $1),
       ('expire', 'defi-2', 'u1', $2)`,
    [new Date(instant + 60_000), new Date(instant - 60_000)],
  )
}

describe('conservation planifiée du coffre', () => {
  before(async () => {
    await resetDatabase(admin)
    await migrate(admin, MIGRATIONS)
    await applyRoles(admin)
  })
  beforeEach(() =>
    admin.query(
      'TRUNCATE "user", "verification", "rateLimit", vault_access_log, vault_requests RESTART IDENTITY CASCADE',
    ),
  )
  after(async () => {
    await coffre.end()
    await admin.end()
  })

  it('efface les échues, garde les gelées, purge sessions, débit et défis, résume en nombres', async () => {
    await authentification()
    const echue = await insertRequest(
      admin,
      demande({ retentionUntil: new Date('2027-01-01T00:00:00Z') }),
    )
    const gelee = await insertRequest(
      admin,
      demande({ retentionUntil: new Date('2027-01-01T00:00:00Z') }),
    )
    await setFrozen(coffre, gelee, true, 'u1@exemple.test')
    const enCours = await insertRequest(admin, demande())

    assert.deepEqual(await runRetention(coffre, MAINTENANT), {
      requests: 1,
      sessions: 2,
      rateLimits: 1,
      verifications: 1,
    })

    const { rows: restantes } = await admin.query<{ id: string }>(
      'SELECT id FROM vault_requests ORDER BY id',
    )
    assert.deepEqual(restantes.map((row) => row.id).sort(), [gelee, enCours].sort())
    const { rows: sessions } = await admin.query<{ id: string }>('SELECT id FROM "session"')
    assert.deepEqual(sessions, [{ id: 'active' }])
    const { rows: limites } = await admin.query<{ id: string }>('SELECT id FROM "rateLimit"')
    assert.deepEqual(limites, [{ id: 'recent' }])
    const { rows: defis } = await admin.query<{ id: string }>('SELECT id FROM "verification"')
    assert.deepEqual(defis, [{ id: 'encours' }])

    const { rows: journal } = await admin.query(
      `SELECT actor, action, request_id, purged_requests, purged_sessions, purged_rate_limits,
              purged_verifications FROM vault_access_log WHERE actor = 'system' ORDER BY id`,
    )
    assert.deepEqual(journal, [
      {
        actor: 'system',
        action: 'purge',
        request_id: echue,
        purged_requests: null,
        purged_sessions: null,
        purged_rate_limits: null,
        purged_verifications: null,
      },
      {
        actor: 'system',
        action: 'retention',
        request_id: null,
        purged_requests: 1,
        purged_sessions: 2,
        purged_rate_limits: 1,
        purged_verifications: 1,
      },
    ])
  })

  it('est rejouable : un second passage, même simultané, n’efface rien de plus', async () => {
    await insertRequest(admin, demande({ retentionUntil: new Date('2027-01-01T00:00:00Z') }))
    const [premier, second] = await Promise.all([
      runRetention(coffre, MAINTENANT),
      runRetention(coffre, MAINTENANT),
    ])
    assert.deepEqual(
      [premier.requests, second.requests].sort(),
      [0, 1],
      'une seule passe efface la demande',
    )
    assert.equal(await compter('vault_requests'), 0)
    const { rows } = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM vault_access_log WHERE action = 'retention'`,
    )
    assert.equal(rows[0]?.n, 2)
  })

  it('refuse sans secret, sans en-tête ou avec un autre secret, sans ouvrir la base', async () => {
    await insertRequest(admin, demande({ retentionUntil: new Date('2027-01-01T00:00:00Z') }))
    let ouvertures = 0
    const pool = () => {
      ouvertures += 1
      return coffre
    }
    const cas: [Record<string, string | undefined>, Record<string, string>][] = [
      [{}, { authorization: `Bearer ${SECRET}` }],
      [{ CRON_SECRET: '' }, { authorization: 'Bearer ' }],
      [ENV, {}],
      [ENV, { authorization: `Bearer ${SECRET}-autre` }],
      [ENV, { authorization: SECRET }],
      [{ CRON_SECRET: 'court' }, { authorization: 'Bearer court' }],
    ]
    for (const [env, entetes] of cas) {
      const reponse = await handleRetention(requete(entetes), { env, pool, now: () => MAINTENANT })
      assert.equal(reponse.status, 401, JSON.stringify(entetes))
      assert.equal(reponse.headers.get('cache-control'), 'no-store')
      assert.equal(await reponse.text(), 'Unauthorized')
    }
    assert.equal(ouvertures, 0)
    assert.equal(await compter('vault_requests'), 1)
    assert.equal(await compter('vault_access_log'), 0)
  })

  it('avec le bon secret : 200 et le résumé en nombres seulement', async () => {
    await insertRequest(admin, demande({ retentionUntil: new Date('2027-01-01T00:00:00Z') }))
    const reponse = await handleRetention(requete({ authorization: `Bearer ${SECRET}` }), {
      env: ENV,
      pool: () => coffre,
      now: () => MAINTENANT,
    })
    assert.equal(reponse.status, 200)
    assert.equal(reponse.headers.get('cache-control'), 'no-store')
    const corps = (await reponse.json()) as Record<string, unknown>
    assert.deepEqual(corps, { requests: 1, sessions: 0, rateLimits: 0, verifications: 0 })
    for (const valeur of Object.values(corps)) assert.equal(typeof valeur, 'number')
  })

  it('base injoignable : 500 sans détail, le journal du serveur ne reçoit qu’un statut', async () => {
    const erreurs: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => {
      erreurs.push(args.map(String).join(' '))
    }
    try {
      const reponse = await handleRetention(requete({ authorization: `Bearer ${SECRET}` }), {
        env: ENV,
        pool: () => {
          throw new Error('COFFRE_DATABASE_URL manquante')
        },
        now: () => MAINTENANT,
      })
      assert.equal(reponse.status, 500)
      assert.equal(await reponse.text(), 'Internal Server Error')
    } finally {
      console.error = original
    }
    assert.deepEqual(erreurs, ['[conservation] failed:retention'])
  })
})
