import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import type { Pool } from 'pg'

import { migrate } from '../../src/lib/db/migrate.ts'
import type { EmailConfig } from '../../src/lib/email/config.ts'
import type {
  EmailTransport,
  OutgoingEmail,
  SendResult,
  StatusResult,
} from '../../src/lib/email/tem.ts'
import { renderAlert, renderNotification } from '../../src/lib/email/templates.ts'
import { runOutbox, sendItem, sendNow } from '../../src/lib/outbox/process.ts'
import type { OutboxDeps, OutboxLogStatus } from '../../src/lib/outbox/process.ts'
import { claimOne } from '../../src/lib/outbox/repository.ts'
import { applyRoles, envoiPool, resetDatabase, testPool } from './helpers.ts'

// Envoi d'un message et passe de la tâche planifiée (story 3.3, tâche 7), contre PostgreSQL et
// sous le rôle `envoi`. Le transport est factice (il note chaque appel) et l'horloge est réglée
// par le test. `T0` suit l'horloge réelle, 10 minutes en avant : les alertes écrites pendant une
// passe prennent l'heure de la base (`now()`) ; elles doivent être dues à l'heure du test, et
// jamais purgées par elle.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const T0 = new Date(Math.floor(Date.now() / MINUTE) * MINUTE + 10 * MINUTE)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const CONFIG: EmailConfig = {
  temSecretKey: 'cle-secrete-de-test',
  temProjectId: '6f1c1c3e-2b8a-4c55-9a0f-0d3f5b2e7a41',
  from: { email: 'maison@exemple.invalid', name: 'Maison Triona' },
  notifyTo: 'cat@exemple.invalid',
  alertTo: 'sady@exemple.invalid',
  siteUrl: 'https://maisontriona.test',
}

const UNAVAILABLE: SendResult = { ok: false, retryable: true, code: 'http_503' }
const REFUSED: SendResult = { ok: false, retryable: false, code: 'http_400' }

const LOG_STATUSES: readonly string[] = [
  'sent',
  'retry',
  'failed:provider',
  'failed:alert',
  'failed:exhausted',
  'failed:db',
  'delivered',
  'undelivered',
]

// `admin` prépare et relit les lignes ; `pool` (rôle `envoi`) est celui du code testé.
const admin = testPool()
const pool = envoiPool()

after(async () => {
  await pool.end()
  await admin.end()
})

function at(ms: number): Date {
  return new Date(T0.getTime() + ms)
}

// Base injoignable : toute requête échoue.
const brokenPool = {
  query: async () => {
    throw new Error('connexion refusée')
  },
  connect: async () => {
    throw new Error('connexion refusée')
  },
} as unknown as Pool

// Note le texte de chaque requête passée directement au pool, puis la transmet.
function spiedPool(queries: string[]): Pool {
  return {
    query: (text: string, values?: unknown[]) => {
      queries.push(text)
      return pool.query(text, values)
    },
    connect: () => pool.connect(),
  } as unknown as Pool
}

type Scripted<T> = T | 'throw'

interface Harness {
  deps: OutboxDeps
  sent: OutgoingEmail[]
  checked: string[]
  logs: [OutboxLogStatus, string][]
  advance: (ms: number) => void
}

// Transport factice : rejoue les réponses prévues (`sends` dans l'ordre, `statuses` par
// identifiant du prestataire), puis accepte tout ; `sendCostMs` avance l'horloge à chaque envoi.
function harness(
  options: {
    sends?: Scripted<SendResult>[]
    statuses?: Record<string, Scripted<StatusResult>>
    sendDelayMs?: number
    sendCostMs?: number
    statusCostMs?: number
    failingLog?: OutboxLogStatus[]
    pool?: Pool
  } = {},
): Harness {
  let current = T0.getTime()
  const sent: OutgoingEmail[] = []
  const checked: string[] = []
  const logs: [OutboxLogStatus, string][] = []
  const sends = [...(options.sends ?? [])]
  const transport: EmailTransport = {
    async send(message) {
      const index = sent.push(message)
      if (options.sendDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.sendDelayMs))
      }
      current += options.sendCostMs ?? 0
      const next = sends.shift() ?? { ok: true, providerId: `tem-${index}` }
      if (next === 'throw') throw new Error('panne inattendue du transport')
      return next
    },
    async status(providerId) {
      checked.push(providerId)
      current += options.statusCostMs ?? 0
      const next = options.statuses?.[providerId] ?? { ok: true, state: 'pending', flags: [] }
      if (next === 'throw') throw new Error('panne inattendue du transport')
      return next
    },
  }
  return {
    deps: {
      pool: options.pool ?? pool,
      transport,
      config: CONFIG,
      now: () => new Date(current),
      newId: () => randomUUID(),
      log: (status, id) => {
        logs.push([status, id])
        if (options.failingLog?.includes(status)) throw new Error('journal indisponible')
      },
    },
    sent,
    checked,
    logs,
    advance: (ms) => {
      current += ms
    },
  }
}

interface RawRow {
  id: string
  template: string
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
  created_at: Date
}

async function insertNotification(
  options: {
    requestId?: string
    priority?: boolean
    nextAt?: Date
    createdAt?: Date
    attempts?: number
  } = {},
): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO outbox (id, template, request_id, priority, next_attempt_at, created_at, attempts)
     VALUES ($1, 'request_notification', $2, $3, $4, $5, $6)`,
    [
      id,
      options.requestId ?? randomUUID(),
      options.priority ?? false,
      options.nextAt ?? T0,
      options.createdAt ?? T0,
      options.attempts ?? 0,
    ],
  )
  return id
}

async function insertAlert(options: { attempts?: number } = {}): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO outbox (id, template, alert_event, alert_subject, next_attempt_at, created_at,
                         attempts)
     VALUES ($1, 'technical_alert', 'send_failed', $2, $3, $3, $4)`,
    [id, randomUUID(), T0, options.attempts ?? 0],
  )
  return id
}

async function insertAccepted(
  options: { acceptedAt?: Date; alert?: boolean } = {},
): Promise<{ id: string; providerId: string }> {
  const id = randomUUID()
  const providerId = `tem:${randomUUID()}`
  const acceptedAt = options.acceptedAt ?? at(-HOUR)
  if (options.alert) {
    await admin.query(
      `INSERT INTO outbox (id, template, alert_event, alert_subject, status, provider_id,
                           accepted_at, created_at, attempts)
       VALUES ($1, 'technical_alert', 'send_failed', $2, 'accepted', $3, $4, $4, 1)`,
      [id, randomUUID(), providerId, acceptedAt],
    )
  } else {
    await admin.query(
      `INSERT INTO outbox (id, template, request_id, status, provider_id, accepted_at, created_at,
                           attempts)
       VALUES ($1, 'request_notification', $2, 'accepted', $3, $4, $4, 1)`,
      [id, randomUUID(), providerId, acceptedAt],
    )
  }
  return { id, providerId }
}

async function row(id: string): Promise<RawRow | undefined> {
  const { rows } = await admin.query<RawRow>('SELECT * FROM outbox WHERE id = $1', [id])
  return rows[0]
}

async function alertsFor(subject: string): Promise<RawRow[]> {
  const { rows } = await admin.query<RawRow>(
    "SELECT * FROM outbox WHERE template = 'technical_alert' AND alert_subject = $1",
    [subject],
  )
  return rows
}

async function count(): Promise<number> {
  const { rows } = await admin.query<{ n: number }>('SELECT count(*)::int AS n FROM outbox')
  return rows[0]?.n ?? 0
}

before(async () => {
  await resetDatabase(admin)
  await migrate(admin, MIGRATIONS)
  await applyRoles(admin)
})

beforeEach(async () => {
  await admin.query('DELETE FROM outbox')
})

describe('boîte d’envoi : premier essai (sendNow)', () => {
  it('envoie la notification à Cat, note l’identifiant du prestataire et journalise sent', async () => {
    const requestId = randomUUID()
    const id = await insertNotification({ requestId, priority: true })
    const h = harness()
    await sendNow(h.deps, id)
    const mail = renderNotification({
      requestId,
      priority: true,
      createdAt: T0,
      siteUrl: CONFIG.siteUrl,
    })
    assert.deepEqual(h.sent, [
      { from: CONFIG.from, to: CONFIG.notifyTo, subject: mail.subject, text: mail.text },
    ])
    const written = await row(id)
    assert.equal(written?.status, 'accepted')
    assert.equal(written?.provider_id, 'tem-1')
    assert.deepEqual(written?.accepted_at, T0)
    assert.equal(written?.attempts, 1)
    assert.equal(written?.lease_until, null)
    assert.deepEqual(h.logs, [['sent', id]])
  })

  it('n’envoie qu’une fois : un second appel sur le même message ne fait rien', async () => {
    const id = await insertNotification()
    const h = harness()
    await sendNow(h.deps, id)
    await sendNow(h.deps, id)
    assert.equal(h.sent.length, 1)
    assert.deepEqual(h.logs, [['sent', id]])
  })

  it('ne fait rien sur un message déjà réservé, et deux appels simultanés n’envoient qu’une fois', async () => {
    const leased = await insertNotification()
    assert.ok(await claimOne(admin, leased, T0))
    const h = harness({ sendDelayMs: 5 })
    await sendNow(h.deps, leased)
    assert.deepEqual(h.sent, [])
    assert.deepEqual(h.logs, [])
    assert.equal((await row(leased))?.attempts, 1)
    assert.equal((await row(leased))?.status, 'pending')

    const id = await insertNotification()
    await Promise.all([sendNow(h.deps, id), sendNow(h.deps, id)])
    assert.equal(h.sent.length, 1)
    assert.deepEqual(h.logs, [['sent', id]])
    assert.equal((await row(id))?.attempts, 1)
  })

  it('ne lève jamais : base injoignable, journal failed:db avec l’identifiant', async () => {
    const id = randomUUID()
    const h = harness({ pool: brokenPool })
    await assert.doesNotReject(sendNow(h.deps, id))
    assert.deepEqual(h.sent, [])
    assert.deepEqual(h.logs, [['failed:db', id]])
  })

  it('ne lève jamais : une erreur après l’envoi est journalisée failed:db', async () => {
    const id = await insertNotification()
    const h = harness({ sends: [{ ok: true, providerId: 'identifiant refusé' }] })
    await assert.doesNotReject(sendNow(h.deps, id))
    assert.equal(h.sent.length, 1)
    assert.deepEqual(h.logs, [['failed:db', id]])
    // Le message reste sous bail : la tâche planifiée le reprendra à son échéance.
    const written = await row(id)
    assert.equal(written?.status, 'pending')
    assert.deepEqual(written?.lease_until, at(2 * MINUTE))
  })

  it('un journal en panne après l’envoi n’est pas pris pour une erreur de la base', async () => {
    const id = await insertNotification()
    const h = harness({ failingLog: ['sent'] })
    await assert.doesNotReject(sendNow(h.deps, id))
    assert.deepEqual(h.logs, [['sent', id]])
    assert.equal((await row(id))?.status, 'accepted')
  })
})

describe('boîte d’envoi : envoi d’un message (sendItem)', () => {
  it('400 : échec définitif dès le premier essai, avec une alerte send_failed', async () => {
    const id = await insertNotification()
    const h = harness({ sends: [REFUSED] })
    await sendNow(h.deps, id)
    const written = await row(id)
    assert.equal(written?.status, 'failed')
    assert.equal(written?.last_error, 'http_400')
    assert.equal(written?.attempts, 1)
    const alerts = await alertsFor(id)
    assert.deepEqual(
      alerts.map((alert) => [alert.alert_event, alert.status]),
      [['send_failed', 'pending']],
    )
    assert.deepEqual(h.logs, [['failed:provider', id]])
  })

  it('une alerte qui échoue définitivement ne crée pas d’alerte : failed:alert', async () => {
    const id = await insertAlert()
    const h = harness({ sends: [REFUSED] })
    await sendNow(h.deps, id)
    assert.equal(h.sent[0]?.to, CONFIG.alertTo)
    const written = await row(id)
    assert.equal(written?.status, 'failed')
    assert.equal(written?.last_error, 'http_400')
    assert.equal(await count(), 1)
    assert.deepEqual(h.logs, [['failed:alert', id]])
  })

  it('un message réservé au-delà de 4 tentatives échoue sans envoi, avec une alerte', async () => {
    const id = await insertNotification({ attempts: 4 })
    const h = harness()
    await sendNow(h.deps, id)
    assert.deepEqual(h.sent, [])
    const written = await row(id)
    assert.equal(written?.status, 'failed')
    assert.equal(written?.last_error, 'exhausted')
    assert.equal(written?.attempts, 5)
    assert.equal((await alertsFor(id)).length, 1)
    assert.deepEqual(h.logs, [['failed:exhausted', id]])
  })

  it('une alerte réservée au-delà de 4 tentatives échoue sans envoi ni alerte', async () => {
    const id = await insertAlert({ attempts: 4 })
    const h = harness()
    await sendNow(h.deps, id)
    assert.deepEqual(h.sent, [])
    assert.equal((await row(id))?.last_error, 'exhausted')
    assert.equal(await count(), 1)
    assert.deepEqual(h.logs, [['failed:alert', id]])
  })

  it('une panne inattendue du transport est reprise (code exception)', async () => {
    const id = await insertNotification()
    const h = harness({ sends: ['throw'] })
    await sendNow(h.deps, id)
    const written = await row(id)
    assert.equal(written?.status, 'pending')
    assert.equal(written?.last_error, 'exception')
    assert.deepEqual(written?.next_attempt_at, at(5 * MINUTE))
    assert.deepEqual(h.logs, [['retry', id]])
  })

  it('un message illisible échoue définitivement (code render), sans envoi', async () => {
    const id = await insertNotification()
    const item = await claimOne(pool, id, T0)
    assert.ok(item)
    const h = harness()
    assert.equal(await sendItem(h.deps, { ...item, requestId: null }), 'failed')
    assert.deepEqual(h.sent, [])
    assert.equal((await row(id))?.last_error, 'render')
    assert.equal((await alertsFor(id)).length, 1)
    assert.deepEqual(h.logs, [['failed:provider', id]])
  })

  it('laisse remonter une erreur de la base au marquage', async () => {
    const id = await insertNotification()
    const item = await claimOne(pool, id, T0)
    assert.ok(item)
    const h = harness({ pool: brokenPool })
    await assert.rejects(sendItem(h.deps, item))
    assert.equal(h.sent.length, 1)
    assert.deepEqual(h.logs, [])
  })
})

describe('boîte d’envoi : passe de la tâche planifiée (runOutbox)', () => {
  it('503 puis succès : reprise à +5 minutes, puis acceptée', async () => {
    const id = await insertNotification()
    const h = harness({ sends: [UNAVAILABLE] })
    assert.equal((await runOutbox(h.deps)).retried, 1)
    let written = await row(id)
    assert.equal(written?.status, 'pending')
    assert.equal(written?.last_error, 'http_503')
    assert.deepEqual(written?.next_attempt_at, at(5 * MINUTE))
    assert.equal(written?.lease_until, null)
    assert.equal(written?.attempts, 1)

    h.advance(4 * MINUTE)
    assert.equal((await runOutbox(h.deps)).sent, 0)
    h.advance(MINUTE)
    assert.equal((await runOutbox(h.deps)).sent, 1)
    written = await row(id)
    assert.equal(written?.status, 'accepted')
    assert.equal(written?.attempts, 2)
    assert.equal(written?.last_error, null)
    assert.equal(h.sent.length, 2)
    assert.deepEqual(h.logs, [
      ['retry', id],
      ['sent', id],
    ])
  })

  it('quatre 503 : échec définitif, puis une alerte send_failed envoyée à Sady', async () => {
    const id = await insertNotification()
    const h = harness({ sends: [UNAVAILABLE, UNAVAILABLE, UNAVAILABLE, UNAVAILABLE] })
    for (const wait of [0, 5, 30, 120]) {
      h.advance(wait * MINUTE)
      await runOutbox(h.deps)
    }
    const written = await row(id)
    assert.equal(written?.status, 'failed')
    assert.equal(written?.last_error, 'http_503')
    assert.equal(written?.attempts, 4)
    const alerts = await alertsFor(id)
    assert.equal(alerts.length, 1)
    const alert = alerts[0]!
    assert.equal(alert.alert_event, 'send_failed')

    // L'alerte part dans la même passe ou à la suivante.
    h.advance(5 * MINUTE)
    await runOutbox(h.deps)
    assert.equal((await row(alert.id))?.status, 'accepted')
    const mail = renderAlert({ event: 'send_failed', subjectId: id, createdAt: alert.created_at })
    assert.deepEqual(
      h.sent.filter((message) => message.to === CONFIG.alertTo),
      [{ from: CONFIG.from, to: CONFIG.alertTo, subject: mail.subject, text: mail.text }],
    )
    assert.equal(h.sent.filter((message) => message.to === CONFIG.notifyTo).length, 4)
    assert.deepEqual(
      h.logs.filter(([, logged]) => logged === id).map(([status]) => status),
      ['retry', 'retry', 'retry', 'failed:provider'],
    )
    assert.deepEqual(h.logs.at(-1), ['sent', alert.id])
  })

  it('deux passes simultanées n’envoient chaque message qu’une fois', async () => {
    const ids: string[] = []
    for (let i = 0; i < 6; i += 1) ids.push(await insertNotification({ nextAt: at(-i * MINUTE) }))
    const h = harness({ sendDelayMs: 5 })
    const [a, b] = await Promise.all([runOutbox(h.deps), runOutbox(h.deps)])
    assert.equal(a.sent + b.sent, 6)
    assert.equal(h.sent.length, 6)
    const providerIds = new Set<string | null>()
    for (const id of ids) {
      const written = await row(id)
      assert.equal(written?.status, 'accepted')
      assert.equal(written?.attempts, 1)
      providerIds.add(written?.provider_id ?? null)
    }
    assert.equal(providerIds.size, 6)
    assert.deepEqual(h.logs.map(([, id]) => id).sort(), [...ids].sort())
  })

  it('passe en échec les messages à bout de tentatives et envoie leur alerte', async () => {
    const stuck = await insertNotification({ attempts: 10 })
    const h = harness()
    const summary = await runOutbox(h.deps)
    assert.equal(summary.exhausted, 1)
    assert.equal((await row(stuck))?.status, 'failed')
    assert.equal((await row(stuck))?.last_error, 'exhausted')
    const alerts = await alertsFor(stuck)
    assert.equal(alerts.length, 1)
    assert.equal(summary.sent, 1)
    assert.equal(h.sent[0]?.to, CONFIG.alertTo)
    assert.equal((await row(alerts[0]!.id))?.status, 'accepted')
  })

  it('une erreur sur un message est journalisée et comptée à part, et la passe continue', async () => {
    const first = await insertNotification({ nextAt: at(-2 * MINUTE) })
    const second = await insertNotification({ nextAt: at(-MINUTE) })
    const h = harness({ sends: [{ ok: true, providerId: 'identifiant refusé' }] })
    const summary = await runOutbox(h.deps)
    assert.equal(summary.errors, 1)
    assert.equal(summary.failed, 0)
    assert.equal(summary.sent, 1)
    assert.deepEqual(h.logs, [
      ['failed:db', first],
      ['sent', second],
    ])
    assert.equal((await row(first))?.status, 'pending')
    assert.equal((await row(second))?.status, 'accepted')
  })

  it('s’arrête au budget : 2 envois de 30 s pour 45 s, les autres lignes intactes', async () => {
    const ids: string[] = []
    for (let i = 4; i >= 1; i -= 1) ids.push(await insertNotification({ nextAt: at(-i * MINUTE) }))
    const queries: string[] = []
    const h = harness({ sendCostMs: 30_000, pool: spiedPool(queries) })
    const summary = await runOutbox(h.deps, { budgetMs: 45_000 })
    assert.equal(summary.sent, 2)
    assert.equal(h.sent.length, 2)
    // Budget épuisé : aucun suivi, pas même la liste des messages acceptés.
    assert.deepEqual(h.checked, [])
    assert.ok(!queries.some((text) => text.includes("WHERE status = 'accepted'")))
    for (const id of ids.slice(0, 2)) assert.equal((await row(id))?.status, 'accepted')
    for (const id of ids.slice(2)) {
      const written = await row(id)
      assert.equal(written?.status, 'pending')
      assert.equal(written?.attempts, 0)
      assert.equal(written?.lease_until, null)
    }
  })

  it('budget par défaut de 30 s : 2 envois de 15 s (3 avec 40 s)', async () => {
    for (let i = 0; i < 4; i += 1) await insertNotification()
    const h = harness({ sendCostMs: 15_000 })
    assert.equal((await runOutbox(h.deps)).sent, 2)
  })

  it('le suivi s’arrête en route quand l’horloge dépasse le budget', async () => {
    for (let i = 3; i >= 1; i -= 1) await insertAccepted({ acceptedAt: at(-i * HOUR) })
    const h = harness({ statusCostMs: 30_000 })
    await runOutbox(h.deps, { budgetMs: 45_000 })
    assert.equal(h.checked.length, 2)
  })

  it('un journal qui lève dans une erreur n’interrompt pas la passe', async () => {
    const first = await insertNotification({ nextAt: at(-2 * MINUTE) })
    const second = await insertNotification({ nextAt: at(-MINUTE) })
    const tracked = await insertAccepted({
      acceptedAt: at(-HOUR),
    })
    const h = harness({
      sends: [{ ok: true, providerId: 'identifiant refusé' }],
      statuses: { [tracked.providerId]: { ok: true, state: 'delivered', flags: ['REFUSÉ'] } },
      failingLog: ['failed:db'],
    })
    const summary = await runOutbox(h.deps)
    assert.equal(summary.errors, 2)
    assert.equal(summary.sent, 1)
    assert.deepEqual(h.logs, [
      ['failed:db', first],
      ['sent', second],
      ['failed:db', tracked.id],
    ])
  })

  it('un journal en panne ne change aucune issue et ne compte aucune erreur', async () => {
    const accepted = await insertNotification({ nextAt: at(-3 * MINUTE) })
    const retried = await insertNotification({ nextAt: at(-2 * MINUTE) })
    const refused = await insertNotification({ nextAt: at(-MINUTE) })
    const delivered = await insertAccepted({ acceptedAt: at(-2 * HOUR) })
    const bounced = await insertAccepted({ acceptedAt: at(-HOUR) })
    const h = harness({
      sends: [{ ok: true, providerId: 'tem-journal' }, UNAVAILABLE, REFUSED],
      statuses: {
        [delivered.providerId]: { ok: true, state: 'delivered', flags: [] },
        [bounced.providerId]: { ok: true, state: 'undelivered', flags: ['hard_bounce'] },
      },
      failingLog: LOG_STATUSES as OutboxLogStatus[],
    })
    // Trois envois au plus : l'alerte de l'échec reste pour la passe suivante.
    const summary = await runOutbox(h.deps, { maxSends: 3 })
    assert.equal(summary.sent, 1)
    assert.equal(summary.retried, 1)
    assert.equal(summary.failed, 1)
    assert.equal(summary.delivered, 1)
    assert.equal(summary.undelivered, 1)
    assert.equal(summary.errors, 0)
    assert.deepEqual(h.logs, [
      ['sent', accepted],
      ['retry', retried],
      ['failed:provider', refused],
      ['delivered', delivered.id],
      ['undelivered', bounced.id],
    ])
    assert.equal((await row(accepted))?.status, 'accepted')
    assert.equal((await row(retried))?.last_error, 'http_503')
    assert.equal((await row(refused))?.status, 'failed')
    assert.equal((await row(delivered.id))?.status, 'delivered')
    assert.equal((await row(bounced.id))?.status, 'undelivered')
  })

  it('base injoignable : la passe échoue (la route répondra 500)', async () => {
    await assert.rejects(runOutbox(harness({ pool: brokenPool }).deps))
  })

  it('respecte maxSends et maxChecks', async () => {
    for (let i = 0; i < 3; i += 1) await insertNotification()
    for (let i = 0; i < 3; i += 1) await insertAccepted({ acceptedAt: at(-(i + 1) * HOUR) })
    const h = harness()
    const summary = await runOutbox(h.deps, { maxSends: 2, maxChecks: 2 })
    assert.equal(summary.sent, 2)
    assert.equal(h.sent.length, 2)
    assert.equal(h.checked.length, 2)
  })

  it('purge les lignes de plus de 30 jours', async () => {
    const old = await insertAccepted({ acceptedAt: at(-31 * DAY) })
    await admin.query("UPDATE outbox SET status = 'delivered' WHERE id = $1", [old.id])
    const recent = await insertAccepted({ acceptedAt: at(-29 * DAY) })
    await admin.query("UPDATE outbox SET status = 'delivered' WHERE id = $1", [recent.id])
    const summary = await runOutbox(harness().deps)
    assert.equal(summary.purged, 1)
    assert.equal(await row(old.id), undefined)
    assert.ok(await row(recent.id))
  })
})

describe('boîte d’envoi : suivi de la livraison', () => {
  it('delivered sans indicateur grave : delivered, sans alerte', async () => {
    const { id, providerId } = await insertAccepted()
    const h = harness({
      statuses: { [providerId]: { ok: true, state: 'delivered', flags: ['greylisted'] } },
    })
    const summary = await runOutbox(h.deps)
    assert.equal(summary.delivered, 1)
    const written = await row(id)
    assert.equal(written?.status, 'delivered')
    assert.deepEqual(written?.provider_flags, ['greylisted'])
    assert.deepEqual(await alertsFor(id), [])
    assert.deepEqual(h.logs, [['delivered', id]])
  })

  it('undelivered avec hard_bounce : undelivered, et une alerte undelivered', async () => {
    const { id, providerId } = await insertAccepted()
    const h = harness({
      statuses: { [providerId]: { ok: true, state: 'undelivered', flags: ['hard_bounce'] } },
    })
    const summary = await runOutbox(h.deps)
    assert.equal(summary.undelivered, 1)
    const written = await row(id)
    assert.equal(written?.status, 'undelivered')
    assert.deepEqual(written?.provider_flags, ['hard_bounce'])
    assert.deepEqual(
      (await alertsFor(id)).map((alert) => [alert.alert_event, alert.status]),
      [['undelivered', 'pending']],
    )
    assert.deepEqual(h.logs, [['undelivered', id]])
  })

  it('un indicateur grave l’emporte sur l’état : spam, blocklisted, mailbox_not_found…', async () => {
    const cases: [string, StatusResult][] = [
      ['spam', { ok: true, state: 'delivered', flags: ['spam'] }],
      ['blocklisted', { ok: true, state: 'delivered', flags: ['greylisted', 'blocklisted'] }],
      ['mailbox_not_found', { ok: true, state: 'delivered', flags: ['mailbox_not_found'] }],
      ['hard_bounce en attente', { ok: true, state: 'pending', flags: ['hard_bounce'] }],
    ]
    const statuses: Record<string, StatusResult> = {}
    const ids: string[] = []
    for (const [, status] of cases) {
      const accepted = await insertAccepted()
      statuses[accepted.providerId] = status
      ids.push(accepted.id)
    }
    const summary = await runOutbox(harness({ statuses }).deps)
    assert.equal(summary.undelivered, cases.length)
    for (const [index, id] of ids.entries()) {
      const label = cases[index]![0]
      assert.equal((await row(id))?.status, 'undelivered', label)
      assert.equal((await alertsFor(id))[0]?.alert_event, 'undelivered', label)
    }
  })

  it('toujours en attente à 72 h : undelivered, et une alerte tracking_expired', async () => {
    const old = await insertAccepted({ acceptedAt: at(-72 * HOUR) })
    const young = await insertAccepted({ acceptedAt: at(-71 * HOUR) })
    const h = harness()
    const summary = await runOutbox(h.deps)
    assert.equal(summary.undelivered, 1)
    const written = await row(old.id)
    assert.equal(written?.status, 'undelivered')
    assert.deepEqual(written?.provider_flags, [])
    assert.deepEqual(
      (await alertsFor(old.id)).map((alert) => alert.alert_event),
      ['tracking_expired'],
    )
    assert.equal((await row(young.id))?.status, 'accepted')
    assert.deepEqual(await alertsFor(young.id), [])
    assert.deepEqual(h.logs, [['undelivered', old.id]])
  })

  it('suivi en échec : inchangé dans la fenêtre, tracking_expired au-delà de 72 h', async () => {
    const recent = await insertAccepted({ acceptedAt: at(-HOUR) })
    const old = await insertAccepted({ acceptedAt: at(-73 * HOUR) })
    const h = harness({
      statuses: { [recent.providerId]: { ok: false, code: 'http_503' }, [old.providerId]: 'throw' },
    })
    const summary = await runOutbox(h.deps)
    assert.equal(summary.delivered + summary.undelivered, 1)
    assert.equal((await row(recent.id))?.status, 'accepted')
    assert.deepEqual(await alertsFor(recent.id), [])
    assert.equal((await row(old.id))?.status, 'undelivered')
    assert.deepEqual(
      (await alertsFor(old.id)).map((alert) => alert.alert_event),
      ['tracking_expired'],
    )
    assert.deepEqual(h.logs, [['undelivered', old.id]])
  })

  it('un indicateur répété n’est noté qu’une fois', async () => {
    const { id, providerId } = await insertAccepted()
    const flags = Array.from({ length: 25 }, () => 'soft_bounce')
    const h = harness({ statuses: { [providerId]: { ok: true, state: 'delivered', flags } } })
    assert.equal((await runOutbox(h.deps)).delivered, 1)
    const written = await row(id)
    assert.equal(written?.status, 'delivered')
    assert.deepEqual(written?.provider_flags, ['soft_bounce'])
  })

  it('une alerte non délivrée ne crée pas d’alerte', async () => {
    const alert = await insertAccepted({ alert: true })
    const h = harness({
      statuses: { [alert.providerId]: { ok: true, state: 'undelivered', flags: ['hard_bounce'] } },
    })
    await runOutbox(h.deps)
    assert.equal((await row(alert.id))?.status, 'undelivered')
    assert.equal(await count(), 1)
    assert.deepEqual(h.logs, [['undelivered', alert.id]])
  })

  it('une erreur sur un message suivi est journalisée, et la passe continue', async () => {
    const first = await insertAccepted({ acceptedAt: at(-2 * HOUR) })
    const second = await insertAccepted({ acceptedAt: at(-HOUR) })
    const h = harness({
      statuses: {
        [first.providerId]: { ok: true, state: 'delivered', flags: ['INDICATEUR-REFUSÉ'] },
        [second.providerId]: { ok: true, state: 'delivered', flags: [] },
      },
    })
    const summary = await runOutbox(h.deps)
    assert.equal(summary.delivered, 1)
    assert.equal(summary.errors, 1)
    assert.deepEqual(h.logs, [
      ['failed:db', first.id],
      ['delivered', second.id],
    ])
    assert.equal((await row(first.id))?.status, 'accepted')
  })
})

describe('boîte d’envoi : journal', () => {
  it('ne cite que des statuts et des identifiants de messages', async () => {
    await insertNotification({ nextAt: at(-3 * MINUTE) })
    await insertNotification({ nextAt: at(-2 * MINUTE) })
    await insertNotification({ nextAt: at(-MINUTE) })
    await insertAlert({ attempts: 4 })
    const delivered = await insertAccepted({ acceptedAt: at(-2 * HOUR) })
    const bounced = await insertAccepted({ acceptedAt: at(-HOUR) })
    const h = harness({
      sends: [{ ok: true, providerId: 'tem:accepte-1' }, UNAVAILABLE, REFUSED],
      statuses: {
        [delivered.providerId]: { ok: true, state: 'delivered', flags: [] },
        [bounced.providerId]: { ok: true, state: 'undelivered', flags: ['hard_bounce'] },
      },
    })
    await runOutbox(h.deps)
    assert.ok(h.logs.length >= 6)
    for (const [status, id] of h.logs) {
      assert.ok(LOG_STATUSES.includes(status), status)
      assert.match(id, UUID)
    }
    const journal = JSON.stringify(h.logs)
    const secrets = [
      CONFIG.notifyTo,
      CONFIG.alertTo,
      CONFIG.from.email,
      'Nouvelle demande',
      'Alerte technique',
      'tem:accepte-1',
      delivered.providerId,
      bounced.providerId,
      ...h.sent.map((message) => message.subject),
    ]
    for (const secret of secrets) assert.ok(!journal.includes(secret), secret)
  })
})
