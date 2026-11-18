// Délais de la boîte d'envoi (docs/email-deliverability.md §3). Première tentative juste après la
// réponse au visiteur, puis reprises par la tâche Vercel Cron toutes les 5 minutes : un message
// échoué est retenté après 5 min, 30 min, puis 2 h, avant abandon. Module pur : aucune API Node
// ni Next, testable seul.

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// Délai avant la reprise n°i, selon le nombre de tentatives déjà faites (1, 2, 3).
export const RETRY_DELAYS_MS: readonly number[] = [5 * MINUTE_MS, 30 * MINUTE_MS, 2 * HOUR_MS]

// Première tentative + 3 reprises.
export const MAX_ATTEMPTS = 4

// Au-delà, on cesse de suivre l'acheminement d'un message accepté.
export const TRACKING_WINDOW_MS = 72 * HOUR_MS

// Les lignes terminées sont purgées après ce délai.
export const PURGE_AFTER_DAYS = 30

function assertDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError('date invalide')
  }
}

// `attempts` : nombre de tentatives déjà faites, y compris celle qui vient d'échouer.
// Renvoie la date de la prochaine tentative, ou null quand la boîte renonce.
export function nextAttemptAt(attempts: number, now: Date): Date | null {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
    throw new RangeError('nombre de tentatives invalide')
  }
  assertDate(now)
  if (attempts >= MAX_ATTEMPTS) return null
  return new Date(now.getTime() + RETRY_DELAYS_MS[attempts - 1]!)
}

export function trackingExpired(acceptedAt: Date, now: Date): boolean {
  assertDate(acceptedAt)
  assertDate(now)
  return now.getTime() - acceptedAt.getTime() >= TRACKING_WINDOW_MS
}

export function purgeBefore(now: Date): Date {
  assertDate(now)
  return new Date(now.getTime() - PURGE_AFTER_DAYS * DAY_MS)
}
