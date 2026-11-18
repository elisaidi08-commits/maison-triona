import { randomUUID } from 'node:crypto'

import type { Pool, PoolClient } from 'pg'

import { withTransaction } from '../db/transaction.ts'

// Accès aux données du coffre (story 3.2, parties A et B). Le contenu arrive déjà chiffré (`sealed`,
// octets de la sealed box) : ce module ne voit jamais de nom, de coordonnée ni de message.
// Requêtes paramétrées uniquement ; aucune erreur levée ne cite un argument ni des octets.
// `insertRequest` est la seule fonction du site public : elle passe avec le rôle `site_public`
// (db/roles/site_public.sql), qui n'a que le droit d'insérer. Les autres servent au coffre (rôle
// `coffre`, db/roles/coffre.sql : lecture, effacement, gel, journal en insertion et lecture).

export type RequestKind = 'request' | 'urgent'
export type RequestStatus = 'new' | 'in_progress' | 'closed'
// Actions de connexion et de lecture de la liste : partie C (db/migrations/0003_auth.sql,
// 0004_journal_coffre.sql) ; résumé de la conservation planifiée : partie D (0005_conservation.sql).
export type AccessAction =
  | 'login'
  | 'login_backup_code'
  | 'login_failed'
  | 'password_ok'
  | 'totp_enrolled'
  | 'rate_limited'
  | 'logout'
  | 'list'
  | 'read'
  | 'export'
  | 'delete'
  | 'purge'
  | 'freeze'
  | 'unfreeze'
  | 'retention'

export interface NewVaultRequest {
  kind: RequestKind
  service: string | null
  country: string | null
  locale: 'fr' | 'en'
  urgency: string | null
  source: string | null
  sealed: Uint8Array
  retentionUntil: Date
  // Version de la politique de confidentialité acceptée (preuve du consentement, migration 0002).
  privacyVersion: string
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
  // Nulle pour une ligne antérieure à la migration 0002.
  privacyVersion: string | null
}

// Résumé d'un passage de la conservation planifiée : des nombres seulement (migration 0005).
export interface RetentionCounts {
  requests: number
  sessions: number
  rateLimits: number
  verifications: number
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
  'id, kind, created_at, service, country, locale, urgency, source, status, frozen, ' +
  'retention_until, privacy_version'

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
  privacy_version: string | null
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

/** Identifiant de demande bien formé (UUID). Une adresse qui n'en est pas un répond 404. */
export function isRequestId(id: unknown): id is string {
  return typeof id === 'string' && isUuid(id)
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
    privacyVersion: row.privacy_version,
  }
}

// Enregistre une demande déjà chiffrée et renvoie son identifiant. L'identifiant est tiré ici
// (UUID v4) et l'insertion se fait sans RETURNING : le rôle du site public n'a aucun droit de
// lecture. Accepte le client d'une transaction (`withTransaction`) : la boîte d'envoi (story 3.3)
// s'écrira avec la demande.
export async function insertRequest(
  db: Pool | PoolClient,
  input: NewVaultRequest,
): Promise<string> {
  assertValidDate(input.retentionUntil, 'Échéance de conservation')
  const id = randomUUID()
  await guard('insertRequest', () =>
    db.query(
      `INSERT INTO vault_requests
         (id, kind, service, country, locale, urgency, source, sealed, retention_until,
          privacy_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.kind,
        input.service,
        input.country,
        input.locale,
        input.urgency,
        input.source,
        input.sealed,
        input.retentionUntil,
        input.privacyVersion,
      ],
    ),
  )
  return id
}

function pageOffset(offset: number | undefined): number {
  const value = offset ?? 0
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError('Décalage invalide : entier positif ou nul attendu')
  }
  return value
}

async function selectSummaries(
  db: Pool | PoolClient,
  limit: number,
  offset: number,
): Promise<VaultRequestSummary[]> {
  const { rows } = await db.query<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM vault_requests
     ORDER BY created_at DESC, id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  return rows.map(toSummary)
}

// Colonnes en clair seulement (jamais `sealed`), de la plus récente à la plus ancienne.
export async function listRequests(
  pool: Pool,
  options: { limit?: number; offset?: number } = {},
): Promise<VaultRequestSummary[]> {
  const limit = pageLimit(options.limit)
  const offset = pageOffset(options.offset)
  return guard('listRequests', () => selectSummaries(pool, limit, offset))
}

// Même liste, pour l'accueil du coffre : la lecture est journalisée (`list`, sans identifiant de
// demande) dans la même transaction. Pas de lecture sans trace.
export async function listRequestsLogged(
  pool: Pool,
  actor: string,
  options: { limit?: number; offset?: number } = {},
): Promise<VaultRequestSummary[]> {
  const limit = pageLimit(options.limit)
  const offset = pageOffset(options.offset)
  return guard('listRequestsLogged', () =>
    withTransaction(pool, async (client) => {
      await client.query(INSERT_LOG, [actor, 'list', null])
      return selectSummaries(client, limit, offset)
    }),
  )
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

// Colonnes en clair d'une demande, pour sa page du coffre (partie D) : les mêmes que la liste, jamais
// `sealed`. Sans journal : Next 16 (Cache Components) peut rendre une page deux fois par requête,
// une écriture pendant le rendu doublerait la ligne. La lecture journalisée est la remise des
// octets scellés (`readSealed`), par une action serveur, une fois par déverrouillage.
export async function getRequest(pool: Pool, id: string): Promise<VaultRequestSummary | null> {
  if (!isUuid(id)) return null
  return guard('getRequest', async () => {
    const { rows } = await pool.query<SummaryRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM vault_requests WHERE id = $1`,
      [id],
    )
    return rows[0] ? toSummary(rows[0]) : null
  })
}

// Export d'une demande (partie D) : le fichier est composé dans le navigateur, le serveur n'en voit
// rien ; il ne reçoit que l'identifiant et inscrit `export` au journal, si la demande existe.
export async function logExport(pool: Pool, id: string, actor: string): Promise<boolean> {
  if (!isUuid(id)) return false
  return guard('logExport', async () => {
    const { rowCount } = await pool.query(
      `INSERT INTO vault_access_log (actor, action, request_id)
       SELECT $1, 'export', id FROM vault_requests WHERE id = $2`,
      [actor, id],
    )
    return Boolean(rowCount)
  })
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
// Même règle que `isExpired` (retention.ts). Accepte le client d'une transaction (conservation.ts).
export async function purgeExpired(db: Pool | PoolClient, now: Date): Promise<string[]> {
  assertValidDate(now, 'Date de purge')
  return guard('purgeExpired', async () => {
    const { rows } = await db.query<{ request_id: string }>(
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

// Résumé d'un passage de la conservation planifiée, au nom de `system` : des nombres, rien d'autre.
export async function logRetention(db: Pool | PoolClient, counts: RetentionCounts): Promise<void> {
  for (const value of Object.values(counts)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError('Résumé de conservation invalide : entiers positifs ou nuls attendus')
    }
  }
  await guard('logRetention', () =>
    db.query(
      `INSERT INTO vault_access_log
         (actor, action, purged_requests, purged_sessions, purged_rate_limits, purged_verifications)
       VALUES ($1, 'retention', $2, $3, $4, $5)`,
      [SYSTEM_ACTOR, counts.requests, counts.sessions, counts.rateLimits, counts.verifications],
    ),
  )
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

// Échecs de connexion depuis `since` : d'un compte (verrou par compte), ou de tous (disjoncteur).
export async function countRecentFailures(
  pool: Pool,
  since: Date,
  actor: string | null = null,
): Promise<number> {
  assertValidDate(since, 'Début de fenêtre')
  return guard('countRecentFailures', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM vault_access_log
       WHERE action = 'login_failed' AND at > $1 AND ($2::text IS NULL OR actor = $2)`,
      [since, actor],
    )
    return rows[0]?.n ?? 0
  })
}

// Réponse 429 journalisée une fois au plus par acteur (la route) depuis `since` : une rafale ne
// remplit pas le journal. Le verrou consultatif sérialise deux 429 simultanés. Vrai si écrit.
export async function logRateLimitedOnce(pool: Pool, actor: string, since: Date): Promise<boolean> {
  assertValidDate(since, 'Début de fenêtre')
  return guard('logRateLimitedOnce', () =>
    withTransaction(pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('maison-triona:limite:' || $1))", [
        actor,
      ])
      const { rowCount } = await client.query(
        `SELECT 1 FROM vault_access_log
         WHERE action = 'rate_limited' AND actor = $1 AND at > $2 LIMIT 1`,
        [actor, since],
      )
      if (rowCount) return false
      await client.query(INSERT_LOG, [actor, 'rate_limited', null])
      return true
    }),
  )
}
