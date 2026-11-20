import { getPool } from '../db/pool.ts'
import { vaultPublicKeyFromEnv } from '../vault/config.ts'
import { readBookingLink, readManageLink, type ManagedCall } from './bookings.ts'
import { presenterCreneaux, type Langue } from './display.ts'
import type { CallPhase } from './manage.ts'
import type { CreneauAffiche } from './form.ts'
import { isTokenFormat } from './tokens.ts'

// Lectures des pages de lien (story 3.10) : réservation ; depuis la story 3.11, gestion (déplacer,
// annuler) et fichier .ics, par le lien de gestion. Lecture seule,
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

export type PageGestion =
  | { etat: 'valide'; appel: ManagedCall; phase: CallPhase; creneaux: CreneauAffiche[] }
  | { etat: 'invalide' }
  | { etat: 'indisponible' }

/**
 * Page de gestion (story 3.11), son annulation et son fichier .ics. `creneaux` : seulement si demandés
 * (page principale) et si l'appel se déplace encore, dans la langue de la page.
 */
export async function lirePageGestion(
  jeton: string,
  langue: Langue,
  options: { creneaux?: boolean } = {},
  now: Date = new Date(),
): Promise<PageGestion> {
  if (!ouverte(jeton)) return { etat: 'invalide' }
  try {
    const lu = await readManageLink(getPool(), jeton, now, { withSlots: options.creneaux === true })
    if (lu.state !== 'valid') return { etat: 'invalide' }
    return {
      etat: 'valide',
      appel: lu.call,
      phase: lu.phase,
      creneaux: presenterCreneaux(lu.slots, langue),
    }
  } catch {
    console.info('[gestion] failed:read')
    return { etat: 'indisponible' }
  }
}
