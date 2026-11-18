/**
 * Empreintes pour la limitation de débit (story 3.5, docs/architecture.md §6.7) : l'adresse IP et
 * l'adresse e-mail ne sont jamais gardées en clair. HMAC-SHA256 avec un sel du jour, lui-même dérivé
 * du secret du formulaire : deux jours différents donnent deux empreintes sans lien, et sans le
 * secret on ne remonte pas à l'adresse. Fonctions pures, testées par node --test.
 */
import { createHmac } from 'node:crypto'

/** Jour UTC, « 2026-11-18 ». */
export function jourUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function selDuJour(secret: string, date: Date): string {
  return createHmac('sha256', secret)
    .update(`sel:${jourUtc(date)}`)
    .digest('hex')
}

export function empreinte(valeur: string, secret: string, date: Date): string {
  return createHmac('sha256', selDuJour(secret, date))
    .update(valeur.trim().toLowerCase())
    .digest('base64url')
}
