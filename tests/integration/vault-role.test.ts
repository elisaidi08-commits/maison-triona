import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { migrate } from '../../src/lib/db/migrate.ts'
import { insertRequest, listRequests } from '../../src/lib/vault/repository.ts'
import type { NewVaultRequest } from '../../src/lib/vault/repository.ts'
import { resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Rôle du site public (story 3.2 B, db/roles/site_public.sql) : il insère des demandes et rien
// d'autre. Ni lecture, ni modification, ni effacement, ni journal d'accès. Le rôle est créé dans le
// serveur de test (les rôles PostgreSQL sont communs à toutes les bases) ; le fichier est rejouable.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const ROLE = fileURLToPath(new URL('../../db/roles/site_public.sql', import.meta.url))
const REFUS = { code: '42501' }
const pool = testPool()
// Connexion qui prend le rôle dès l'ouverture, comme le ferait l'utilisateur du site public.
const restreint = new pg.Pool({
  connectionString: TEST_DATABASE_URL,
  options: '-c role=site_public',
  max: 2,
})

function demande(): NewVaultRequest {
  return {
    kind: 'request',
    service: 'enfants',
    country: 'FR',
    locale: 'fr',
    urgency: 'aucune',
    source: null,
    sealed: new Uint8Array(64).fill(1),
    retentionUntil: new Date('2028-01-01T00:00:00Z'),
    privacyVersion: '2026-11-18',
  }
}

describe('rôle site_public : insertion seule', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
    const sql = await readFile(ROLE, 'utf8')
    await pool.query(sql)
    // Rejouable : appliqué deux fois, il ne change rien.
    await pool.query(sql)
  })
  after(async () => {
    await restreint.end()
    await pool.end()
  })

  it('insère une demande, puis ne peut ni la lire, ni la modifier, ni l’effacer', async () => {
    const client = await pool.connect()
    try {
      await client.query('SET ROLE site_public')
      const id = await insertRequest(client, demande())
      for (const sql of [
        'SELECT id FROM vault_requests',
        'SELECT count(*) FROM vault_requests',
        "UPDATE vault_requests SET status = 'closed'",
        'DELETE FROM vault_requests',
        'TRUNCATE vault_requests',
        'SELECT * FROM vault_access_log',
        "INSERT INTO vault_access_log (actor, action) VALUES ('site', 'login')",
        'SELECT * FROM schema_migrations',
        'CREATE TABLE intrus (id int)',
      ]) {
        await assert.rejects(client.query(sql), REFUS, sql)
      }
      await client.query('RESET ROLE')
      assert.deepEqual(
        (await listRequests(pool)).map((ligne) => ligne.id),
        [id],
      )
    } finally {
      await client.query('RESET ROLE')
      client.release()
    }
  })

  it('suffit à l’accès aux données du site, transaction comprise', async () => {
    const { rows } = await restreint.query<{ role: string }>('SELECT current_user AS role')
    assert.equal(rows[0]?.role, 'site_public')
    const client = await restreint.connect()
    try {
      await client.query('BEGIN')
      await insertRequest(client, demande())
      await client.query('COMMIT')
    } finally {
      client.release()
    }
    await assert.rejects(restreint.query('SELECT sealed FROM vault_requests'), REFUS)
  })
})
