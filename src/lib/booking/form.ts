/**
 * Formulaire de réservation d'appel (story 3.10 ; docs/reservation-appel.md §2) : champs, codes
 * d'erreur, état renvoyé par la Server Action, créneaux tels que la page les affiche. Aucune
 * dépendance : lu par la page, le composant client, la validation Zod et l'action.
 * Imports relatifs seulement : testé par node --test.
 */

// Dans l'ordre de l'écran. `sms` et `consentement` sont des cases (« oui » cochée).
export const CHAMPS_RESERVATION = [
  'creneau',
  'nom',
  'telephone',
  'langue',
  'sms',
  'origine',
  'consentement',
] as const

export type ChampReservation = (typeof CHAMPS_RESERVATION)[number]

// Saisie relue (chaînes nettoyées, champ vide absent). `jeton` et `locale` sont cachés.
export type ValeursReservation = Partial<Record<ChampReservation | 'jeton' | 'locale', string>>

// Codes d'erreur : clés de messages/*.json (Booking.form.errors.codes).
export const CODES_ERREUR_RESERVATION = [
  'creneau',
  'nomRequis',
  'nomCourt',
  'nomLong',
  'telephoneRequis',
  'telephoneFormat',
  'langue',
  'origine',
  'consentement',
] as const
export type CodeErreurReservation = (typeof CODES_ERREUR_RESERVATION)[number]
export type ErreursReservation = Partial<Record<ChampReservation, CodeErreurReservation>>

/** Un créneau libre, prêt à afficher : libellés composés sur le serveur, dans la langue de la page. */
export interface CreneauAffiche {
  /** Instant de début, ISO 8601 en UTC : la valeur envoyée par le formulaire. */
  debut: string
  /** Date locale (Bruxelles), « YYYY-MM-DD ». */
  jour: string
  /** Lundi de la semaine, « YYYY-MM-DD ». */
  semaine: string
  libelleJour: string
  libelleHeure: string
  libelleSemaine: string
}

// Réponse de l'action. `pris` : le créneau vient d'être pris (contrainte d'exclusion, plafond du jour
// ou réglages changés) ; la saisie revient, avec les créneaux encore libres, relus à cet instant, et
// le début du créneau perdu (ses voisins viennent en tête). `echec` : coffre injoignable, rien
// d'enregistré, la saisie revient. Une réservation aboutie ne renvoie pas d'état : l'action redirige
// vers la confirmation. Un lien qui ne vaut plus redirige vers sa page, qui le dit sobrement.
// `limite` : trop d'envois depuis la même adresse IP en peu de temps (limitation de débit, comme le
// formulaire de contact) ; rien n'est lu ni écrit, la saisie revient.
export type StatutReservation = 'initial' | 'erreurs' | 'pris' | 'echec' | 'limite'

export type EtatReservation = {
  statut: StatutReservation
  erreurs?: ErreursReservation
  valeurs?: ValeursReservation
  creneaux?: CreneauAffiche[]
  creneauPris?: string
}

export const ETAT_RESERVATION_INITIAL: EtatReservation = { statut: 'initial' }

export function estChampReservation(nom: string): nom is ChampReservation {
  return (CHAMPS_RESERVATION as readonly string[]).includes(nom)
}
