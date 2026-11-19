import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { inspect } from 'node:util'

import { migrate } from '../../src/lib/db/migrate.ts'
import {
  deleteRequest,
  getRequest,
  insertRequest,
  listAccessLog,
  listRequests,
  listRequestsLogged,
  logAccess,
  logExport,
  lastRetentionRun,
  logRetention,
  purgeExpired,
  readSealed,
  setFrozen,
} from '../../src/lib/vault/repository.ts'
import type {
  AccessAction,
  AccessLogEntry,
  NewVaultRequest,
  RequestKind,
} from '../../src/lib/vault/repository.ts'
import { isExpired } from '../../src/lib/vault/retention.ts'
import { resetDatabase, testPool } from './helpers.ts'

// Données factices uniquement : des octets aléatoires tiennent lieu de sealed box.
const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const ACTOR = 'compte-factice'
const pool = testPool()

function fakeSealed(length = 64): Uint8Array {
  return new Uint8Array(randomBytes(length))
}

function fakeRequest(overrides: Partial<NewVaultRequest> = {}): NewVaultRequest {
  return {
    kind: 'request',
    service: 'conciergerie',
    country: 'BE',
    locale: 'fr',
    urgency: 'aucune',
    source: null,
    sealed: fakeSealed(),
    retentionUntil: new Date('2028-01-01T00:00:00Z'),
    privacyVersion: '2026-11-18',
    ...overrides,
  }
}

function entries(log: AccessLogEntry[]) {
  return log.map(({ actor, action, requestId }) => ({ actor, action, requestId }))
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => assert.fail('une erreur était attendue'),
    (error: unknown) => error,
  )
}

describe('accès aux données du coffre', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
  })
  beforeEach(() => pool.query('TRUNCATE vault_requests, vault_access_log RESTART IDENTITY'))
  after(() => pool.end())

  it('liste les colonnes en clair, du plus récent au plus ancien, sans le contenu chiffré', async () => {
    const first = await insertRequest(pool, fakeRequest())
    const retentionUntil = new Date('2027-11-18T09:15:00Z')
    const second = await insertRequest(
      pool,
      fakeRequest({
        kind: 'urgent',
        service: 'enfants',
        country: null,
        locale: 'en',
        urgency: null,
        source: 'carte',
        retentionUntil,
      }),
    )

    const rows = await listRequests(pool)
    assert.deepEqual(
      rows.map((row) => row.id),
      [second, first],
    )
    const [latest] = rows
    assert.ok(latest)
    assert.equal('sealed' in latest, false)
    assert.ok(latest.createdAt instanceof Date)
    assert.deepEqual(
      { ...latest, id: undefined, createdAt: undefined },
      {
        id: undefined,
        kind: 'urgent',
        createdAt: undefined,
        service: 'enfants',
        country: null,
        locale: 'en',
        urgency: null,
        source: 'carte',
        status: 'new',
        frozen: false,
        retentionUntil,
        privacyVersion: '2026-11-18',
      },
    )
  })

  it('renvoie 50 demandes par défaut, 200 au plus, avec un décalage', async () => {
    await pool.query(
      `INSERT INTO vault_requests (id, kind, locale, retention_until, sealed, privacy_version)
       SELECT gen_random_uuid(), 'request', 'fr', now() + interval '1 year',
              decode(repeat('00', 64), 'hex'), '2026-11-18'
       FROM generate_series(1, 205)`,
    )
    assert.equal((await listRequests(pool)).length, 50)
    assert.equal((await listRequests(pool, { limit: 1000 })).length, 200)
    assert.equal((await listRequests(pool, { limit: 10, offset: 200 })).length, 5)
    await assert.rejects(listRequests(pool, { limit: 0 }), RangeError)
    await assert.rejects(listRequests(pool, { offset: -1 }), RangeError)
  })

  it('journalise la lecture de la liste dans la même transaction (partie C)', async () => {
    const id = await insertRequest(pool, fakeRequest())
    const rows = await listRequestsLogged(pool, ACTOR, { limit: 10 })
    assert.deepEqual(
      rows.map((row) => row.id),
      [id],
    )
    assert.equal('sealed' in (rows[0] ?? {}), false)
    assert.deepEqual(entries(await listAccessLog(pool)), [
      { actor: ACTOR, action: 'list', requestId: null },
    ])
    // Journal impossible (acteur vide) : rien n'est lu.
    await assert.rejects(listRequestsLogged(pool, ''), { code: '23514' })
    assert.equal((await listAccessLog(pool)).length, 1)
  })

  it('n’inscrit qu’une ligne list par affichage, même rendu deux fois en même temps (partie D)', async () => {
    await insertRequest(pool, fakeRequest())
    // Deux rendus simultanés de la même page (Cache Components), puis un troisième aussitôt.
    await Promise.all([listRequestsLogged(pool, ACTOR), listRequestsLogged(pool, ACTOR)])
    await listRequestsLogged(pool, ACTOR)
    // Un autre compte a sa propre ligne.
    await listRequestsLogged(pool, 'autre-compte-factice')
    assert.deepEqual(
      entries(await listAccessLog(pool)).sort((a, b) => a.actor.localeCompare(b.actor)),
      [
        { actor: 'autre-compte-factice', action: 'list', requestId: null },
        { actor: ACTOR, action: 'list', requestId: null },
      ],
    )
    // Au-delà de 2 secondes, un nouvel affichage s'inscrit.
    await pool.query(`UPDATE vault_access_log SET at = at - interval '3 seconds'`)
    await listRequestsLogged(pool, ACTOR)
    const lignes = (await listAccessLog(pool)).filter((entry) => entry.actor === ACTOR)
    assert.equal(lignes.length, 2)
  })

  it('rend la date du dernier passage de la conservation, ou null', async () => {
    assert.equal(await lastRetentionRun(pool), null)
    await logRetention(pool, {
      requests: 0,
      sessions: 0,
      rateLimits: 0,
      verifications: 0,
      bookings: 0,
      tokens: 0,
    })
    await pool.query(`UPDATE vault_access_log SET at = '2026-01-01T03:00:00Z'`)
    await logRetention(pool, {
      requests: 1,
      sessions: 0,
      rateLimits: 0,
      verifications: 0,
      bookings: 0,
      tokens: 0,
    })
    await logAccess(pool, { actor: ACTOR, action: 'login' })
    const dernier = await lastRetentionRun(pool)
    assert.ok(dernier && dernier.getTime() > new Date('2026-01-01T03:00:00Z').getTime())
  })

  it('accepte les actions de connexion de la partie C', async () => {
    for (const action of ['login_failed', 'logout', 'list'] as const) {
      await logAccess(pool, { actor: ACTOR, action })
    }
    assert.deepEqual(
      (await listAccessLog(pool)).map((entry) => entry.action),
      ['list', 'logout', 'login_failed'],
    )
  })

  it('lit les octets exacts et journalise la lecture', async () => {
    const sealed = fakeSealed(49)
    const id = await insertRequest(pool, fakeRequest({ sealed }))
    assert.deepEqual(await readSealed(pool, id, ACTOR), sealed)
    assert.deepEqual(entries(await listAccessLog(pool)), [
      { actor: ACTOR, action: 'read', requestId: id },
    ])
  })

  it('ne rend pas les octets si la lecture ne peut pas être journalisée', async () => {
    const id = await insertRequest(pool, fakeRequest())
    await assert.rejects(readSealed(pool, id, ''), { code: '23514' })
    assert.deepEqual(await listAccessLog(pool), [])
  })

  it('renvoie null pour une demande inconnue, sans journal', async () => {
    assert.equal(await readSealed(pool, randomUUID(), ACTOR), null)
    assert.equal(await readSealed(pool, 'pas-un-identifiant', ACTOR), null)
    assert.deepEqual(await listAccessLog(pool), [])
  })

  it('rend les colonnes en clair d’une demande pour sa page, sans octets ni journal', async () => {
    const id = await insertRequest(pool, fakeRequest({ service: 'enfants' }))
    const demande = await getRequest(pool, id)
    assert.ok(demande)
    assert.equal(demande.id, id)
    assert.equal(demande.service, 'enfants')
    assert.equal(demande.frozen, false)
    assert.ok(!('sealed' in demande))
    assert.deepEqual(demande, (await listRequests(pool))[0])
    // Le rendu de la page n'écrit rien : la lecture journalisée est celle des octets (readSealed).
    assert.deepEqual(await listAccessLog(pool), [])
    assert.equal(await getRequest(pool, randomUUID()), null)
    assert.equal(await getRequest(pool, 'pas-un-identifiant'), null)
  })

  it('journalise un export par son seul identifiant, si la demande existe', async () => {
    const id = await insertRequest(pool, fakeRequest())
    assert.equal(await logExport(pool, id, ACTOR), true)
    assert.equal(await logExport(pool, randomUUID(), ACTOR), false)
    assert.equal(await logExport(pool, 'pas-un-identifiant', ACTOR), false)
    assert.deepEqual(entries(await listAccessLog(pool)), [
      { actor: ACTOR, action: 'export', requestId: id },
    ])
  })

  it('inscrit le résumé de la conservation en nombres seulement, au nom de system', async () => {
    await logRetention(pool, {
      requests: 2,
      sessions: 1,
      rateLimits: 0,
      verifications: 3,
      bookings: 4,
      tokens: 5,
    })
    const { rows } = await pool.query(
      `SELECT actor, action, request_id, purged_requests, purged_sessions, purged_rate_limits,
              purged_verifications, purged_bookings, purged_tokens FROM vault_access_log`,
    )
    assert.deepEqual(rows, [
      {
        actor: 'system',
        action: 'retention',
        request_id: null,
        purged_requests: 2,
        purged_sessions: 1,
        purged_rate_limits: 0,
        purged_verifications: 3,
        purged_bookings: 4,
        purged_tokens: 5,
      },
    ])
    for (const counts of [
      { requests: -1, sessions: 0, rateLimits: 0, verifications: 0, bookings: 0, tokens: 0 },
      { requests: 0.5, sessions: 0, rateLimits: 0, verifications: 0, bookings: 0, tokens: 0 },
      { requests: 0, sessions: 0, rateLimits: 0, verifications: 0, bookings: -2, tokens: 0 },
    ]) {
      await assert.rejects(logRetention(pool, counts), RangeError)
    }
    // La base le garantit aussi : compteurs obligatoires sur `retention`, interdits ailleurs.
    const refused = { code: '23514' }
    await assert.rejects(
      pool.query(`INSERT INTO vault_access_log (actor, action) VALUES ('system', 'retention')`),
      refused,
    )
    await assert.rejects(
      pool.query(
        `INSERT INTO vault_access_log (actor, action, purged_requests) VALUES ('x', 'read', 1)`,
      ),
      refused,
    )
    // Depuis 0010 : les deux compteurs de la réservation sont exigés aussi, et interdits ailleurs.
    await assert.rejects(
      pool.query(
        `INSERT INTO vault_access_log (actor, action, purged_requests, purged_sessions,
           purged_rate_limits, purged_verifications)
         VALUES ('system', 'retention', 0, 0, 0, 0)`,
      ),
      refused,
    )
    await assert.rejects(
      pool.query(
        `INSERT INTO vault_access_log (actor, action, purged_tokens) VALUES ('x', 'read', 1)`,
      ),
      refused,
    )
    await assert.rejects(
      pool.query(
        `INSERT INTO vault_access_log (actor, action, request_id, purged_requests, purged_sessions,
           purged_rate_limits, purged_verifications)
         VALUES ('system', 'retention', gen_random_uuid(), 0, 0, 0, 0)`,
      ),
      refused,
    )
    await assert.rejects(
      pool.query(
        `INSERT INTO vault_access_log (actor, action, purged_requests, purged_sessions,
           purged_rate_limits, purged_verifications)
         VALUES ('system', 'retention', -1, 0, 0, 0)`,
      ),
      refused,
    )
    assert.equal((await listAccessLog(pool)).length, 1)
  })

  it('efface une demande et garde sa ligne de journal', async () => {
    const id = await insertRequest(pool, fakeRequest())
    assert.equal(await deleteRequest(pool, id, ACTOR), true)
    assert.deepEqual(await listRequests(pool), [])
    assert.deepEqual(entries(await listAccessLog(pool, { requestId: id })), [
      { actor: ACTOR, action: 'delete', requestId: id },
    ])

    assert.equal(await deleteRequest(pool, id, ACTOR), false)
    assert.equal(await deleteRequest(pool, randomUUID(), ACTOR), false)
    assert.equal((await listAccessLog(pool)).length, 1)
  })

  it('n’a aucune clé étrangère sur le journal d’accès', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint
       WHERE conrelid = 'vault_access_log'::regclass AND contype = 'f'`,
    )
    assert.equal(rows[0]?.n, 0)
  })

  it('gèle et dégèle une demande, en journalisant chaque changement', async () => {
    const id = await insertRequest(pool, fakeRequest())
    assert.equal(await setFrozen(pool, id, true, ACTOR), true)
    assert.equal((await listRequests(pool))[0]?.frozen, true)
    assert.equal(await setFrozen(pool, id, false, ACTOR), true)
    assert.equal((await listRequests(pool))[0]?.frozen, false)
    assert.equal(await setFrozen(pool, randomUUID(), true, ACTOR), false)
    assert.deepEqual(entries(await listAccessLog(pool)), [
      { actor: ACTOR, action: 'unfreeze', requestId: id },
      { actor: ACTOR, action: 'freeze', requestId: id },
    ])
  })

  it('purge les demandes échues non gelées, au nom de system', async () => {
    const now = new Date('2027-06-01T00:00:00Z')
    const expired = await insertRequest(
      pool,
      fakeRequest({ retentionUntil: new Date('2027-01-01T00:00:00Z') }),
    )
    const dueNow = await insertRequest(pool, fakeRequest({ retentionUntil: now }))
    const frozen = await insertRequest(
      pool,
      fakeRequest({ retentionUntil: new Date('2027-01-01T00:00:00Z') }),
    )
    await setFrozen(pool, frozen, true, ACTOR)
    const pending = await insertRequest(
      pool,
      fakeRequest({ retentionUntil: new Date('2028-01-01T00:00:00Z') }),
    )

    assert.deepEqual((await purgeExpired(pool, now)).sort(), [expired, dueNow].sort())
    assert.deepEqual(
      (await listRequests(pool)).map((row) => row.id).sort(),
      [frozen, pending].sort(),
    )
    const purges = entries(await listAccessLog(pool)).filter((entry) => entry.action === 'purge')
    assert.deepEqual(
      purges.sort((a, b) => String(a.requestId).localeCompare(String(b.requestId))),
      [expired, dueNow]
        .sort()
        .map((requestId) => ({ actor: 'system', action: 'purge', requestId })),
    )
    assert.deepEqual(await purgeExpired(pool, now), [])
  })

  it('purge exactement les demandes que isExpired désigne : jamais une gelée', async () => {
    const now = new Date('2027-06-01T12:00:00Z')
    const cas = [
      { retentionUntil: new Date('2026-12-01T00:00:00Z'), frozen: false },
      { retentionUntil: new Date('2026-12-01T00:00:00Z'), frozen: true },
      { retentionUntil: now, frozen: false },
      { retentionUntil: now, frozen: true },
      { retentionUntil: new Date(now.getTime() + 1), frozen: false },
      { retentionUntil: new Date('2028-01-01T00:00:00Z'), frozen: true },
    ]
    const ids: string[] = []
    for (const { retentionUntil, frozen } of cas) {
      const id = await insertRequest(pool, fakeRequest({ retentionUntil }))
      if (frozen) await setFrozen(pool, id, true, ACTOR)
      ids.push(id)
    }
    const attendues = ids.filter((_, index) => isExpired(cas[index]!, now))
    assert.equal(attendues.length, 2)
    assert.deepEqual((await purgeExpired(pool, now)).sort(), attendues.sort())
    const restantes = await listRequests(pool)
    assert.equal(restantes.length, 4)
    for (const demande of restantes) assert.equal(isExpired(demande, now), false)
  })

  it('journalise une connexion sans demande, du plus récent au plus ancien', async () => {
    const id = await insertRequest(pool, fakeRequest())
    await logAccess(pool, { actor: ACTOR, action: 'login' })
    await logAccess(pool, { actor: ACTOR, action: 'export', requestId: id })
    assert.deepEqual(entries(await listAccessLog(pool)), [
      { actor: ACTOR, action: 'export', requestId: id },
      { actor: ACTOR, action: 'login', requestId: null },
    ])
    assert.equal((await listAccessLog(pool, { limit: 1 })).length, 1)
    assert.deepEqual(await listAccessLog(pool, { requestId: randomUUID() }), [])
  })

  it('refuse un contenu trop court, un type, une langue ou une action inconnus', async () => {
    const refused = { code: '23514' }
    await assert.rejects(insertRequest(pool, fakeRequest({ sealed: fakeSealed(48) })), refused)
    await assert.rejects(
      insertRequest(pool, fakeRequest({ kind: 'autre' as RequestKind })),
      refused,
    )
    await assert.rejects(
      insertRequest(pool, fakeRequest({ locale: 'de' as NewVaultRequest['locale'] })),
      refused,
    )
    await assert.rejects(
      logAccess(pool, { actor: ACTOR, action: 'inconnue' as AccessAction }),
      refused,
    )
    assert.deepEqual(await listRequests(pool), [])
  })

  it('exige la version de la politique de confidentialité acceptée (preuve du consentement)', async () => {
    await assert.rejects(
      pool.query(
        `INSERT INTO vault_requests (id, kind, locale, retention_until, sealed)
         VALUES (gen_random_uuid(), 'request', 'fr', now(), decode(repeat('00', 64), 'hex'))`,
      ),
      { code: '23502' },
    )
    await assert.rejects(insertRequest(pool, fakeRequest({ privacyVersion: '' })), {
      code: '23514',
    })
    assert.deepEqual(await listRequests(pool), [])
  })

  it('ne met ni octets chiffrés ni argument dans les erreurs', async () => {
    const marker = 'valeur-factice-temoin'
    const id = await insertRequest(pool, fakeRequest())
    const errors = [
      await rejection(
        insertRequest(
          pool,
          fakeRequest({ sealed: new Uint8Array(48).fill(0xab), service: marker }),
        ),
      ),
      await rejection(readSealed(pool, id, marker.repeat(10))),
      await rejection(logAccess(pool, { actor: marker, action: marker as AccessAction })),
      await rejection(logAccess(pool, { actor: ACTOR, action: 'read', requestId: marker })),
    ]
    for (const error of errors) {
      const text = `${String(error)} ${inspect(error, { depth: Infinity, showHidden: true })}`
      assert.equal(text.includes(marker), false, 'un argument apparaît dans l’erreur')
      assert.equal(text.includes('abab'), false, 'des octets chiffrés apparaissent dans l’erreur')
      assert.equal((error as Error).cause, undefined, 'l’erreur d’origine est chaînée')
    }
  })
})
