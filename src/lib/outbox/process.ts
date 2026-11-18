import type { Pool } from 'pg'

import type { EmailConfig } from '../email/config.ts'
import type { EmailTransport, SendResult, StatusResult } from '../email/tem.ts'
import { renderAlert, renderNotification } from '../email/templates.ts'
import type { RenderedEmail } from '../email/templates.ts'
import {
  claimDue,
  claimOne,
  failExhausted,
  listAccepted,
  markAccepted,
  markFailed,
  markRetry,
  purgeOutbox,
  recordDelivery,
} from './repository.ts'
import type { AcceptedItem, OutboxItem, OutboxTemplate } from './repository.ts'
import { MAX_ATTEMPTS, nextAttemptAt, purgeBefore, trackingExpired } from './schedule.ts'

// Envoi des messages de la boîte d'envoi (story 3.3) : premier essai juste après la demande
// (`sendNow`, appelé par `after()`), puis une passe de la tâche Vercel Cron toutes les 5 minutes
// (`runOutbox`) : reprises, suivi de la livraison par interrogation de TEM (pas de webhook),
// purge. Aucun import de Next : le module est appelé par une Server Action et un Route Handler.
// - Journal : `(statut, identifiant du message)` seulement ; jamais une adresse, un sujet, une
//   réponse du prestataire ni un message d'erreur.
// - TEM n'offre pas de clé d'idempotence : un envoi accepté dont le marquage échoue sera repris à
//   la fin du bail, d'où un doublon possible. Ce risque rare est accepté (décision du 18/11/2026).
// - Jamais d'alerte sur une alerte (le dépôt le garantit aussi).
// Imports relatifs seulement : testé par node --test.

export type OutboxLogStatus =
  | 'sent'
  | 'retry'
  | 'failed:provider'
  | 'failed:alert'
  | 'failed:exhausted'
  | 'failed:db'
  | 'delivered'
  | 'undelivered'

export interface OutboxDeps {
  pool: Pool
  transport: EmailTransport
  config: EmailConfig
  now: () => Date
  /** `crypto.randomUUID` en production : identifiant des alertes. */
  newId: () => string
  log: (status: OutboxLogStatus, id: string) => void
}

export interface OutboxRunSummary {
  sent: number
  retried: number
  failed: number
  exhausted: number
  delivered: number
  undelivered: number
  purged: number
  /** Erreurs de la base (ou du marquage) sur un message, dans l'une ou l'autre boucle. */
  errors: number
}

export interface OutboxRunOptions {
  /** Au-delà, la passe ne réserve plus rien (la route a `maxDuration = 60`). */
  budgetMs?: number
  maxSends?: number
  maxChecks?: number
}

// Marge sous `maxDuration = 60` de la route : le dernier envoi ou suivi commence avant 30 s. Au
// pire, il attend la réservation 5 s (`statement_timeout`, src/lib/db/config.ts), TEM 10 s (délai
// du transport), le marquage 5 s, puis la purge 5 s ; en pratique, quelques millisecondes pour
// chaque appel à la base. 30 s + 5 s + 10 s + 5 s + 5 s ≈ 55 s < 60 s.
const DEFAULT_BUDGET_MS = 30_000
const DEFAULT_MAX_SENDS = 20
const DEFAULT_MAX_CHECKS = 20

// Indicateurs de TEM qui valent non-livraison, même si l'état annoncé est « délivré ».
const UNDELIVERED_FLAGS: readonly string[] = [
  'hard_bounce',
  'spam',
  'blocklisted',
  'mailbox_not_found',
]

// Identifiant de l'alerte à écrire si le message échoue : aucune pour une alerte.
function alertIdFor(deps: OutboxDeps, template: OutboxTemplate): string | null {
  return template === 'technical_alert' ? null : deps.newId()
}

// Journalise sans jamais lever : dans un bloc d'erreur, un journal en panne ne doit pas arrêter
// la passe ni faire lever le premier essai.
function logSafely(deps: OutboxDeps, status: OutboxLogStatus, id: string): void {
  try {
    deps.log(status, id)
  } catch {
    // Journal indisponible : rien de plus à faire, le message reste en base.
  }
}

function failedStatus(item: OutboxItem): OutboxLogStatus {
  return item.template === 'technical_alert' ? 'failed:alert' : 'failed:provider'
}

// Lève si la ligne est incohérente (identifiant ou événement manquant ou invalide) : échec `render`.
function render(item: OutboxItem, config: EmailConfig): { to: string; mail: RenderedEmail } {
  if (item.template === 'technical_alert') {
    if (item.alertEvent === null || item.alertSubject === null) {
      throw new RangeError('Alerte incomplète')
    }
    return {
      to: config.alertTo,
      mail: renderAlert({
        event: item.alertEvent,
        subjectId: item.alertSubject,
        createdAt: item.createdAt,
      }),
    }
  }
  if (item.requestId === null) throw new RangeError('Notification sans demande')
  return {
    to: config.notifyTo,
    mail: renderNotification({
      requestId: item.requestId,
      priority: item.priority,
      createdAt: item.createdAt,
      siteUrl: config.siteUrl,
    }),
  }
}

// Une panne inattendue du transport (il ne devrait jamais lever) est traitée comme une panne
// passagère : le message est repris.
async function safeSend(
  transport: EmailTransport,
  message: Parameters<EmailTransport['send']>[0],
): Promise<SendResult> {
  try {
    return await transport.send(message)
  } catch {
    return { ok: false, retryable: true, code: 'exception' }
  }
}

async function safeStatus(transport: EmailTransport, providerId: string): Promise<StatusResult> {
  try {
    return await transport.status(providerId)
  } catch {
    return { ok: false, code: 'exception' }
  }
}

/**
 * Envoie un message déjà réservé (`claimDue` ou `claimOne`) et note l'issue. Les erreurs de la
 * base au marquage remontent à l'appelant.
 */
export async function sendItem(
  deps: OutboxDeps,
  item: OutboxItem,
): Promise<'accepted' | 'retry' | 'failed'> {
  const { pool, transport, config } = deps
  const isAlert = item.template === 'technical_alert'

  // Envois interrompus à répétition (bail échu sans marquage) : on renonce sans renvoyer.
  if (item.attempts > MAX_ATTEMPTS) {
    await markFailed(pool, item.id, 'exhausted', alertIdFor(deps, item.template))
    deps.log(isAlert ? 'failed:alert' : 'failed:exhausted', item.id)
    return 'failed'
  }

  let rendered: { to: string; mail: RenderedEmail }
  try {
    rendered = render(item, config)
  } catch {
    await markFailed(pool, item.id, 'render', alertIdFor(deps, item.template))
    deps.log(failedStatus(item), item.id)
    return 'failed'
  }

  const result = await safeSend(transport, {
    from: config.from,
    to: rendered.to,
    subject: rendered.mail.subject,
    text: rendered.mail.text,
  })
  if (result.ok) {
    await markAccepted(pool, item.id, result.providerId, deps.now())
    deps.log('sent', item.id)
    return 'accepted'
  }

  const next = result.retryable ? nextAttemptAt(item.attempts, deps.now()) : null
  if (next !== null) {
    await markRetry(pool, item.id, result.code, next)
    deps.log('retry', item.id)
    return 'retry'
  }
  await markFailed(pool, item.id, result.code, alertIdFor(deps, item.template))
  deps.log(failedStatus(item), item.id)
  return 'failed'
}

/**
 * Premier essai, juste après l'enregistrement de la demande. Ne lève jamais : en cas d'erreur, le
 * message reste en base et la tâche planifiée le reprend.
 */
export async function sendNow(deps: OutboxDeps, id: string): Promise<void> {
  try {
    const item = await claimOne(deps.pool, id, deps.now())
    if (item === null) return
    await sendItem(deps, item)
  } catch {
    logSafely(deps, 'failed:db', id)
  }
}

// Suivi d'un message accepté : 'pending' quand il faut repasser plus tard.
async function track(
  deps: OutboxDeps,
  item: AcceptedItem,
): Promise<'delivered' | 'undelivered' | 'pending'> {
  const { pool } = deps
  const status = await safeStatus(deps.transport, item.providerId)
  if (status.ok) {
    // Dédoublonnés : un indicateur répété ne doit pas dépasser le plafond du dépôt.
    const flags = [...new Set(status.flags)]
    if (status.state === 'undelivered' || flags.some((flag) => UNDELIVERED_FLAGS.includes(flag))) {
      const alertId = alertIdFor(deps, item.template)
      await recordDelivery(pool, item.id, 'undelivered', flags, alertId, 'undelivered')
      deps.log('undelivered', item.id)
      return 'undelivered'
    }
    if (status.state === 'delivered') {
      await recordDelivery(pool, item.id, 'delivered', flags, null, null)
      deps.log('delivered', item.id)
      return 'delivered'
    }
  }
  // Toujours en attente, ou TEM injoignable : on repasse, jusqu'à 72 heures.
  if (trackingExpired(item.acceptedAt, deps.now())) {
    const alertId = alertIdFor(deps, item.template)
    await recordDelivery(pool, item.id, 'undelivered', [], alertId, 'tracking_expired')
    deps.log('undelivered', item.id)
    return 'undelivered'
  }
  return 'pending'
}

/**
 * Une passe de la tâche planifiée. Vercel peut la lancer deux fois en même temps et ne la relance
 * pas : la réservation (bail, `SKIP LOCKED`) garantit qu'un message n'est envoyé que par une passe.
 * Une erreur de la base sur un message est journalisée et la passe continue ; une erreur hors d'un
 * message (base injoignable) remonte à l'appelant.
 */
export async function runOutbox(
  deps: OutboxDeps,
  options: OutboxRunOptions = {},
): Promise<OutboxRunSummary> {
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS
  const maxSends = options.maxSends ?? DEFAULT_MAX_SENDS
  const maxChecks = options.maxChecks ?? DEFAULT_MAX_CHECKS
  const startedAt = deps.now().getTime()
  const withinBudget = (): boolean => deps.now().getTime() - startedAt < budgetMs

  const summary: OutboxRunSummary = {
    sent: 0,
    retried: 0,
    failed: 0,
    exhausted: 0,
    delivered: 0,
    undelivered: 0,
    purged: 0,
    errors: 0,
  }

  summary.exhausted = await failExhausted(deps.pool, deps.now(), deps.newId)

  // Un message à la fois : réserver d'avance des lignes que la fonction n'aurait pas le temps de
  // traiter (arrêt au budget, ou fonction coupée) brûlerait une tentative pour rien.
  for (let sends = 0; sends < maxSends && withinBudget(); sends += 1) {
    const [item] = await claimDue(deps.pool, deps.now(), 1)
    if (item === undefined) break
    try {
      const outcome = await sendItem(deps, item)
      if (outcome === 'accepted') summary.sent += 1
      else if (outcome === 'retry') summary.retried += 1
      else summary.failed += 1
    } catch {
      // Le message reste sous bail : il sera repris à l'échéance, pas dans cette passe.
      logSafely(deps, 'failed:db', item.id)
      summary.errors += 1
    }
  }

  // Budget déjà épuisé : aucun suivi, pas même la liste ; la passe suivante s'en charge.
  const accepted = withinBudget() ? await listAccepted(deps.pool, maxChecks) : []
  for (const item of accepted) {
    if (!withinBudget()) break
    try {
      const outcome = await track(deps, item)
      if (outcome === 'delivered') summary.delivered += 1
      else if (outcome === 'undelivered') summary.undelivered += 1
    } catch {
      logSafely(deps, 'failed:db', item.id)
      summary.errors += 1
    }
  }

  summary.purged = await purgeOutbox(deps.pool, purgeBefore(deps.now()))
  return summary
}
