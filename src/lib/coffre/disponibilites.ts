// Libellés et messages de /coffre/disponibilites (story 3.8, partie B) : outil interne, en français
// seulement. Après chaque formulaire, l'action serveur revient sur la page avec `?ok=<code>` ou
// `?erreur=<code>` ; la page ne lit que des codes de ces listes fermées, jamais une valeur reçue.
// Imports relatifs seulement : testé par node --test.

import type { ExceptionKind } from '../booking/settings.ts'
import type { CodeErreurDisponibilites } from '../validation/disponibilites.ts'

export const JOURS_SEMAINE = [
  { jour: 1, nom: 'Lundi' },
  { jour: 2, nom: 'Mardi' },
  { jour: 3, nom: 'Mercredi' },
  { jour: 4, nom: 'Jeudi' },
  { jour: 5, nom: 'Vendredi' },
  { jour: 6, nom: 'Samedi' },
  { jour: 7, nom: 'Dimanche' },
] as const

export const TYPES_ABSENCE: Record<ExceptionKind, string> = {
  leave: 'Congé',
  holiday: 'Jour férié',
  blocked: 'Journée bloquée',
}

/** « 10:30 » → « 10 h 30 » ; « 16:00 » → « 16 h » (typographie française, espaces insécables). */
export function heureEnLettres(heure: string): string {
  const [heures = '', minutes = ''] = heure.split(':')
  const h = String(Number(heures))
  return minutes === '00' ? `${h} h` : `${h} h ${minutes}`
}

const DATE_LONGUE = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** « 2027-01-01 » → « Vendredi 1er janvier 2027 ». Date locale, lue comme telle (midi UTC). */
export function dateEnLettres(date: string): string {
  const [annee, mois, jour] = date.split('-').map(Number)
  const texte = DATE_LONGUE.format(new Date(Date.UTC(annee ?? 0, (mois ?? 1) - 1, jour ?? 1, 12)))
  const premier = texte.replace(/^(\p{L}+) 1 /u, '$1 1er ')
  return premier.charAt(0).toUpperCase() + premier.slice(1)
}

export type SuccesDisponibilites =
  | 'reglages'
  | 'plage-ajoutee'
  | 'plage-retiree'
  | 'absence-ajoutee'
  | 'absence-retiree'
  | 'journee-bloquee'
  | 'feries'
  | 'feries-preremplis'

export type ErreurDisponibilites = CodeErreurDisponibilites | 'plage-chevauchement' | 'indisponible'

export const SUCCES: Record<SuccesDisponibilites, string> = {
  reglages: 'Les réglages des appels sont enregistrés.',
  'plage-ajoutee': 'La plage est ajoutée à la semaine type.',
  'plage-retiree': 'La plage est retirée de la semaine type.',
  'absence-ajoutee': 'L’absence est enregistrée.',
  'absence-retiree': 'L’absence est retirée.',
  'journee-bloquee': 'La journée est bloquée.',
  feries: 'Les jours fériés sont enregistrés.',
  'feries-preremplis': 'Les jours fériés sont préremplis.',
}

// Message (« Erreur : … », jamais la couleur seule) et ancre du champ ou de la section visée.
export const ERREURS: Record<ErreurDisponibilites, { message: string; ancre: string }> = {
  duree: { message: 'Erreur : la durée d’un appel n’est pas valable.', ancre: '#duree' },
  pause: { message: 'Erreur : la pause entre deux appels n’est pas valable.', ancre: '#pause' },
  delai: { message: 'Erreur : le délai minimal n’est pas valable.', ancre: '#delai' },
  horizon: { message: 'Erreur : l’horizon de réservation n’est pas valable.', ancre: '#horizon' },
  plafond: {
    message: 'Erreur : le plafond d’appels par jour n’est pas valable.',
    ancre: '#plafond',
  },
  'jour-semaine': { message: 'Erreur : choisissez un jour de la semaine.', ancre: '#plage-jour' },
  debut: { message: 'Erreur : saisissez l’heure de début de la plage.', ancre: '#plage-debut' },
  fin: { message: 'Erreur : saisissez l’heure de fin de la plage.', ancre: '#plage-fin' },
  'plage-ordre': {
    message: 'Erreur : la fin de la plage doit suivre son début.',
    ancre: '#plage-fin',
  },
  'plage-chevauchement': {
    message: 'Erreur : cette plage chevauche une autre plage du même jour.',
    ancre: '#plage-debut',
  },
  du: { message: 'Erreur : saisissez la date de début de l’absence.', ancre: '#absence-du' },
  au: {
    message: 'Erreur : saisissez la date de fin de l’absence, aujourd’hui ou plus tard.',
    ancre: '#absence-au',
  },
  'absence-ordre': {
    message: 'Erreur : la fin de l’absence ne peut pas précéder son début.',
    ancre: '#absence-au',
  },
  'absence-longue': {
    message: 'Erreur : une absence dure un an au plus.',
    ancre: '#absence-au',
  },
  date: {
    message: 'Erreur : la journée à bloquer n’a pas été reconnue.',
    ancre: '#apercu-titre',
  },
  feries: {
    message: 'Erreur : les jours fériés envoyés n’ont pas été reconnus.',
    ancre: '#feries-titre',
  },
  identifiant: {
    message: 'Erreur : l’élément à retirer n’existe plus.',
    ancre: '#apercu-titre',
  },
  annee: {
    message: 'Erreur : l’année à préremplir n’a pas été reconnue.',
    ancre: '#feries-titre',
  },
  indisponible: {
    message: 'Erreur : l’enregistrement n’a pas abouti. Réessayez dans un instant.',
    ancre: '#apercu-titre',
  },
}

export type Statut =
  { ok: SuccesDisponibilites; erreur?: never } | { erreur: ErreurDisponibilites; ok?: never } | null

/** Paramètres de l'adresse → code connu, ou rien. Une valeur inconnue est ignorée. */
export function lireStatut(parametres: { ok?: unknown; erreur?: unknown }): Statut {
  const { ok, erreur } = parametres
  if (typeof erreur === 'string' && Object.hasOwn(ERREURS, erreur)) {
    return { erreur: erreur as ErreurDisponibilites }
  }
  if (typeof ok === 'string' && Object.hasOwn(SUCCES, ok)) {
    return { ok: ok as SuccesDisponibilites }
  }
  return null
}

/** Adresse de retour d'une action serveur. */
export function adresseRetour(statut: NonNullable<Statut>): string {
  const parametre = statut.erreur ? `erreur=${statut.erreur}` : `ok=${statut.ok}`
  return `/coffre/disponibilites?${parametre}`
}
