import type { Pool } from 'pg'

import { withTransaction } from '../db/transaction.ts'

// Accès aux données du coffre (story 3.2, partie A). Le contenu arrive déjà chiffré (`sealed`,
// octets de la sealed box) : ce module ne voit jamais de nom, de coordonnée ni de message.
// Requêtes paramétrées uniquement ; aucune erreur levée ne cite un argument ni des octets.

export type RequestKind = 'request' | 'urgent'
export type RequestStatus = 'new' | 'in_progress' | 'closed'
export type AccessAction = 'login' | 'read' | 'export' | 'delete' | 'purge' | 'freeze' | 'unfreeze'

export interface NewVaultRequest {
  kind: RequestKind
  service: string | null
  country: string | null
  locale: 'fr' | 'en'
  urgency: string | null
  source: string | null
  sealed: Uint8Array
  retentionUntil: Date
}

export interface VaultRequestSummary {
  id: string
  kind: RequestKind
  createdAt: Date
  service: string | null
  country: string | null
  locale: 'fr' | 'en'
  urgency: string | null
  source: string | null
  status: RequestStatus
  frozen: boolean
  retentionUntil: Date
}

export interface AccessLogEntry {
  at: Date
  actor: string
  action: AccessAction
  requestId: string | null
}

// Acteur des effacements automatiques (tâche planifiée de conservation).
export const SYSTEM_ACTOR = 'system'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDENTIFIER = /^[A-Za-z0-9_]{1,63}$/

const INSERT_LOG = 'INSERT INTO vault_access_log (actor, action, request_id) VALUES ($1, $2, $3)'

const SUMMARY_COLUMNS =
  'id, kind, created_at, service, country, locale, urgency, source, status, frozen, retention_until'

interface SummaryRow {
  id: string
  kind: RequestKind
  created_at: Date
  service: string | null
  country: string | null
  locale: 'fr' | 'en'
  urgency: string | null
  source: string | null
  status: RequestStatus
  frozen: boolean
  retention_until: Date
}

interface LogRow {
  at: Date
  actor: string
  action: AccessAction
  request_id: string | null
}

// Erreur du coffre sans contenu. PostgreSQL recopie la ligne refusée dans `detail` et certaines
// valeurs dans son message : on ne garde que le code (SQLSTATE) et le nom de la contrainte, et
// l'erreur d'origine n'est pas chaînée.
export class VaultError extends Error {
  readonly code: string | undefined
  readonly constraint: string | undefined

  constructor(operation: string, error: unknown) {
    const code = identifierField(error, 'code')
    super(`Coffre : ${operation} a échoué${code ? ` (${code})` : ''}`)
    this.name = 'VaultError'
    this.code = code
    this.constraint = identifierField(error, 'constraint')
  }
}

function identifierField(error: unknown, key: 'code' | 'constraint'): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const value = (error as Record<string, unknown>)[key]
  return typeof value === 'string' && IDENTIFIER.test(value) ? value : undefined
}

async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new VaultError(operation, error)
  }
}

function isUuid(id: string): boolean {
  return UUID.test(id)
}

function assertValidDate(date: Date, label: string): void {
  if (Number.isNaN(date.getTime())) throw new RangeError(`${label} invalide`)
}

function pageLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Nombre de lignes invalide : entier positif attendu')
  }
  return Math.min(limit, MAX_LIMIT)
}

function toSummary(row: SummaryRow): VaultRequestSummary {
  return {
    id: row.id,
    kind: row.kind,
    createdAt: row.created_at,
    service: row.service,
    country: row.country,
    locale: row.locale,
    urgency: row.urgency,
    source: row.source,
    status: row.status,
    frozen: row.frozen,
    retentionUntil: row.retention_until,
  }
}

// Enregistre une demande déjà chiffrée et renvoie son identifiant.
export async function insertRequest(pool: Pool, input: NewVaultRequest): Promise<string> {
  assertValidDate(input.retentionUntil, 'Échéance de conservation')
  return guard('insertRequest', async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO vault_requests
         (kind, service, country, locale, urgency, source, sealed, retention_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.kind,
        input.service,
        input.country,
        input.locale,
        input.urgency,
        input.source,
        input.sealed,
        input.retentionUntil,
      ],
    )
    const id = rows[0]?.id
    if (!id) throw new Error('Insertion sans identifiant')
    return id
  })
}

// Colonnes en clair seulement (jamais `sealed`), de la plus récente à la plus ancienne.
export async function listRequests(
  pool: Pool,
  options: { limit?: number; offset?: number } = {},
): Promise<VaultRequestSummary[]> {
  const limit = pageLimit(options.limit)
  const offset = options.offset ?? 0
  if (!Number.isInteger(offset) || offset < 0) {
    throw new RangeError('Décalage invalide : entier positif ou nul attendu')
  }
  return guard('listRequests', async () => {
    const { rows } = await pool.query<SummaryRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM vault_requests
       ORDER BY created_at DESC, id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    )
    return rows.map(toSummary)
  })
}

// Renvoie les octets chiffrés d'une demande et journalise la lecture dans la même transaction :
// pas de lecture sans trace. Demande inconnue : null, sans ligne de journal.
export async function readSealed(
  pool: Pool,
  id: string,
  actor: string,
): Promise<Uint8Array | null> {
  if (!isUuid(id)) return null
  return guard('readSealed', () =>
    withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ sealed: Uint8Array }>(
        'SELECT sealed FROM vault_requests WHERE id = $1',
        [id],
      )
      const row = rows[0]
      if (!row) return null
      await client.query(INSERT_LOG, [actor, 'read', id])
      // Copie : le Buffer rendu par pg peut partager sa mémoire avec d'autres données.
      return new Uint8Array(row.sealed)
    }),
  )
}

// Efface une demande ; la ligne `delete` du journal lui survit (pas de clé étrangère).
export async function deleteRequest(pool: Pool, id: string, actor: string): Promise<boolean> {
  if (!isUuid(id)) return false
  return guard('deleteRequest', () =>
    withTransaction(pool, async (client) => {
      const { rowCount } = await client.query('DELETE FROM vault_requests WHERE id = $1', [id])
      if (!rowCount) return false
      await client.query(INSERT_LOG, [actor, 'delete', id])
      return true
    }),
  )
}

// Limitation (RGPD art. 18) : une demande gelée échappe à l'effacement automatique.
export async function setFrozen(
  pool: Pool,
  id: string,
  frozen: boolean,
  actor: string,
): Promise<boolean> {
  if (!isUuid(id)) return false
  return guard('setFrozen', () =>
    withTransaction(pool, async (client) => {
      const { rowCount } = await client.query(
        'UPDATE vault_requests SET frozen = $2 WHERE id = $1',
        [id, frozen],
      )
      if (!rowCount) return false
      await client.query(INSERT_LOG, [actor, frozen ? 'freeze' : 'unfreeze', id])
      return true
    }),
  )
}

// Efface les demandes échues (`retention_until <= now`) non gelées et écrit une ligne `purge` par
// demande, au nom de `system`, dans une seule instruction. Renvoie les identifiants effacés.
export async function purgeExpired(pool: Pool, now: Date): Promise<string[]> {
  assertValidDate(now, 'Date de purge')
  return guard('purgeExpired', async () => {
    const { rows } = await pool.query<{ request_id: string }>(
      `WITH purged AS (
         DELETE FROM vault_requests
         WHERE retention_until <= $1 AND NOT frozen
         RETURNING id
       )
       INSERT INTO vault_access_log (actor, action, request_id)
       SELECT $2::text, 'purge', id FROM purged
       RETURNING request_id`,
      [now, SYSTEM_ACTOR],
    )
    return rows.map((row) => row.request_id)
  })
}

export async function logAccess(
  pool: Pool,
  entry: { actor: string; action: AccessAction; requestId?: string },
): Promise<void> {
  await guard('logAccess', () =>
    pool.query(INSERT_LOG, [entry.actor, entry.action, entry.requestId ?? null]),
  )
}

// Journal du plus récent au plus ancien, pour une demande ou pour tout le coffre.
export async function listAccessLog(
  pool: Pool,
  options: { requestId?: string; limit?: number } = {},
): Promise<AccessLogEntry[]> {
  const limit = pageLimit(options.limit)
  const requestId = options.requestId ?? null
  if (requestId !== null && !isUuid(requestId)) return []
  return guard('listAccessLog', async () => {
    const { rows } = await pool.query<LogRow>(
      `SELECT at, actor, action, request_id FROM vault_access_log
       WHERE $1::uuid IS NULL OR request_id = $1::uuid
       ORDER BY at DESC, id DESC
       LIMIT $2`,
      [requestId, limit],
    )
    return rows.map((row) => ({
      at: row.at,
      actor: row.actor,
      action: row.action,
      requestId: row.request_id,
    }))
  })
}
