import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { migrate } from '../../src/lib/db/migrate.ts'
import { insertRequest, listRequestsLogged } from '../../src/lib/vault/repository.ts'
import { applyRoles, coffrePool, resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Deux comptes, deux rôles (story 3.2, parties B et C ; docs/coffre-cles.md §3) : `site_public`
// insère des demandes et ne voit rien d'autre, aucune table de Better Auth comprise ; `coffre` a ce
// que l'espace /coffre exige, sans pouvoir modifier ni effacer une demande ou le journal.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const TABLES_AUTH = [
  '"user"',
  '"session"',
  '"account"',
  '"verification"',
  '"twoFactor"',
  '"rateLimit"',
]
const REFUS = { code: '42501' }
const admin = testPool()
const coffre = coffrePool()
const site = new pg.Pool({
  connectionString: TEST_DATABASE_URL,
  options: '-c role=site_public',
  max: 2,
})

function demande() {
  return {
    kind: 'request' as const,
    service: 'conciergerie',
    country: 'BE',
    locale: 'fr' as const,
    urgency: 'aucune',
    source: null,
    sealed: new Uint8Array(randomBytes(64)),
    retentionUntil: new Date('2028-01-01T00:00:00Z'),
    privacyVersion: '2026-11-18',
  }
}

describe('rôles de connexion du coffre', () => {
  before(async () => {
    await resetDatabase(admin)
    await migrate(admin, MIGRATIONS)
    // Rejouables, y compris site_public.sql après 0003_auth.sql.
    await applyRoles(admin)
    await applyRoles(admin)
    await admin.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('u1', 'Compte factice', 'u1@exemple.test', false)`,
    )
  })
  after(async () => {
    await site.end()
    await coffre.end()
    await admin.end()
  })

  it('site_public ne lit, n’écrit ni n’efface aucune table de Better Auth', async () => {
    for (const table of TABLES_AUTH) {
      for (const sql of [
        `SELECT * FROM ${table}`,
        `SELECT count(*) FROM ${table}`,
        `UPDATE ${table} SET id = id`,
        `DELETE FROM ${table}`,
        `TRUNCATE ${table}`,
      ]) {
        await assert.rejects(site.query(sql), REFUS, sql)
      }
    }
    await assert.rejects(
      site.query(
        `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('x', 'X', 'x@exemple.test', false)`,
      ),
      REFUS,
    )
    // Il garde son seul droit : insérer une demande.
    await insertRequest(site, demande())
  })

  it('coffre gère les comptes et les sessions, lit les demandes et écrit le journal', async () => {
    await coffre.query(
      `INSERT INTO "session" (id, "expiresAt", token, "updatedAt", "userId", "twoFactorVerified")
       VALUES ('s1', now() + interval '1 hour', 't1', now(), 'u1', false)`,
    )
    await coffre.query(`UPDATE "user" SET "twoFactorEnabled" = false WHERE id = 'u1'`)
    await coffre.query(`DELETE FROM "session" WHERE id = 's1'`)
    await insertRequest(admin, demande())
    const liste = await listRequestsLogged(coffre, 'u1@exemple.test')
    assert.ok(liste.length >= 1)
    const { rows } = await coffre.query('SELECT actor, action FROM vault_access_log')
    assert.deepEqual(rows.at(-1), { actor: 'u1@exemple.test', action: 'list' })
  })

  it('coffre ne modifie ni n’efface une demande ou le journal, ni rien d’autre', async () => {
    for (const sql of [
      "UPDATE vault_requests SET status = 'closed'",
      'DELETE FROM vault_requests',
      'TRUNCATE vault_requests',
      "UPDATE vault_access_log SET actor = 'x'",
      'DELETE FROM vault_access_log',
      'TRUNCATE vault_access_log',
      'SELECT * FROM schema_migrations',
      'CREATE TABLE intrus (id int)',
    ]) {
      await assert.rejects(coffre.query(sql), REFUS, sql)
    }
    await assert.rejects(insertRequest(coffre, demande()), REFUS)
  })
})
