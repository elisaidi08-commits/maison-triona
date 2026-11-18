import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import type { Pool, PoolClient } from 'pg'

import { migrate } from '../../src/lib/db/migrate.ts'
import { withTransaction } from '../../src/lib/db/transaction.ts'
import {
  claimDue,
  claimOne,
  enqueueNotification,
  listAccepted,
  markAccepted,
  markFailed,
  markRetry,
  purgeOutbox,
  recordDelivery,
} from '../../src/lib/outbox/repository.ts'
import { VaultError } from '../../src/lib/vault/repository.ts'
import { applyRoles, resetDatabase, testPool } from './helpers.ts'

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const pool = testPool()

after(async () => {
  await pool.end()
})

describe('boîte d’envoi : schéma', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
  })

  it('accepte une notification de demande et une alerte technique valides', async () => {
    await pool.query(
      "INSERT INTO outbox (id, template, request_id) VALUES ($1, 'request_notification', $2)",
      [randomUUID(), randomUUID()],
    )
    await pool.query(
      `INSERT INTO outbox (id, template, alert_event, alert_subject)
       VALUES ($1, 'technical_alert', 'send_failed', $2)`,
      [randomUUID(), randomUUID()],
    )
  })

  it('refuse une notification sans demande', async () => {
    await assert.rejects(
      pool.query("INSERT INTO outbox (id, template) VALUES ($1, 'request_notification')", [
        randomUUID(),
      ]),
      { constraint: 'outbox_notification_shape' },
    )
  })

  it('refuse une alerte technique sans événement', async () => {
    await assert.rejects(
      pool.query("INSERT INTO outbox (id, template) VALUES ($1, 'technical_alert')", [
        randomUUID(),
      ]),
      { constraint: 'outbox_alert_shape' },
    )
  })

  it('refuse un envoi accepté sans identifiant du prestataire', async () => {
    await assert.rejects(
      pool.query(
        `INSERT INTO outbox (id, template, request_id, status)
         VALUES ($1, 'request_notification', $2, 'accepted')`,
        [randomUUID(), randomUUID()],
      ),
      { constraint: 'outbox_accepted_shape' },
    )
  })
})

// Accès aux données de la boîte d'envoi (story 3.3, tâche 4). Les dates sont fixées par le test
// (`T0`) : aucune ne dépend de l'horloge de la base, sauf pour les lignes écrites par
// `enqueueNotification` (valeurs par défaut de la table).

const T0 = new Date('2026-11-18T10:00:00.000Z')
const MINUTE = 60_000

function at(minutes: number): Date {
  return new Date(T0.getTime() + minutes * MINUTE)
}

interface RawRow {
  id: string
  template: string
  request_id: string | null
  alert_event: string | null
  alert_subject: string | null
  status: string
  attempts: number
  next_attempt_at: Date
  lease_until: Date | null
  provider_id: string | null
  provider_flags: string[]
  last_error: string | null
  accepted_at: Date | null
}

async function insertPending(
  options: { nextAt?: Date; createdAt?: Date; requestId?: string } = {},
): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO outbox (id, template, request_id, next_attempt_at, created_at)
     VALUES ($1, 'request_notification', $2, $3, $4)`,
    [id, options.requestId ?? randomUUID(), options.nextAt ?? T0, options.createdAt ?? T0],
  )
  return id
}

async function insertAccepted(acceptedAt: Date): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO outbox (id, template, request_id, status, provider_id, accepted_at)
     VALUES ($1, 'request_notification', $2, 'accepted', $3, $4)`,
    [id, randomUUID(), `tem-${id}`, acceptedAt],
  )
  return id
}

async function insertWithStatus(status: 'failed' | 'delivered'): Promise<string> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO outbox (id, template, request_id, status, provider_id, accepted_at, last_error)
     VALUES ($1, 'request_notification', $2, $3, 'tem-1', $4, 'http_400')`,
    [id, randomUUID(), status, T0],
  )
  return id
}

async function row(id: string): Promise<RawRow | undefined> {
  const { rows } = await pool.query<RawRow>('SELECT * FROM outbox WHERE id = $1', [id])
  return rows[0]
}

async function alertsFor(subject: string): Promise<RawRow[]> {
  const { rows } = await pool.query<RawRow>(
    "SELECT * FROM outbox WHERE template = 'technical_alert' AND alert_subject = $1",
    [subject],
  )
  return rows
}

async function count(): Promise<number> {
  const { rows } = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM outbox')
  return rows[0]?.n ?? 0
}

describe('boîte d’envoi : écriture', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
    await applyRoles(pool)
  })
  beforeEach(async () => {
    await pool.query('DELETE FROM outbox')
  })

  it('écrit une notification en attente, sans RETURNING (rôle site_public)', async () => {
    const id = randomUUID()
    const requestId = randomUUID()
    const client = await pool.connect()
    try {
      await client.query('SET ROLE site_public')
      await enqueueNotification(client, { id, requestId, priority: true })
    } finally {
      await client.query('RESET ROLE')
      client.release()
    }
    const written = await row(id)
    assert.ok(written)
    assert.equal(written.template, 'request_notification')
    assert.equal(written.request_id, requestId)
    assert.equal(written.status, 'pending')
    assert.equal(written.attempts, 0)
    const { rows } = await pool.query<{ priority: boolean }>(
      'SELECT priority FROM outbox WHERE id = $1',
      [id],
    )
    assert.equal(rows[0]?.priority, true)
  })

  it('n’écrit rien si la transaction de la demande est annulée', async () => {
    await assert.rejects(
      withTransaction(pool, async (client) => {
        await enqueueNotification(client, {
          id: randomUUID(),
          requestId: randomUUID(),
          priority: false,
        })
        throw new Error('annulation voulue')
      }),
      /annulation voulue/,
    )
    assert.equal(await count(), 0)
  })

  it('une erreur de PostgreSQL devient une VaultError sans valeur', async () => {
    const id = randomUUID()
    const requestId = randomUUID()
    const client = await pool.connect()
    try {
      await enqueueNotification(client, { id, requestId, priority: false })
      await assert.rejects(
        enqueueNotification(client, { id, requestId, priority: false }),
        (error: unknown) => {
          assert.ok(error instanceof VaultError)
          assert.equal(error.code, '23505')
          assert.equal(error.constraint, 'outbox_pkey')
          assert.equal(error.message, 'Coffre : enqueueNotification a échoué (23505)')
          assert.ok(!error.message.includes(id))
          assert.ok(!error.message.includes(requestId))
          assert.equal(error.cause, undefined)
          return true
        },
      )
    } finally {
      client.release()
    }
  })
})

describe('boîte d’envoi : réservation', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
  })
  beforeEach(async () => {
    await pool.query('DELETE FROM outbox')
  })

  it('réserve un message dû, incrémente attempts et pose un bail de 2 minutes', async () => {
    const requestId = randomUUID()
    const id = await insertPending({ requestId })
    const claimed = await claimDue(pool, T0, 10)
    assert.deepEqual(claimed, [
      {
        id,
        template: 'request_notification',
        requestId,
        priority: false,
        alertEvent: null,
        alertSubject: null,
        attempts: 1,
        createdAt: T0,
      },
    ])
    assert.deepEqual((await row(id))?.lease_until, at(2))
  })

  it('ne rend pas un message dont le bail court encore, et le rend une fois le bail échu', async () => {
    const id = await insertPending()
    assert.equal((await claimDue(pool, T0, 10)).length, 1)
    assert.deepEqual(await claimDue(pool, at(1), 10), [])
    const again = await claimDue(pool, at(2), 10)
    assert.deepEqual(
      again.map((item) => [item.id, item.attempts]),
      [[id, 2]],
    )
  })

  it('ne rend pas un message dont la prochaine tentative est à venir', async () => {
    await insertPending({ nextAt: at(5) })
    assert.deepEqual(await claimDue(pool, T0, 10), [])
    assert.equal((await claimDue(pool, at(5), 10)).length, 1)
  })

  it('saute sans attendre un message verrouillé par une autre passe', async () => {
    const locked = await insertPending({ nextAt: at(-1) })
    const free = await insertPending()
    const other = await pool.connect()
    let timer: NodeJS.Timeout | undefined
    try {
      await other.query('BEGIN')
      await other.query('SELECT id FROM outbox WHERE id = $1 FOR UPDATE', [locked])
      const blocked = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('réservation bloquée')), 2_000)
      })
      const claimed = await Promise.race([claimDue(pool, T0, 10), blocked])
      assert.deepEqual(
        claimed.map((item) => item.id),
        [free],
      )
    } finally {
      clearTimeout(timer)
      await other.query('ROLLBACK')
      other.release()
    }
    assert.equal((await row(locked))?.attempts, 0)
  })

  it('ne réserve plus un message à bout de tentatives, sans bloquer les autres', async () => {
    const stuck = await insertPending({ nextAt: at(-1) })
    await pool.query('UPDATE outbox SET attempts = 10 WHERE id = $1', [stuck])
    const free = await insertPending()
    assert.deepEqual(
      (await claimDue(pool, T0, 10)).map((item) => item.id),
      [free],
    )
    assert.equal(await claimOne(pool, stuck, at(5)), null)
    const written = await row(stuck)
    assert.equal(written?.attempts, 10)
    assert.equal(written?.lease_until, null)
  })

  it('ne rend que des messages en attente, dans la limite demandée', async () => {
    await insertWithStatus('failed')
    await insertAccepted(T0)
    const first = await insertPending({ nextAt: at(-3) })
    const second = await insertPending({ nextAt: at(-2) })
    await insertPending({ nextAt: at(-1) })
    const claimed = await claimDue(pool, T0, 2)
    assert.deepEqual(claimed.map((item) => item.id).sort(), [first, second].sort())
  })

  it('deux réservations simultanées rendent des ensembles disjoints', async () => {
    const ids: string[] = []
    for (let i = 0; i < 10; i += 1) ids.push(await insertPending({ nextAt: at(-i) }))
    const [a, b] = await Promise.all([claimDue(pool, T0, 10), claimDue(pool, T0, 10)])
    const idsA = a.map((item) => item.id)
    const idsB = b.map((item) => item.id)
    assert.deepEqual(
      idsA.filter((id) => idsB.includes(id)),
      [],
    )
    assert.deepEqual([...idsA, ...idsB].sort(), [...ids].sort())
    for (const item of [...a, ...b]) assert.equal(item.attempts, 1)
  })

  it('claimOne rend le message une fois, puis null tant que le bail court', async () => {
    const id = await insertPending()
    const other = await insertPending()
    const claimed = await claimOne(pool, id, T0)
    assert.equal(claimed?.id, id)
    assert.equal(claimed?.attempts, 1)
    assert.equal(await claimOne(pool, id, at(1)), null)
    assert.equal((await row(other))?.attempts, 0)
    assert.equal((await claimOne(pool, id, at(2)))?.attempts, 2)
  })

  it('claimOne respecte la date de la prochaine tentative et ignore un inconnu', async () => {
    const id = await insertPending({ nextAt: at(5) })
    assert.equal(await claimOne(pool, id, T0), null)
    assert.equal(await claimOne(pool, randomUUID(), T0), null)
    assert.equal((await row(id))?.attempts, 0)
  })

  it('claimOne rend aussi une alerte technique', async () => {
    const id = randomUUID()
    const subject = randomUUID()
    await pool.query(
      `INSERT INTO outbox (id, template, alert_event, alert_subject, next_attempt_at, created_at)
       VALUES ($1, 'technical_alert', 'undelivered', $2, $3, $3)`,
      [id, subject, T0],
    )
    assert.deepEqual(await claimOne(pool, id, T0), {
      id,
      template: 'technical_alert',
      requestId: null,
      priority: false,
      alertEvent: 'undelivered',
      alertSubject: subject,
      attempts: 1,
      createdAt: T0,
    })
  })
})

describe('boîte d’envoi : statuts', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
  })
  beforeEach(async () => {
    await pool.query('DELETE FROM outbox')
  })

  it('markRetry garde le message en attente, note le code et lève le bail', async () => {
    const id = await insertPending()
    await claimOne(pool, id, T0)
    await markRetry(pool, id, 'http_503', at(5))
    const written = await row(id)
    assert.equal(written?.status, 'pending')
    assert.equal(written?.last_error, 'http_503')
    assert.deepEqual(written?.next_attempt_at, at(5))
    assert.equal(written?.lease_until, null)
  })

  it('markAccepted passe le message à accepted et efface l’erreur précédente', async () => {
    const id = await insertPending()
    await claimOne(pool, id, T0)
    await markRetry(pool, id, 'timeout', at(5))
    await claimOne(pool, id, at(5))
    await markAccepted(pool, id, 'tem:0a1b-2c3d.4e_5f', at(6))
    const written = await row(id)
    assert.equal(written?.status, 'accepted')
    assert.equal(written?.provider_id, 'tem:0a1b-2c3d.4e_5f')
    assert.deepEqual(written?.accepted_at, at(6))
    assert.equal(written?.lease_until, null)
    assert.equal(written?.last_error, null)
    assert.equal(written?.attempts, 2)
  })

  it('markFailed avec une alerte : échec et alerte send_failed dans la même transaction', async () => {
    const id = await insertPending()
    const alertId = randomUUID()
    await claimOne(pool, id, T0)
    await markFailed(pool, id, 'http_400', alertId)
    const written = await row(id)
    assert.equal(written?.status, 'failed')
    assert.equal(written?.last_error, 'http_400')
    assert.equal(written?.lease_until, null)
    const alerts = await alertsFor(id)
    assert.equal(alerts.length, 1)
    assert.equal(alerts[0]?.id, alertId)
    assert.equal(alerts[0]?.template, 'technical_alert')
    assert.equal(alerts[0]?.alert_event, 'send_failed')
    assert.equal(alerts[0]?.status, 'pending')
    assert.equal(alerts[0]?.request_id, null)
  })

  it('markFailed sans alerte n’en crée aucune', async () => {
    const id = await insertPending()
    await markFailed(pool, id, 'http_400', null)
    assert.equal((await row(id))?.status, 'failed')
    assert.equal(await count(), 1)
  })

  it('markFailed n’écrit pas l’échec si l’alerte est refusée', async () => {
    const id = await insertPending()
    const taken = await insertPending()
    await assert.rejects(markFailed(pool, id, 'http_400', taken), VaultError)
    assert.equal((await row(id))?.status, 'pending')
  })

  it('les trois marquages ne touchent qu’un message en attente', async () => {
    const id = await insertWithStatus('failed')
    await markAccepted(pool, id, 'tem-2', at(1))
    await markRetry(pool, id, 'http_503', at(5))
    await markFailed(pool, id, 'timeout', randomUUID())
    const written = await row(id)
    assert.equal(written?.status, 'failed')
    assert.equal(written?.provider_id, 'tem-1')
    assert.equal(written?.last_error, 'http_400')
    assert.deepEqual(await alertsFor(id), [])
  })

  it('listAccepted rend les messages acceptés, du plus ancien au plus récent', async () => {
    const recent = await insertAccepted(at(30))
    const oldest = await insertAccepted(at(10))
    const middle = await insertAccepted(at(20))
    await insertPending()
    await insertWithStatus('delivered')
    assert.deepEqual(await listAccepted(pool, 2), [
      {
        id: oldest,
        template: 'request_notification',
        providerId: `tem-${oldest}`,
        acceptedAt: at(10),
      },
      {
        id: middle,
        template: 'request_notification',
        providerId: `tem-${middle}`,
        acceptedAt: at(20),
      },
    ])
    assert.equal((await listAccepted(pool, 10)).at(-1)?.id, recent)
  })

  it('recordDelivery note la livraison et les indicateurs, sans alerte', async () => {
    const id = await insertAccepted(T0)
    await recordDelivery(pool, id, 'delivered', ['greylisted'], null, null)
    const written = await row(id)
    assert.equal(written?.status, 'delivered')
    assert.deepEqual(written?.provider_flags, ['greylisted'])
    assert.equal(written?.provider_id, `tem-${id}`)
    assert.equal(await count(), 1)
  })

  it('recordDelivery undelivered crée l’alerte dans la même transaction', async () => {
    const id = await insertAccepted(T0)
    const alertId = randomUUID()
    await recordDelivery(pool, id, 'undelivered', ['hard_bounce'], alertId, 'undelivered')
    const written = await row(id)
    assert.equal(written?.status, 'undelivered')
    assert.deepEqual(written?.provider_flags, ['hard_bounce'])
    const alerts = await alertsFor(id)
    assert.deepEqual(
      alerts.map((alert) => [alert.id, alert.template, alert.alert_event, alert.status]),
      [[alertId, 'technical_alert', 'undelivered', 'pending']],
    )
  })

  it('recordDelivery ne touche qu’un message accepté', async () => {
    const id = await insertPending()
    await recordDelivery(pool, id, 'undelivered', [], randomUUID(), 'tracking_expired')
    assert.equal((await row(id))?.status, 'pending')
    assert.deepEqual(await alertsFor(id), [])
  })

  it('purgeOutbox n’efface que les lignes antérieures à la date', async () => {
    const old = await insertPending({ createdAt: at(-60) })
    const edge = await insertPending({ createdAt: T0 })
    const recent = await insertPending({ createdAt: at(60) })
    assert.equal(await purgeOutbox(pool, T0), 1)
    assert.equal(await row(old), undefined)
    assert.ok(await row(edge))
    assert.ok(await row(recent))
  })
})

describe('boîte d’envoi : validation avant toute requête', () => {
  // Valeur témoin : refusée par tous les formats, elle ne doit apparaître dans aucun message.
  const TEMOIN = 'temoin-fuite@exemple.invalid'
  const ID = '6f1c1c3e-2b8a-4c55-9a0f-0d3f5b2e7a41'
  let queried = false
  const noDb = {
    query: async () => {
      queried = true
      throw new Error('requête inattendue')
    },
    connect: async () => {
      queried = true
      throw new Error('connexion inattendue')
    },
  } as unknown as Pool & PoolClient

  const cases: [string, () => Promise<unknown>][] = [
    ['enqueue id', () => enqueueNotification(noDb, { id: TEMOIN, requestId: ID, priority: false })],
    [
      'enqueue demande',
      () => enqueueNotification(noDb, { id: ID, requestId: TEMOIN, priority: false }),
    ],
    ['claimDue date', () => claimDue(noDb, new Date(Number.NaN), 10)],
    ['claimDue limite 0', () => claimDue(noDb, T0, 0)],
    ['claimDue limite 101', () => claimDue(noDb, T0, 101)],
    ['claimDue limite décimale', () => claimDue(noDb, T0, 1.5)],
    ['claimOne id', () => claimOne(noDb, TEMOIN, T0)],
    ['claimOne date', () => claimOne(noDb, ID, new Date(Number.NaN))],
    ['markAccepted id', () => markAccepted(noDb, TEMOIN, 'tem-1', T0)],
    ['markAccepted prestataire', () => markAccepted(noDb, ID, TEMOIN, T0)],
    ['markAccepted date', () => markAccepted(noDb, ID, 'tem-1', new Date(Number.NaN))],
    ['markRetry id', () => markRetry(noDb, TEMOIN, 'http_503', T0)],
    ['markRetry code', () => markRetry(noDb, ID, TEMOIN, T0)],
    ['markRetry code long', () => markRetry(noDb, ID, 'a'.repeat(61), T0)],
    ['markRetry date', () => markRetry(noDb, ID, 'http_503', new Date(Number.NaN))],
    ['markFailed id', () => markFailed(noDb, TEMOIN, 'http_400', null)],
    ['markFailed code', () => markFailed(noDb, ID, TEMOIN, null)],
    ['markFailed alerte', () => markFailed(noDb, ID, 'http_400', TEMOIN)],
    ['listAccepted limite', () => listAccepted(noDb, 0)],
    ['recordDelivery id', () => recordDelivery(noDb, TEMOIN, 'delivered', [], null, null)],
    ['recordDelivery issue', () => recordDelivery(noDb, ID, TEMOIN as 'delivered', [], null, null)],
    [
      'recordDelivery indicateur',
      () => recordDelivery(noDb, ID, 'delivered', [TEMOIN], null, null),
    ],
    [
      'recordDelivery alerte',
      () => recordDelivery(noDb, ID, 'undelivered', [], TEMOIN, 'undelivered'),
    ],
    [
      'recordDelivery alerte sans événement',
      () => recordDelivery(noDb, ID, 'undelivered', [], ID, null),
    ],
    [
      'recordDelivery événement inconnu',
      () => recordDelivery(noDb, ID, 'undelivered', [], ID, TEMOIN as 'undelivered'),
    ],
    ['purgeOutbox date', () => purgeOutbox(noDb, new Date(Number.NaN))],
  ]

  for (const [label, run] of cases) {
    it(`lève RangeError sans citer la valeur : ${label}`, async () => {
      queried = false
      await assert.rejects(run(), (error: unknown) => {
        assert.ok(error instanceof RangeError)
        assert.ok(!error.message.includes(TEMOIN))
        return true
      })
      assert.equal(queried, false)
    })
  }
})
