import { emailConfigFromEnv } from '../email/config.ts'
import type { EmailConfig } from '../email/config.ts'
import type { StoredRequest } from '../vault/store.ts'
import type { OutboxDeps } from './process.ts'

// Branchement de l'envoi sur la demande (story 3.3), sans import de Next : la Server Action
// (src/actions/request.ts) n'appelle que ces fonctions, avec ses dépendances (`after`, journaux).
// - Avant l'écriture : `notificationSetup` lit la configuration des e-mails. Vide, l'envoi est
//   coupé (`mail:disabled`) ; à moitié posée ou invalide, `failed:config` ; une fois par instance
//   l'un et l'autre, et la demande s'enregistre quand même, sans notification.
// - Après l'écriture : `storedStatuses` donne les statuts à journaliser ; `failed:outbox` revient
//   à CHAQUE demande dont la notification n'a pas pu s'écrire (Cat n'en est pas prévenue).
// - Premier essai : `scheduleFirstAttempts` pose un `after` par message. Rien n'en remonte : la
//   demande est déjà enregistrée et le visiteur doit atteindre le remerciement. Un `after` qui
//   lève est journalisé `failed:after` à chaque fois ; des dépendances impossibles à créer
//   (ENVOI_DATABASE_URL absente ou refusée), `failed:config` une fois par instance. Dans tous les
//   cas, le message est en base et la tâche planifiée `/api/cron/envoi` le reprend.
// - Plafond : `applyNotificationCap` coupe la notification (pas la demande, toujours enregistrée)
//   au-delà de `NOTIFICATIONS_PAR_JOUR` par jour UTC, `alert:notify-cap` à chaque fois ; si le
//   compteur est indisponible, la notification part (échec ouvert, comme la limitation de débit).
// Journaux : des statuts fixes seulement, jamais un message d'erreur (il nommerait des variables),
// un secret ni une adresse.
// Imports relatifs seulement : testé par node --test.

export type SetupLogStatus = 'failed:config' | 'mail:disabled'
export type QuotaNotifications = 'autorise' | 'depasse' | 'indisponible'

/**
 * Plafond de notifications par jour UTC (décision de Sady, 19/11/2026) : chaque demande valide
 * envoie un e-mail à Cat, et un flot réparti de demandes d'apparence valide pourrait remplir sa
 * boîte. Au-delà, la demande est quand même enregistrée dans le coffre, sans notification.
 */
export const NOTIFICATIONS_PAR_JOUR = 20

export type StoredStatus = 'stored' | 'failed:outbox' | 'queued'

/** Journal « une fois par instance » : `key` distingue ce qui est signalé. */
export type LogOnce<S extends string> = (key: string, status: S) => void

export type NotificationSetup =
  { notify: true; config: EmailConfig } | { notify: false; config: null }

export interface FirstAttemptDeps {
  /** `after` de `next/server` en production. */
  after: (task: () => Promise<void>) => void
  createDeps: (config: EmailConfig) => OutboxDeps
  /** Ne lève jamais (src/lib/outbox/process.ts) ; protégé quand même. */
  sendNow: (deps: OutboxDeps, id: string) => Promise<void>
  /** À chaque fois. */
  log: (status: 'failed:after') => void
  logOnce: LogOnce<'failed:config'>
}

// Clés du journal « une fois par instance ».
const SETUP_KEY = 'e-mails'
const DEPS_KEY = 'envoi'

// Un journal en panne ne doit jamais faire lever le branchement.
function quietly(run: () => void): void {
  try {
    run()
  } catch {
    // Rien de plus à faire : la demande est enregistrée, le message en base.
  }
}

/** Configuration des e-mails lue avant l'écriture : notification seulement si elle est complète. */
export function notificationSetup(
  env: Record<string, string | undefined>,
  logOnce: LogOnce<SetupLogStatus>,
): NotificationSetup {
  let config: EmailConfig | null
  try {
    config = emailConfigFromEnv(env)
  } catch {
    quietly(() => logOnce(SETUP_KEY, 'failed:config'))
    return { notify: false, config: null }
  }
  if (config === null) {
    quietly(() => logOnce(SETUP_KEY, 'mail:disabled'))
    return { notify: false, config: null }
  }
  return { notify: true, config }
}

/**
 * Applique le plafond du jour à la décision de notifier. Sans notification (e-mails coupés), le
 * quota n'est pas consulté : l'appelant ne le débite pas. Compteur indisponible : la notification
 * part.
 */
export function applyNotificationCap(
  notify: boolean,
  quota: QuotaNotifications,
): { notify: boolean; status: 'alert:notify-cap' | null } {
  if (notify && quota === 'depasse') return { notify: false, status: 'alert:notify-cap' }
  return { notify, status: null }
}

/** Statuts à journaliser une fois la demande enregistrée, dans l'ordre. */
export function storedStatuses(stored: StoredRequest): StoredStatus[] {
  const statuses: StoredStatus[] = ['stored']
  if (stored.notifyFailed) statuses.push('failed:outbox')
  if (stored.outbox.length > 0) statuses.push('queued')
  return statuses
}

/** Pose le premier essai de chaque message, après la réponse. Ne lève jamais. */
export function scheduleFirstAttempts(
  outboxIds: readonly string[],
  config: EmailConfig,
  deps: FirstAttemptDeps,
): void {
  for (const id of outboxIds) {
    const task = async (): Promise<void> => {
      let outboxDeps: OutboxDeps
      try {
        outboxDeps = deps.createDeps(config)
      } catch {
        quietly(() => deps.logOnce(DEPS_KEY, 'failed:config'))
        return
      }
      try {
        await deps.sendNow(outboxDeps, id)
      } catch {
        // Contrat rompu (`sendNow` ne lève jamais) : le message reste en base, la tâche planifiée
        // le reprend.
      }
    }
    try {
      deps.after(task)
    } catch {
      quietly(() => deps.log('failed:after'))
    }
  }
}
