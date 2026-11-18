import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { migrate } from '../../src/lib/db/migrate.ts'
import { resetDatabase, testPool } from './helpers.ts'

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const pool = testPool()

describe('boîte d’envoi : schéma', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
  })
  after(async () => {
    await pool.end()
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
