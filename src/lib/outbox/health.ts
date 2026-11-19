import type { Pool } from 'pg'

import { emailConfigFromEnv } from '../email/config.ts'
import { guard } from '../vault/repository.ts'

// État de l'envoi des e-mails sur l'accueil du coffre (story 3.3, suites C, décision de Sady du
// 19/11/2026). Les journaux ne sont pas exportés (interdit) : sans ce bloc, une notification qui
// n'a pas pu s'écrire (`failed:outbox`), une tâche planifiée qui ne passe plus ou une clé de TEM
// révoquée (l'alerte à Sady échoue aussi) ne préviennent personne. Des comptes seulement : aucun
// contenu, aucun identifiant, aucun code d'erreur. Lu avec le rôle `coffre`, qui n'a sur `outbox`
// que la lecture de six colonnes (db/roles/coffre.sql).
// Imports relatifs seulement : testé par node --test.

/** Un message dû depuis plus longtemps : la tâche (toutes les 5 minutes) aurait dû le prendre. */
export const OUTBOX_LATE_MINUTES = 15

/** Fenêtre des échecs et des demandes sans notification (la boîte d'envoi garde 30 jours). */
export const OUTBOX_HEALTH_DAYS = 7

export interface OutboxHealth {
  /** Messages en attente, dus depuis plus de `OUTBOX_LATE_MINUTES`. */
  late: number
  /** Messages (notifications et alertes) en échec ou non délivrés, créés dans la fenêtre. */
  failed: number
  /** Demandes de la fenêtre sans notification dans la boîte d'envoi. */
  unnotified: number
}

export type EmailSendingState = 'on' | 'off' | 'incomplete'

const NBSP = ' '
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

// Une requête, trois comptes. Retard : en attente et dû avant `$1`. Échecs : `failed` ou
// `undelivered`, créés depuis `$2`. Sans notification : demandes créées depuis `$2` sans ligne
// `request_notification` à leur identifiant (notification qui n'a pas pu s'écrire, envoi coupé ou
// mal configuré au moment de la demande, plafond du jour atteint).
const HEALTH_QUERY = `SELECT
  (SELECT count(*) FROM outbox
    WHERE status = 'pending' AND next_attempt_at < $1)::int AS late,
  (SELECT count(*) FROM outbox
    WHERE status IN ('failed', 'undelivered') AND created_at >= $2)::int AS failed,
  (SELECT count(*) FROM vault_requests r
    WHERE r.created_at >= $2
      AND NOT EXISTS (
        SELECT 1 FROM outbox o
         WHERE o.template = 'request_notification' AND o.request_id = r.id))::int AS unnotified`

export async function outboxHealth(pool: Pool, now: Date): Promise<OutboxHealth> {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new RangeError('Date de contrôle invalide')
  }
  const lateBefore = new Date(now.getTime() - OUTBOX_LATE_MINUTES * MINUTE_MS)
  const since = new Date(now.getTime() - OUTBOX_HEALTH_DAYS * DAY_MS)
  return guard('outboxHealth', async () => {
    const { rows } = await pool.query<OutboxHealth>(HEALTH_QUERY, [lateBefore, since])
    const row = rows[0]
    return {
      late: Number(row?.late ?? 0),
      failed: Number(row?.failed ?? 0),
      unnotified: Number(row?.unnotified ?? 0),
    }
  })
}

/** Même lecture que l'envoi : `null` coupe l'envoi ; une configuration qui lève ne laisse rien partir. */
export function emailSendingState(env: Record<string, string | undefined>): EmailSendingState {
  try {
    return emailConfigFromEnv(env) === null ? 'off' : 'on'
  } catch {
    return 'incomplete'
  }
}

function assertCount(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError('Compte invalide : entier positif ou nul attendu')
  }
}

function late(n: number): string {
  const messages = n === 1 ? '1 message' : `${n} messages`
  return `Attention${NBSP}: ${messages} en attente depuis plus de ${OUTBOX_LATE_MINUTES} minutes. La tâche planifiée ne passe peut-être plus.`
}

function failed(n: number): string {
  const phrase =
    n === 1
      ? '1 message n’a pas pu être envoyé ou livré'
      : `${n} messages n’ont pas pu être envoyés ou livrés`
  return `Attention${NBSP}: ${phrase} ces ${OUTBOX_HEALTH_DAYS} derniers jours.`
}

function unnotified(n: number): string {
  const fenetre = `de ces ${OUTBOX_HEALTH_DAYS} derniers jours`
  return n === 1
    ? `1 demande ${fenetre} n’a pas fait l’objet d’une notification par e-mail. Elle est bien enregistrée dans le coffre.`
    : `${n} demandes ${fenetre} n’ont pas fait l’objet d’une notification par e-mail. Elles sont bien enregistrées dans le coffre.`
}

const OFF = `L’envoi des e-mails est coupé${NBSP}: aucune notification ne part.`
const INCOMPLETE = `Attention${NBSP}: la configuration des e-mails est incomplète ou invalide, aucune notification ne part.`
const ALL_CLEAR = `Envoi des e-mails${NBSP}: rien à signaler.`

/**
 * Phrases du bloc. `alert` vrai : toutes les phrases sont des alertes (« Attention : … ») ; faux :
 * aucune ne l'est. Envoi coupé (avant l'ouverture) : pas d'alerte, et ni retard ni échec, puisque
 * rien ne part et que la tâche ne reprend rien. Configuration incomplète : pas de phrase de
 * retard, qui découle de la configuration et non de la tâche.
 */
export function outboxHealthLines(
  health: OutboxHealth,
  state: EmailSendingState,
): { lines: string[]; alert: boolean } {
  assertCount(health.late)
  assertCount(health.failed)
  assertCount(health.unnotified)

  if (state === 'off') {
    const lines = [OFF]
    if (health.unnotified > 0) lines.push(unnotified(health.unnotified))
    return { lines, alert: false }
  }

  const lines = state === 'incomplete' ? [INCOMPLETE] : []
  if (state === 'on' && health.late > 0) lines.push(late(health.late))
  if (health.failed > 0) lines.push(failed(health.failed))
  if (health.unnotified > 0) lines.push(`Attention${NBSP}: ${unnotified(health.unnotified)}`)
  return lines.length === 0 ? { lines: [ALL_CLEAR], alert: false } : { lines, alert: true }
}
