import type { Pool, PoolClient } from 'pg'

import { withTransaction } from '../db/transaction.ts'
import { guard, isUuid } from '../vault/repository.ts'

// Accès aux données de la boîte d'envoi (story 3.3, db/migrations/0006_boite_envoi.sql). Une ligne
// ne porte qu'un gabarit, des identifiants, des dates et des statuts : aucune adresse, aucun
// contenu de demande. Requêtes paramétrées uniquement ; les erreurs de PostgreSQL passent par
// `guard` (code et contrainte seulement) et les arguments refusés ne sont jamais cités.
// `enqueueNotification` sert au site public (rôle `site_public`, INSERT seul) ; le reste au rôle
// `envoi` (premier essai après la réponse, puis tâche planifiée toutes les 5 minutes), y compris
// `enqueueCapAlert` (alerte du plafond de notifications, migration 0009).

export type OutboxTemplate = 'request_notification' | 'technical_alert'
/** Alertes sur un message de la boîte d'envoi : elles portent son identifiant (`alert_subject`). */
export type MessageAlertEvent = 'send_failed' | 'undelivered' | 'tracking_expired'
/**
 * `notify_cap` : premier dépassement du jour du plafond de notifications (3.3, suites, décision de
 * Sady du 19/11/2026). Elle ne porte aucun identifiant : ni message, ni demande.
 */
export type AlertEvent = MessageAlertEvent | 'notify_cap'
export type DeliveryOutcome = 'delivered' | 'undelivered'

export interface OutboxItem {
  id: string
  template: OutboxTemplate
  requestId: string | null
  priority: boolean
  alertEvent: AlertEvent | null
  alertSubject: string | null
  attempts: number
  createdAt: Date
}

export interface AcceptedItem {
  id: string
  template: OutboxTemplate
  providerId: string
  acceptedAt: Date
}

const MAX_LIMIT = 100

// Codes courts seulement (`http_503`, `timeout`, `network`…), jamais un message brut.
const ERROR_CODE = /^[a-z0-9_]{1,60}$/
const PROVIDER_ID = /^[A-Za-z0-9._:-]{1,100}$/
const FLAG = /^[a-z_]{1,40}$/
const MAX_FLAGS = 20
const OUTCOMES: readonly string[] = ['delivered', 'undelivered']
// Événements d'une alerte écrite par le suivi ou l'échec d'un message : jamais `notify_cap`.
const MESSAGE_ALERT_EVENTS: readonly string[] = ['send_failed', 'undelivered', 'tracking_expired']

const ITEM_COLUMNS =
  'id, template, request_id, priority, alert_event, alert_subject, attempts, created_at'

// Réservation sans course : une passe de la tâche et le premier essai peuvent tomber ensemble, et
// Vercel peut lancer la tâche deux fois. `SKIP LOCKED` écarte les lignes qu'une autre passe est en
// train de réserver ; le bail de 2 minutes écarte celles qu'elle a déjà réservées.
// `attempts < 10` : la table plafonne `attempts` à 10. Un message à bout de tentatives (envois
// interrompus à répétition) n'est plus réservé, sinon l'incrément violerait la contrainte et ferait
// échouer toute la passe.
function claimQuery(extraFilter: string): string {
  return `UPDATE outbox
   SET lease_until = $1::timestamptz + interval '2 minutes', attempts = attempts + 1
 WHERE id IN (
   SELECT id FROM outbox
    WHERE status = 'pending' AND next_attempt_at <= $1
      AND (lease_until IS NULL OR lease_until <= $1)
      AND attempts < 10${extraFilter}
    ORDER BY next_attempt_at
    LIMIT $2
    FOR UPDATE SKIP LOCKED)
RETURNING ${ITEM_COLUMNS}`
}

const CLAIM_DUE = claimQuery('')
const CLAIM_ONE = claimQuery('\n      AND id = $3')

const INSERT_ALERT = `INSERT INTO outbox (id, template, alert_event, alert_subject)
  VALUES ($1, 'technical_alert', $2, $3)`

interface ItemRow {
  id: string
  template: OutboxTemplate
  request_id: string | null
  priority: boolean
  alert_event: AlertEvent | null
  alert_subject: string | null
  attempts: number
  created_at: Date
}

interface AcceptedRow {
  id: string
  template: OutboxTemplate
  provider_id: string
  accepted_at: Date
}

function toItem(row: ItemRow): OutboxItem {
  return {
    id: row.id,
    template: row.template,
    requestId: row.request_id,
    priority: row.priority,
    alertEvent: row.alert_event,
    alertSubject: row.alert_subject,
    attempts: Number(row.attempts),
    createdAt: row.created_at,
  }
}

// Une alerte n'est due que si la ligne a bien changé (gabarit rendu par l'UPDATE) et n'est pas
// elle-même une alerte technique : jamais d'alerte sur une alerte.
function needsAlert(template: OutboxTemplate | undefined): boolean {
  return template !== undefined && template !== 'technical_alert'
}

// Validation avant toute requête : RangeError, sans jamais citer la valeur refusée.
function assertId(id: string, label: string): void {
  if (typeof id !== 'string' || !isUuid(id)) throw new RangeError(`${label} invalide`)
}

function assertDate(date: Date, label: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError(`${label} invalide`)
  }
}

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new RangeError(`Nombre de lignes invalide : entier de 1 à ${MAX_LIMIT} attendu`)
  }
}

function assertCode(code: string): void {
  if (typeof code !== 'string' || !ERROR_CODE.test(code)) {
    throw new RangeError('Code d’erreur invalide : code court attendu')
  }
}

// Notification d'une demande, écrite dans la transaction de la demande (`client`). Sans
// RETURNING : le rôle `site_public` n'a aucun droit de lecture, et l'identifiant vient de
// l'application (`crypto.randomUUID()`).
export async function enqueueNotification(
  client: PoolClient,
  item: { id: string; requestId: string; priority: boolean },
): Promise<void> {
  assertId(item.id, 'Identifiant du message')
  assertId(item.requestId, 'Identifiant de la demande')
  if (typeof item.priority !== 'boolean') throw new RangeError('Priorité invalide')
  await guard('enqueueNotification', () =>
    client.query(
      `INSERT INTO outbox (id, template, request_id, priority)
       VALUES ($1, 'request_notification', $2, $3)`,
      [item.id, item.requestId, item.priority],
    ),
  )
}

// Alerte du premier dépassement du jour du plafond de notifications, écrite par le rôle `envoi`
// (le site public n'a aucun droit sur les colonnes d'alerte) puis envoyée tout de suite par
// `sendNow` ; la tâche planifiée la reprend comme tout message. Aucun identifiant de message ni de
// demande : l'alerte ne concerne aucune ligne. L'appelant garantit qu'il n'y en a qu'une par jour.
export async function enqueueCapAlert(pool: Pool, id: string): Promise<void> {
  assertId(id, 'Identifiant de l’alerte')
  await guard('enqueueCapAlert', () => pool.query(INSERT_ALERT, [id, 'notify_cap', null]))
}

// Réserve jusqu'à `limit` messages dus (bail de 2 minutes) et compte la tentative.
export async function claimDue(pool: Pool, now: Date, limit: number): Promise<OutboxItem[]> {
  assertDate(now, 'Date de réservation')
  assertLimit(limit)
  return guard('claimDue', async () => {
    const { rows } = await pool.query<ItemRow>(CLAIM_DUE, [now, limit])
    return rows.map(toItem)
  })
}

// Même réservation pour un seul message (premier essai) : null s'il n'est pas dû, s'il est déjà
// réservé ou s'il n'est plus en attente.
export async function claimOne(pool: Pool, id: string, now: Date): Promise<OutboxItem | null> {
  assertId(id, 'Identifiant du message')
  assertDate(now, 'Date de réservation')
  return guard('claimOne', async () => {
    const { rows } = await pool.query<ItemRow>(CLAIM_ONE, [now, 1, id])
    const row = rows[0]
    return row ? toItem(row) : null
  })
}

// Les trois marquages qui suivent ne touchent qu'un message en attente et lèvent le bail.
export async function markAccepted(
  pool: Pool,
  id: string,
  providerId: string,
  now: Date,
): Promise<void> {
  assertId(id, 'Identifiant du message')
  if (typeof providerId !== 'string' || !PROVIDER_ID.test(providerId)) {
    throw new RangeError('Identifiant du prestataire invalide')
  }
  assertDate(now, 'Date d’acceptation')
  await guard('markAccepted', () =>
    pool.query(
      `UPDATE outbox
          SET status = 'accepted', provider_id = $2, accepted_at = $3, lease_until = NULL,
              last_error = NULL
        WHERE id = $1 AND status = 'pending'`,
      [id, providerId, now],
    ),
  )
}

export async function markRetry(pool: Pool, id: string, code: string, nextAt: Date): Promise<void> {
  assertId(id, 'Identifiant du message')
  assertCode(code)
  assertDate(nextAt, 'Date de la prochaine tentative')
  await guard('markRetry', () =>
    pool.query(
      `UPDATE outbox
          SET lease_until = NULL, last_error = $2, next_attempt_at = $3
        WHERE id = $1 AND status = 'pending'`,
      [id, code, nextAt],
    ),
  )
}

// Échec définitif. `alertId` non nul : l'alerte `send_failed` est écrite dans la même transaction,
// seulement si le message était encore en attente (pas d'alerte en double) et n'est pas lui-même
// une alerte (jamais d'alerte sur une alerte, même si l'appelant en demande une).
export async function markFailed(
  pool: Pool,
  id: string,
  code: string,
  alertId: string | null,
): Promise<void> {
  assertId(id, 'Identifiant du message')
  assertCode(code)
  if (alertId !== null) assertId(alertId, 'Identifiant de l’alerte')
  await guard('markFailed', () =>
    withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ template: OutboxTemplate }>(
        `UPDATE outbox
            SET status = 'failed', lease_until = NULL, last_error = $2
          WHERE id = $1 AND status = 'pending'
        RETURNING template`,
        [id, code],
      )
      if (alertId !== null && needsAlert(rows[0]?.template)) {
        await client.query(INSERT_ALERT, [alertId, 'send_failed', id])
      }
    }),
  )
}

// Messages à bout de tentatives (10, plafond de la table : envois interrompus à répétition, que la
// réservation ne reprend plus) : échec `exhausted` hors bail, et une alerte `send_failed` pour
// chacun, sauf pour une alerte. Une seule transaction ; renvoie le nombre de messages passés en échec.
export async function failExhausted(pool: Pool, now: Date, newId: () => string): Promise<number> {
  assertDate(now, 'Date de contrôle')
  if (typeof newId !== 'function') throw new RangeError('Générateur d’identifiants invalide')
  return guard('failExhausted', () =>
    withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ id: string; template: OutboxTemplate }>(
        `UPDATE outbox
            SET status = 'failed', lease_until = NULL, last_error = 'exhausted'
          WHERE status = 'pending' AND attempts >= 10
            AND (lease_until IS NULL OR lease_until <= $1)
        RETURNING id, template`,
        [now],
      )
      for (const row of rows) {
        if (row.template === 'technical_alert') continue
        await client.query(INSERT_ALERT, [newId(), 'send_failed', row.id])
      }
      return rows.length
    }),
  )
}

// Messages acceptés par le prestataire, dont la livraison reste à suivre : les plus anciens d'abord.
export async function listAccepted(pool: Pool, limit: number): Promise<AcceptedItem[]> {
  assertLimit(limit)
  return guard('listAccepted', async () => {
    const { rows } = await pool.query<AcceptedRow>(
      `SELECT id, template, provider_id, accepted_at FROM outbox
        WHERE status = 'accepted'
        ORDER BY accepted_at, id
        LIMIT $1`,
      [limit],
    )
    return rows.map((row) => ({
      id: row.id,
      template: row.template,
      providerId: row.provider_id,
      acceptedAt: row.accepted_at,
    }))
  })
}

// Issue de la livraison d'un message accepté. `alertId` non nul : l'alerte (`alertEvent`) est
// écrite dans la même transaction, seulement si le message était encore accepté et n'est pas
// lui-même une alerte.
export async function recordDelivery(
  pool: Pool,
  id: string,
  outcome: DeliveryOutcome,
  flags: string[],
  alertId: string | null,
  alertEvent: MessageAlertEvent | null,
): Promise<void> {
  assertId(id, 'Identifiant du message')
  if (!OUTCOMES.includes(outcome)) throw new RangeError('Issue de livraison invalide')
  if (
    !Array.isArray(flags) ||
    flags.length > MAX_FLAGS ||
    !flags.every((flag) => typeof flag === 'string' && FLAG.test(flag))
  ) {
    throw new RangeError('Indicateur du prestataire invalide')
  }
  if (alertEvent !== null && !MESSAGE_ALERT_EVENTS.includes(alertEvent)) {
    throw new RangeError('Événement d’alerte invalide')
  }
  if (alertId !== null) {
    assertId(alertId, 'Identifiant de l’alerte')
    if (alertEvent === null) throw new RangeError('Événement d’alerte manquant')
  }
  await guard('recordDelivery', () =>
    withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ template: OutboxTemplate }>(
        `UPDATE outbox SET status = $2, provider_flags = $3
          WHERE id = $1 AND status = 'accepted'
        RETURNING template`,
        [id, outcome, flags],
      )
      if (alertId !== null && needsAlert(rows[0]?.template)) {
        await client.query(INSERT_ALERT, [alertId, alertEvent, id])
      }
    }),
  )
}

// Efface les lignes créées avant `before` (conservation : 30 jours, schedule.ts) ; renvoie le
// nombre de lignes effacées.
export async function purgeOutbox(pool: Pool, before: Date): Promise<number> {
  assertDate(before, 'Date de purge')
  return guard('purgeOutbox', async () => {
    const { rowCount } = await pool.query('DELETE FROM outbox WHERE created_at < $1', [before])
    return rowCount ?? 0
  })
}
