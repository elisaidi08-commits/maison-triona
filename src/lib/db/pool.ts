import pg from 'pg'
import type { Pool } from 'pg'

import { coffrePoolConfigFromEnv, poolConfigFromEnv } from './config.ts'

const { Pool: PgPool } = pg

const globalForPool = globalThis as unknown as {
  __maisonTrionaPool?: Pool
  __maisonTrionaCoffrePool?: Pool
}

// Un seul pool par processus et par compte, conservé sur globalThis pour survivre au rechargement
// à chaud. `getPool` : site public (DATABASE_URL, insertion seule) ; `getCoffrePool` : espace
// /coffre (COFFRE_DATABASE_URL, rôle `coffre`). Jamais l'un pour l'autre.
export function getPool(): Pool {
  globalForPool.__maisonTrionaPool ??= new PgPool(poolConfigFromEnv(process.env))
  return globalForPool.__maisonTrionaPool
}

export function getCoffrePool(): Pool {
  globalForPool.__maisonTrionaCoffrePool ??= new PgPool(coffrePoolConfigFromEnv(process.env))
  return globalForPool.__maisonTrionaCoffrePool
}
