/**
 * Horodatage signé du formulaire (story 3.5, docs/architecture.md §6.2) : le serveur délivre
 * « instant.signature » (HMAC-SHA256) quand le formulaire s'affiche ; un envoi moins de 3 secondes
 * après est refusé, un jeton de plus de 2 heures aussi (il est alors renouvelé). La signature
 * empêche un robot d'inventer un instant plus ancien.
 * Fonctions pures : le secret et l'heure arrivent en paramètre. Testé par node --test.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export const DELAI_MINIMUM_MS = 3000
export const DUREE_MAXIMUM_MS = 2 * 60 * 60 * 1000
// Un instant venu du futur au-delà de cette marge est une falsification, pas un décalage d'horloge.
const TOLERANCE_FUTUR_MS = 5000

function signer(instant: string, secret: string): string {
  return createHmac('sha256', secret).update(`horodatage:${instant}`).digest('base64url')
}

export function signerHorodatage(instant: number, secret: string): string {
  const valeur = String(Math.floor(instant))
  return `${valeur}.${signer(valeur, secret)}`
}

export type VerificationHorodatage =
  | { statut: 'absent' }
  | { statut: 'invalide' }
  | { statut: 'expire' }
  | { statut: 'valide'; ageMs: number; identifiant: string }

export function verifierHorodatage(
  jeton: string | undefined | null,
  secret: string,
  maintenant: number,
): VerificationHorodatage {
  if (!jeton) return { statut: 'absent' }
  const [instant, signature, ...reste] = jeton.split('.')
  if (!instant || !signature || reste.length > 0 || !/^\d{13}$/.test(instant)) {
    return { statut: 'invalide' }
  }
  const attendue = Buffer.from(signer(instant, secret))
  const recue = Buffer.from(signature)
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) {
    return { statut: 'invalide' }
  }
  const ageMs = maintenant - Number(instant)
  if (ageMs < -TOLERANCE_FUTUR_MS) return { statut: 'invalide' }
  if (ageMs > DUREE_MAXIMUM_MS) return { statut: 'expire' }
  // La signature identifie le jeton (usage unique, quand Upstash est configuré).
  return { statut: 'valide', ageMs, identifiant: signature }
}
