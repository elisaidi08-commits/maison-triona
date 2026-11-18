import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

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

// Rôles de connexion (db/roles/*.sql, partie B et partie C), créés dans le serveur de test (les
// rôles PostgreSQL sont communs à toutes les bases) et appliqués après les migrations.
const ROLES = ['site_public', 'coffre'] as const

export async function applyRoles(pool: Pool): Promise<void> {
  for (const role of ROLES) {
    await pool.query(
      await readFile(fileURLToPath(new URL(`../../db/roles/${role}.sql`, import.meta.url)), 'utf8'),
    )
  }
}

// Connexion qui prend le rôle dès l'ouverture, comme le compte de l'espace /coffre.
export function coffrePool(): Pool {
  return new PgPool({ connectionString: TEST_DATABASE_URL, options: '-c role=coffre', max: 5 })
}

// Même chose, sous forme d'URL (sous-processus : scripts/coffre-compte.mjs).
export const COFFRE_TEST_DATABASE_URL = `${TEST_DATABASE_URL}${TEST_DATABASE_URL.includes('?') ? '&' : '?'}options=-c%20role%3Dcoffre`
