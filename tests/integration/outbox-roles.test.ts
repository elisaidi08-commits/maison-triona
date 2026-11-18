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

  it('envoi gère la boîte d’envoi, sans accès aux demandes ni au journal', async () => {
    const client = await pool.connect()
    try {
      await client.query('SET ROLE envoi')
      const { rowCount } = await client.query('SELECT id FROM outbox')
      assert.equal(rowCount, 1)
      await client.query("UPDATE outbox SET status = 'failed'")
      await client.query('DELETE FROM outbox')
      for (const sql of ['SELECT id FROM vault_requests', 'SELECT * FROM vault_access_log']) {
        await assert.rejects(client.query(sql), REFUS, sql)
      }
    } finally {
      await client.query('RESET ROLE')
      client.release()
    }
  })
})
