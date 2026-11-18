import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Pool } from 'pg'

import { withTransaction } from './transaction.ts'

const MIGRATION_FILE = /^\d{4}_.+\.sql$/

// Applique les migrations `NNNN_nom.sql` du dossier, dans l'ordre, et renvoie les versions
// appliquées par cet appel. Un verrou consultatif empêche deux exécutions simultanées.
export async function migrate(pool: Pool, dir: string): Promise<string[]> {
  const lockClient = await pool.connect()
  try {
    await lockClient.query("SELECT pg_advisory_lock(hashtext('maison-triona:migrations'))")
    try {
      await lockClient.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
          version text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )`,
      )

      const files = (await readdir(dir)).filter((name) => MIGRATION_FILE.test(name)).sort()
      const applied: string[] = []

      for (const file of files) {
        const version = file.slice(0, -'.sql'.length)
        const sql = await readFile(join(dir, file), 'utf8')
        const checksum = createHash('sha256').update(sql).digest('hex')

        const { rows } = await lockClient.query<{ checksum: string }>(
          'SELECT checksum FROM schema_migrations WHERE version = $1',
          [version],
        )
        const existing = rows[0]
        if (existing) {
          if (existing.checksum !== checksum) {
            throw new Error(`Migration modifiée après application : ${version}`)
          }
          continue
        }

        await withTransaction(pool, async (client) => {
          await client.query(sql)
          await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
            version,
            checksum,
          ])
        })
        applied.push(version)
      }

      return applied
    } finally {
      await lockClient.query("SELECT pg_advisory_unlock(hashtext('maison-triona:migrations'))")
    }
  } finally {
    lockClient.release()
  }
}
