import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { migrate } from '../../src/lib/db/migrate.ts'
import { applyRoles, resetDatabase, testPool } from './helpers.ts'

// Rôles de la boîte d'envoi (story 3.3) : le site public y insère sans relire ; le rôle de
// l'envoi la gère mais ne touche ni aux demandes ni au journal d'accès.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const REFUS = { code: '42501' }
const pool = testPool()

describe('boîte d’envoi : rôles', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
    await applyRoles(pool)
  })
  after(async () => {
    await pool.end()
  })

  it('site_public insère, mais ne lit, ne modifie ni n’efface', async () => {
    const client = await pool.connect()
    try {
      await client.query('SET ROLE site_public')
      await client.query(
        "INSERT INTO outbox (id, template, request_id) VALUES ($1, 'request_notification', $2)",
        [randomUUID(), randomUUID()],
      )
      for (const sql of [
        'SELECT id FROM outbox',
        "UPDATE outbox SET status = 'failed'",
        'DELETE FROM outbox',
      ]) {
        await assert.rejects(client.query(sql), REFUS, sql)
      }
    } finally {
      await client.query('RESET ROLE')
      client.release()
    }
  })

  it('site_public n’écrit que les colonnes d’une notification', async () => {
    const client = await pool.connect()
    try {
      await client.query('SET ROLE site_public')
      // L'insertion de `enqueueNotification`, colonne pour colonne, passe toujours.
      await client.query(
        `INSERT INTO outbox (id, template, request_id, priority)
         VALUES ($1, 'request_notification', $2, true)`,
        [randomUUID(), randomUUID()],
      )
      // Tout le reste est réservé à l'envoi : un état, un identifiant du prestataire, une alerte.
      for (const [colonne, valeur] of [
        ['status', 'accepted'],
        ['provider_id', 'tem-forge'],
        ['alert_event', 'send_failed'],
        ['alert_subject', randomUUID()],
        ['attempts', '10'],
        ['next_attempt_at', '2000-01-01T00:00:00Z'],
        ['created_at', '2000-01-01T00:00:00Z'],
      ]) {
        await assert.rejects(
          client.query(
            `INSERT INTO outbox (id, template, request_id, ${colonne})
             VALUES ($1, 'request_notification', $2, $3)`,
            [randomUUID(), randomUUID(), valeur],
          ),
          REFUS,
          colonne,
        )
      }
    } finally {
      await client.query('RESET ROLE')
      client.release()
    }
  })

  it('envoi gère la boîte d’envoi, sans accès aux demandes ni à l’authentification', async () => {
    await pool.query(
      "INSERT INTO outbox (id, template, request_id) VALUES ($1, 'request_notification', $2)",
      [randomUUID(), randomUUID()],
    )
    const client = await pool.connect()
    try {
      await client.query('SET ROLE envoi')
      const { rowCount } = await client.query('SELECT id FROM outbox')
      assert.ok(rowCount !== null && rowCount >= 1)
      await client.query(
        `INSERT INTO outbox (id, template, alert_event, alert_subject)
         VALUES ($1, 'technical_alert', 'send_failed', $2)`,
        [randomUUID(), randomUUID()],
      )
      await client.query("UPDATE outbox SET status = 'failed'")
      await client.query('DELETE FROM outbox')
      for (const sql of [
        'SELECT id FROM vault_requests',
        "UPDATE vault_requests SET status = 'closed'",
        'DELETE FROM vault_requests',
        "INSERT INTO vault_requests (id) VALUES ('00000000-0000-0000-0000-000000000000')",
        'SELECT * FROM vault_access_log',
        'SELECT id FROM "user"',
      ]) {
        await assert.rejects(client.query(sql), REFUS, sql)
      }
    } finally {
      await client.query('RESET ROLE')
      client.release()
    }
  })
})
