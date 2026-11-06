import pg from 'pg'
import type { Pool } from 'pg'

import { poolConfigFromEnv } from './config.ts'

const { Pool: PgPool } = pg

const globalForPool = globalThis as unknown as { __maisonTrionaPool?: Pool }

// Un seul pool par processus, conservé sur globalThis pour survivre au rechargement à chaud.
export function getPool(): Pool {
  globalForPool.__maisonTrionaPool ??= new PgPool(poolConfigFromEnv(process.env))
  return globalForPool.__maisonTrionaPool
}
