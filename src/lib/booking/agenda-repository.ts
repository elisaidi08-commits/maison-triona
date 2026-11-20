import type { Pool, PoolClient } from 'pg'

import { withTransaction } from '../db/transaction.ts'
import { isUuid, LIST_LOG_WINDOW_S, VaultError } from '../vault/repository.ts'
import type { BookingStatus, Qualification } from './agenda.ts'

// Agenda des appels de Cat (story 3.13 ; docs/reservation-appel.md §3.2 ; db/migrations/0012_agenda.sql),
// rôle `coffre`, sans ORM, dans le style de src/lib/vault/repository.ts : requêtes paramétrées, erreurs
// réduites à leur code (VaultError). Chaque lecture et chaque action est inscrite au journal d'accès
// dans la même transaction, au nom du compte, sans contenu (ni nom, ni numéro, ni heure, ni statut) :
// - `listAgendaLogged` : heures, statuts et rattachements (`booking_list`, une ligne par affichage) ;
// - `readBookingsSealed` : octets scellés, ouverts dans le navigateur (`booking_read`, une par appel) ;
// - `setBookingStatus` : « fait » ou « pas de réponse » (`booking_status`) ;
// - `attachBooking` : rattachement à une demande, ou retrait (`booking_attach`).
// Ce qui ne change rien (même statut, même rattachement) n'écrit rien, journal compris.

type Db = Pool | PoolClient

const CONTROLE = '23514'
const CLE_ETRANGERE = '23503'

/** Appels plus anciens que la vue, encore « à qualifier », montrés au plus. */
export const EARLIER_TO_QUALIFY_LIMIT = 50

export interface AgendaCall {
  id: string
  startsAt: Date
  endsAt: Date
  status: BookingStatus
  /** Demande rattachée, et sa date de réception (colonne en clair) ; null sans rattachement. */
  requestId: string | null
  requestCreatedAt: Date | null
}

export interface AgendaListing {
  /** Appels qui commencent dans la période, du plus tôt au plus tard, tous statuts. */
  calls: AgendaCall[]
  /** Appels confirmés finis avant la période, jamais qualifiés : « à qualifier ». */
  earlierToQualify: AgendaCall[]
}

interface CallRow {
  id: string
  starts_at: Date
  ends_at: Date
  status: BookingStatus
  request_id: string | null
  request_created_at: Date | null
}

const CALL_COLUMNS = `b.id, b.starts_at, b.ends_at, b.status, b.request_id,
  r.created_at AS request_created_at`

async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw error instanceof VaultError ? error : new VaultError(operation, error)
  }
}

function assertValidDate(date: Date, label: string): void {
  if (Number.isNaN(date.getTime())) throw new RangeError(`${label} invalide`)
}

function toCall(row: CallRow): AgendaCall {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    requestId: row.request_id,
    requestCreatedAt: row.request_created_at,
  }
}

async function selectCalls(
  db: Db,
  where: string,
  params: unknown[],
  tail = '',
): Promise<AgendaCall[]> {
  const { rows } = await db.query<CallRow>(
    `SELECT ${CALL_COLUMNS}
     FROM bookings AS b LEFT JOIN vault_requests AS r ON r.id = b.request_id
     WHERE ${where} ${tail}`,
    params,
  )
  return rows.map(toCall)
}

/**
 * Agenda de la période [from, to) : les appels qui y commencent, et ceux d'avant restés « à
 * qualifier » (confirmés, finis avant `now`). Jamais `sealed`. Une ligne `booking_list` par
 * affichage : Next 16 (Cache Components) rend une page deux fois par requête, une ligne du même
 * compte de moins de 2 secondes en tient lieu ; le verrou consultatif par compte sérialise deux
 * rendus simultanés (comme `listRequestsLogged`).
 */
export async function listAgendaLogged(
  pool: Pool,
  actor: string,
  period: { from: Date; to: Date; now: Date },
): Promise<AgendaListing> {
  const { from, to, now } = period
  assertValidDate(from, 'Début de période')
  assertValidDate(to, 'Fin de période')
  assertValidDate(now, 'Date')
  if (from.getTime() >= to.getTime()) throw new RangeError('Période invalide')
  return guard('listAgendaLogged', () =>
    withTransaction(pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('maison-triona:agenda:' || $1))", [
        actor,
      ])
      await client.query(
        `INSERT INTO vault_access_log (actor, action)
         SELECT $1::text, 'booking_list'
         WHERE NOT EXISTS (
           SELECT 1 FROM vault_access_log
           WHERE action = 'booking_list' AND actor = $1::text
             AND at > now() - make_interval(secs => $2)
         )`,
        [actor, LIST_LOG_WINDOW_S],
      )
      const calls = await selectCalls(
        client,
        'b.starts_at >= $1 AND b.starts_at < $2',
        [from, to],
        'ORDER BY b.starts_at, b.id',
      )
      // Les plus récents d'abord pour la limite, puis remis dans l'ordre du temps.
      const earlier = await selectCalls(
        client,
        "b.status = 'confirmed' AND b.ends_at <= $1 AND b.starts_at < $2",
        [now, from, EARLIER_TO_QUALIFY_LIMIT],
        'ORDER BY b.starts_at DESC, b.id DESC LIMIT $3',
      )
      return { calls, earlierToQualify: earlier.reverse() }
    }),
  )
}

export interface SealedCall {
  id: string
  sealed: Uint8Array
}

/**
 * Octets scellés des appels demandés (à ouvrir dans le navigateur, jamais ici) ; une ligne
 * `booking_read` par appel rendu, dans la même transaction : pas de lecture sans trace. Un
 * identifiant inconnu ne rend rien et n'écrit rien.
 */
export async function readBookingsSealed(
  pool: Pool,
  ids: string[],
  actor: string,
): Promise<SealedCall[]> {
  const valid = [...new Set(ids.filter(isUuid).map((id) => id.toLowerCase()))]
  if (valid.length === 0) return []
  return guard('readBookingsSealed', () =>
    withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ id: string; sealed: Uint8Array }>(
        'SELECT id, sealed FROM bookings WHERE id = ANY ($1::uuid[]) ORDER BY starts_at, id',
        [valid],
      )
      if (rows.length === 0) return []
      await client.query(
        `INSERT INTO vault_access_log (actor, action, booking_id)
         SELECT $1, 'booking_read', unnest($2::uuid[])`,
        [actor, rows.map((row) => row.id)],
      )
      // Copies : le Buffer rendu par pg peut partager sa mémoire avec d'autres données.
      return rows.map((row) => ({ id: row.id, sealed: new Uint8Array(row.sealed) }))
    }),
  )
}

export type StatusResult = 'changed' | 'unchanged' | 'not-found' | 'refused'

/**
 * « Fait » ou « pas de réponse » (§3.2), pour un appel commencé, confirmé ou déjà qualifié (Cat
 * corrige un clic). La condition est dans la requête ; le déclencheur de 0012 la double sous tout
 * rôle. `unchanged` : déjà ce statut (double clic), rien n'est écrit.
 */
export async function setBookingStatus(
  pool: Pool,
  id: string,
  status: Qualification,
  actor: string,
): Promise<StatusResult> {
  if (!isUuid(id)) return 'not-found'
  if (status !== 'done' && status !== 'no_answer') throw new RangeError('Statut invalide')
  try {
    return await guard('setBookingStatus', () =>
      withTransaction(pool, async (client): Promise<StatusResult> => {
        const { rowCount } = await client.query(
          `UPDATE bookings SET status = $2
           WHERE id = $1 AND status <> $2 AND status IN ('confirmed', 'done', 'no_answer')
             AND starts_at <= now()`,
          [id, status],
        )
        if (rowCount === 1) {
          await client.query(
            "INSERT INTO vault_access_log (actor, action, booking_id) VALUES ($1, 'booking_status', $2)",
            [actor, id],
          )
          return 'changed'
        }
        const { rows } = await client.query<{ status: string }>(
          'SELECT status FROM bookings WHERE id = $1',
          [id],
        )
        if (!rows[0]) return 'not-found'
        return rows[0].status === status ? 'unchanged' : 'refused'
      }),
    )
  } catch (error) {
    if (error instanceof VaultError && error.code === CONTROLE) return 'refused'
    throw error
  }
}

export type AttachResult = 'attached' | 'detached' | 'unchanged' | 'not-found' | 'unknown-request'

/**
 * Rattache un appel à une demande du coffre, ou retire le rattachement (`requestId` nul). Une ligne
 * `booking_attach` : l'appel et la demande rattachée (nulle pour un retrait). La clé étrangère refuse
 * une demande inconnue (`unknown-request`) ; une demande effacée plus tard remet le rattachement à
 * nul (ON DELETE SET NULL).
 */
export async function attachBooking(
  pool: Pool,
  id: string,
  requestId: string | null,
  actor: string,
): Promise<AttachResult> {
  if (!isUuid(id)) return 'not-found'
  if (requestId !== null && !isUuid(requestId)) return 'unknown-request'
  try {
    return await guard('attachBooking', () =>
      withTransaction(pool, async (client): Promise<AttachResult> => {
        const { rowCount } = await client.query(
          `UPDATE bookings SET request_id = $2::uuid
           WHERE id = $1 AND request_id IS DISTINCT FROM $2::uuid`,
          [id, requestId],
        )
        if (rowCount === 1) {
          await client.query(
            `INSERT INTO vault_access_log (actor, action, booking_id, request_id)
             VALUES ($1, 'booking_attach', $2, $3)`,
            [actor, id, requestId],
          )
          return requestId === null ? 'detached' : 'attached'
        }
        const { rowCount: existe } = await client.query('SELECT 1 FROM bookings WHERE id = $1', [
          id,
        ])
        return existe ? 'unchanged' : 'not-found'
      }),
    )
  } catch (error) {
    if (error instanceof VaultError && error.code === CLE_ETRANGERE) return 'unknown-request'
    throw error
  }
}
