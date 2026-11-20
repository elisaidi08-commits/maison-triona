import type { Pool, PoolClient } from 'pg'

import { withTransaction } from '../db/transaction.ts'
import { isUuid, LIST_LOG_WINDOW_S, VaultError } from '../vault/repository.ts'
import { EARLIER_TO_QUALIFY_LIMIT, type BookingStatus, type Qualification } from './agenda.ts'
import {
  cancelBooking,
  houseAccess,
  moveBooking,
  readCallWithSlots,
  type CancelResult,
  type ManagedCall,
  type MoveResult,
} from './bookings.ts'
import type { CallPhase } from './manage.ts'
import type { Slot } from './slots.ts'

// Agenda des appels de Cat (story 3.13 ; docs/reservation-appel.md §3.2 ; db/migrations/0013_agenda.sql),
// rôle `coffre`, sans ORM, dans le style de src/lib/vault/repository.ts : requêtes paramétrées, erreurs
// réduites à leur code (VaultError). Chaque lecture et chaque action est inscrite au journal d'accès
// dans la même transaction, au nom du compte, sans contenu (ni nom, ni numéro, ni heure, ni statut) :
// - `listAgendaLogged` : heures, statuts et rattachements (`booking_list`, une ligne par affichage) ;
// - `readBookingsSealed` : octets scellés, ouverts dans le navigateur (`booking_read`, une par appel) ;
// - `setBookingStatus` : « fait » ou « pas de réponse » (`booking_status`) ;
// - `attachBooking` : rattachement à une demande, ou retrait (`booking_attach`) ;
// - story 3.11 : `moveBookingByHouse` (`booking_move`), `cancelBookingByHouse` (`booking_cancel`),
//   `deleteBooking` (`booking_delete`, effacement à la demande de la personne). `readCallForHouse`
//   lit la page d'un appel (heures, statut, créneaux où le déplacer), sans contenu et sans journal,
//   comme la page d'une demande.
// Ce qui ne change rien (même statut, même rattachement, même créneau) n'écrit rien, journal compris.

type Db = Pool | PoolClient

const CONTROLE = '23514'
const CLE_ETRANGERE = '23503'

export { EARLIER_TO_QUALIFY_LIMIT }

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
 * corrige un clic). La condition est dans la requête ; le déclencheur de 0013 la double sous tout
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

export interface AttachedCall {
  id: string
  startsAt: Date
  endsAt: Date
  status: BookingStatus
}

/**
 * Appels rattachés à une demande, pour sa page du coffre : heures et statut seulement, jamais
 * `sealed`. Sans journal, comme les colonnes de la demande (`getRequest`) : Next 16 peut rendre une
 * page deux fois ; rien de la personne n'est lu. Sert à l'effacement (docs/rgpd/procedures.md) :
 * Cat voit qu'un appel existe avant d'effacer la demande.
 */
export async function listCallsOfRequest(pool: Pool, requestId: string): Promise<AttachedCall[]> {
  if (!isUuid(requestId)) return []
  return guard('listCallsOfRequest', async () => {
    const { rows } = await pool.query<{
      id: string
      starts_at: Date
      ends_at: Date
      status: BookingStatus
    }>(
      `SELECT id, starts_at, ends_at, status FROM bookings
       WHERE request_id = $1 ORDER BY starts_at, id`,
      [requestId],
    )
    return rows.map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
    }))
  })
}

// --- Déplacer, annuler, effacer depuis le coffre (story 3.11 ; docs/reservation-appel.md §3.2) ---

export interface HouseCall {
  call: ManagedCall
  phase: CallPhase
  /** Créneaux où l'appel peut aller (sans lui), seulement s'il se déplace encore. */
  slots: Slot[]
}

/**
 * Page d'un appel dans le coffre : heures, statut, séquence, et les créneaux où le déplacer (mêmes
 * règles que la page publique : délai minimal, horizon, plafond, absences). Jamais `sealed`. Sans
 * journal : rien de la personne n'est lu, et Next 16 peut rendre une page deux fois par requête.
 */
export async function readCallForHouse(
  pool: Pool,
  id: string,
  now: Date,
): Promise<HouseCall | null> {
  if (!isUuid(id)) return null
  assertValidDate(now, 'Date')
  return guard('readCallForHouse', () => readCallWithSlots(pool, id.toLowerCase(), now))
}

/**
 * Déplacer depuis le coffre, au nom du compte : une ligne `booking_move` (l'appel, rien d'autre) dans
 * la même transaction que le déplacement. Aucun message ne part (boîte d'envoi : story 3.12) ; le lien
 * de gestion de la personne montre la nouvelle heure.
 */
export async function moveBookingByHouse(
  pool: Pool,
  id: string,
  start: Date,
  actor: string,
  now: Date,
): Promise<MoveResult> {
  assertValidDate(start, 'Début')
  assertValidDate(now, 'Date')
  if (!isUuid(id)) return { status: 'not-found' }
  return moveBooking(
    pool,
    'moveBookingByHouse',
    houseAccess(id.toLowerCase()),
    { start, now },
    async (client, call) => {
      await client.query(
        "INSERT INTO vault_access_log (actor, action, booking_id) VALUES ($1, 'booking_move', $2)",
        [actor, call.id],
      )
    },
  )
}

/** Annuler depuis le coffre : « annulé par la maison », une ligne `booking_cancel`. */
export async function cancelBookingByHouse(
  pool: Pool,
  id: string,
  actor: string,
  now: Date,
): Promise<CancelResult> {
  assertValidDate(now, 'Date')
  if (!isUuid(id)) return 'not-found'
  const result = await cancelBooking(
    pool,
    'cancelBookingByHouse',
    houseAccess(id.toLowerCase()),
    { now },
    async (client, bookingId) => {
      await client.query(
        "INSERT INTO vault_access_log (actor, action, booking_id) VALUES ($1, 'booking_cancel', $2)",
        [actor, bookingId],
      )
    },
  )
  return result
}

/**
 * Effacer un appel (procédure RGPD, docs/rgpd/procedures.md, droit à l'effacement), quel que soit son
 * statut : la réservation (contenu scellé compris), son lien de gestion (clé étrangère) et son lien
 * d'accès, dans une transaction avec la ligne `booking_delete` (l'identifiant seul, qui survit à
 * l'appel pour rejouer l'effacement après une restauration de sauvegarde). Faux si l'appel n'existe
 * pas.
 */
export async function deleteBooking(pool: Pool, id: string, actor: string): Promise<boolean> {
  if (!isUuid(id)) return false
  return guard('deleteBooking', () =>
    withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ access_token_id: string | null }>(
        'DELETE FROM bookings WHERE id = $1 RETURNING access_token_id',
        [id.toLowerCase()],
      )
      const row = rows[0]
      if (!row) return false
      if (row.access_token_id) {
        await client.query('DELETE FROM booking_tokens WHERE id = $1', [row.access_token_id])
      }
      await client.query(
        "INSERT INTO vault_access_log (actor, action, booking_id) VALUES ($1, 'booking_delete', $2)",
        [actor, id.toLowerCase()],
      )
      return true
    }),
  )
}
