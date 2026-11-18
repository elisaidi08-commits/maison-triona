import pg from 'pg'
import type { Pool } from 'pg'

const { Pool: PgPool } = pg

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/maison_triona_test'

// Garde-fou : on ne vide jamais qu'une base dont le nom finit par _test.
export function assertTestDatabase(url: string): void {
  let name = ''
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
  } catch {
    // URL illisible : on refuse sans la citer.
  }
  if (!name.endsWith('_test')) {
    throw new Error('Base refusée : le nom de la base de test doit finir par _test')
  }
}

export function testPool(): Pool {
  return new PgPool({ connectionString: TEST_DATABASE_URL, max: 5 })
}

export async function resetDatabase(pool: Pool): Promise<void> {
  assertTestDatabase(TEST_DATABASE_URL)
  await pool.query('DROP SCHEMA public CASCADE')
  await pool.query('CREATE SCHEMA public')
}
