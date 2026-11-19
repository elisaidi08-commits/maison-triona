import { getPool } from '../db/pool.ts'
import { vaultPublicKeyFromEnv } from '../vault/config.ts'
import { readBookingLink, readConfirmation, type Confirmation } from './bookings.ts'
import { presenterCreneaux, type Langue } from './display.ts'
import type { CreneauAffiche } from './form.ts'
import { isTokenFormat } from './tokens.ts'

// Lectures des pages de lien (story 3.10) : réservation, confirmation, fichier .ics. Lecture seule,
// rôle `site_public` (DATABASE_URL). La réservation n'est ouverte que si le coffre est configuré (base
// et clé publique, comme le formulaire de contact) ; sinon aucun lien ne peut valoir. Une base
// injoignable donne `indisponible`, jamais `invalide` : on ne dit pas d'un lien qu'il ne vaut plus sans
// le savoir. Journaux : un statut fixe, jamais le jeton ni l'erreur.

export type PageLien =
  { etat: 'valide'; creneaux: CreneauAffiche[] } | { etat: 'invalide' } | { etat: 'indisponible' }

function ouverte(jeton: string): boolean {
  return isTokenFormat(jeton) && vaultPublicKeyFromEnv(process.env) !== null
}

export async function lirePageLien(
  jeton: string,
  langue: Langue,
  now: Date = new Date(),
): Promise<PageLien> {
  if (!ouverte(jeton)) return { etat: 'invalide' }
  try {
    const lu = await readBookingLink(getPool(), jeton, now)
    if (lu.state !== 'valid') return { etat: 'invalide' }
    return { etat: 'valide', creneaux: presenterCreneaux(lu.slots, langue) }
  } catch {
    console.info('[reservation] failed:read')
    return { etat: 'indisponible' }
  }
}

export type PageConfirmation =
  { etat: 'confirme'; confirmation: Confirmation } | { etat: 'invalide' } | { etat: 'indisponible' }

export async function lirePageConfirmation(
  jeton: string,
  now: Date = new Date(),
): Promise<PageConfirmation> {
  if (!ouverte(jeton)) return { etat: 'invalide' }
  try {
    const confirmation = await readConfirmation(getPool(), jeton, now)
    return confirmation ? { etat: 'confirme', confirmation } : { etat: 'invalide' }
  } catch {
    console.info('[reservation] failed:read')
    return { etat: 'indisponible' }
  }
}
