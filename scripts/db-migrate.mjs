// Applique les migrations du coffre (jamais pendant le build). Usage : npm run db:migrate
import { fileURLToPath } from 'node:url'

import { migrate } from '../src/lib/db/migrate.ts'
import { getPool } from '../src/lib/db/pool.ts'

const dir = fileURLToPath(new URL('../db/migrations', import.meta.url))
const pool = getPool()

try {
  const applied = await migrate(pool, dir)
  console.log(
    applied.length > 0
      ? `Migrations appliquées : ${applied.join(', ')}`
      : 'Aucune migration en attente',
  )
} catch (error) {
  // Uniquement le message : jamais l'URL de connexion.
  console.error(error instanceof Error ? error.message : 'Échec de la migration')
  process.exitCode = 1
} finally {
  await pool.end()
}
