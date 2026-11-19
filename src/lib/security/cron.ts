import { createHash, timingSafeEqual } from 'node:crypto'

// Secret des tâches planifiées (`CRON_SECRET`, docs/architecture.md §6.5 et §6.7) : conservation
// du coffre (`/api/cron/retention`, story 3.2 D) et boîte d'envoi des e-mails (`/api/cron/envoi`,
// story 3.3), une seule vérification pour les deux. Vercel Cron envoie la valeur de la variable
// dans l'en-tête `Authorization: Bearer <secret>` à chaque appel (documentation Vercel « Managing
// Cron Jobs », consultée le 18/11/2026).
// - Refus sans secret configuré : jamais de repli, ni en local ni sur un déploiement.
// - Secret de 32 caractères au moins, sans espace ni caractère de contrôle (il voyage dans un
//   en-tête) : `openssl rand -hex 32`. Un secret mal formé est traité comme absent.
// - Comparaison à temps constant : les deux valeurs sont réduites à leur empreinte SHA-256 (même
//   longueur), puis comparées par `timingSafeEqual` ; ni la longueur du secret ni la position du
//   premier caractère différent ne se lisent dans la durée de la réponse.
// Imports relatifs seulement : testé par node --test.

export const CRON_SECRET_MIN = 32
const CRON_SECRET_FORMAT = /^[\x21-\x7e]{32,512}$/

type Environnement = Record<string, string | undefined>

/** Secret des tâches planifiées, ou `null` s'il est absent ou mal formé. */
export function secretCron(env: Environnement): string | null {
  const secret = env.CRON_SECRET
  return secret && CRON_SECRET_FORMAT.test(secret) ? secret : null
}

function empreinte(valeur: string): Buffer {
  return createHash('sha256').update(valeur, 'utf8').digest()
}

/** Vrai seulement si l'en-tête vaut exactement `Bearer <CRON_SECRET>`. */
export function autorisationCron(entete: string | null | undefined, env: Environnement): boolean {
  const secret = secretCron(env)
  if (!secret || typeof entete !== 'string') return false
  return timingSafeEqual(empreinte(entete), empreinte(`Bearer ${secret}`))
}

// Garde du build (next.config.ts) : en production Vercel, dès que le coffre (`COFFRE_DATABASE_URL`)
// ou l'envoi des e-mails (`TEM_SECRET_KEY`, story 3.3) est configuré, un `CRON_SECRET` valable est
// exigé ; sans lui, la conservation ne passerait jamais, et un e-mail dont le premier essai échoue
// ne serait ni repris ni suivi (`/api/cron/envoi`). Pas ailleurs : l'aperçu public (D62) est un
// déploiement de production sans coffre ni envoi, et un aperçu de branche n'a pas de tâche
// planifiée. Le message ne cite aucune valeur.
export function verifierCronAuBuild(env: Environnement): void {
  if (env.VERCEL_ENV !== 'production') return
  const coffre = Boolean(env.COFFRE_DATABASE_URL?.trim())
  const envoi = Boolean(env.TEM_SECRET_KEY?.trim())
  if (!coffre && !envoi) return
  if (secretCron(env)) return
  throw new Error(
    'CRON_SECRET manquant ou mal formé (32 caractères au moins, sans espace) : obligatoire en production dès que le coffre (COFFRE_DATABASE_URL) ou les e-mails (TEM_SECRET_KEY) sont configurés.',
  )
}
