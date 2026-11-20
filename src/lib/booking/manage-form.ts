/**
 * Formulaire de déplacement d'un appel (story 3.11 ; docs/reservation-appel.md §2, étape 6) : état
 * renvoyé par la Server Action. Un seul champ, le créneau ; le jeton et la langue sont cachés. Aucune
 * dépendance : lu par la page, le composant client, la validation et l'action.
 * Imports relatifs seulement : testé par node --test.
 */
import type { CreneauAffiche } from './form.ts'

// `erreurs` : aucun créneau choisi (ou valeur trafiquée). `pris` : le créneau choisi n'est plus
// ouvert ; les créneaux encore libres reviennent, relus à cet instant, les plus proches du créneau
// perdu en tête. `echec` : base injoignable, rien n'a changé. `limite` : trop d'envois depuis la même
// adresse IP. Un déplacement abouti ne renvoie pas d'état : l'action redirige vers la page de
// gestion, qui le dit.
export type StatutDeplacement = 'initial' | 'erreurs' | 'pris' | 'echec' | 'limite'

export type EtatDeplacement = {
  statut: StatutDeplacement
  /** Le créneau choisi, gardé après une erreur (ISO 8601). */
  creneau?: string
  creneaux?: CreneauAffiche[]
  creneauPris?: string
}

export const ETAT_DEPLACEMENT_INITIAL: EtatDeplacement = { statut: 'initial' }
