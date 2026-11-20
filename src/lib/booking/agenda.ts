/**
 * Agenda des appels de Cat (story 3.13 ; docs/reservation-appel.md §3.2), fonctions pures : bornes
 * des vues « Aujourd'hui » et « Cette semaine » à l'heure locale, statut affiché (« à qualifier » se
 * déduit : confirmé, heure de fin passée ; il n'est jamais stocké), qualification permise, lien
 * `tel:`. Rien de personnel : des instants et des statuts ; le numéro n'arrive ici que dans le
 * navigateur, déchiffré.
 * Imports relatifs seulement : testé par node --test, lu aussi par le navigateur.
 */
import { SETTINGS_LIMITS } from './settings.ts'
import { addDays, isoWeekday, zonedParts, zonedTimeToUtc } from './zoned-time.ts'

/** Appels plus anciens que la vue, encore « à qualifier », montrés au plus. */
export const EARLIER_TO_QUALIFY_LIMIT = 50

/**
 * Appels qu'une page de l'agenda peut montrer au plus, donc déchiffrer en une fois : une semaine au
 * plafond quotidien le plus haut permis (7 × 12), plus ceux d'avant restés à qualifier (50).
 * Aucun appel ne s'annule avant la 3.11 (la base le refuse) ; quand un appel annulé libérera sa
 * plage, la vue montrera aussi les annulés : la 3.11 devra revoir cette borne.
 */
export const AGENDA_MAX_CALLS = 7 * SETTINGS_LIMITS.dailyCap.max + EARLIER_TO_QUALIFY_LIMIT

/** Statuts d'un appel en base (db/migrations/0008_reservations.sql). */
export const BOOKING_STATUSES = [
  'confirmed',
  'done',
  'no_answer',
  'cancelled_by_guest',
  'cancelled_by_house',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/** Ce que Cat choisit depuis l'agenda, une fois l'appel commencé. Annuler : story 3.11. */
export const QUALIFICATIONS = ['done', 'no_answer'] as const
export type Qualification = (typeof QUALIFICATIONS)[number]

/** Valeur de la liste du rattachement qui le retire (aucune demande). */
export const AUCUNE_DEMANDE = 'aucune'

/** Statut affiché : celui de la base, ou « à qualifier », déduit. */
export type AgendaStatus = BookingStatus | 'to_qualify'

export const AGENDA_VIEWS = ['jour', 'semaine'] as const
export type AgendaView = (typeof AGENDA_VIEWS)[number]

export interface ViewBounds {
  /** Minuit local du premier jour, inclus. */
  from: Date
  /** Minuit local du jour qui suit le dernier, exclu. */
  to: Date
  /** Dates locales de la vue, « YYYY-MM-DD ». */
  days: string[]
}

export interface CallTimes {
  status: string
  startsAt: Date
  endsAt: Date
}

const QUALIFIABLE: readonly string[] = ['confirmed', 'done', 'no_answer']

/**
 * « Aujourd'hui » : la journée locale de `now`. « Cette semaine » : du lundi au dimanche. Bornes à
 * minuit local (Bruxelles change d'heure à 2 h ou 3 h : minuit existe toujours) ; un jour de
 * changement d'heure dure 23 ou 25 heures.
 */
export function viewBounds(view: AgendaView, now: Date, timeZone: string): ViewBounds {
  if (Number.isNaN(now.getTime())) throw new RangeError('Date invalide')
  const today = zonedParts(now, timeZone).date
  const first = view === 'jour' ? today : addDays(today, 1 - isoWeekday(today))
  const count = view === 'jour' ? 1 : 7
  return {
    from: zonedTimeToUtc(first, '00:00', timeZone),
    to: zonedTimeToUtc(addDays(first, count), '00:00', timeZone),
    days: Array.from({ length: count }, (_, index) => addDays(first, index)),
  }
}

/** « À qualifier » : confirmé, et son heure de fin est passée. */
export function isToQualify(call: CallTimes, now: Date): boolean {
  return call.status === 'confirmed' && call.endsAt.getTime() <= now.getTime()
}

/**
 * « Fait » ou « pas de réponse » se choisit une fois l'appel commencé (un appel sans réponse se sait
 * tout de suite), et se corrige ; jamais pour un appel annulé. Même règle que le déclencheur de
 * db/migrations/0013_agenda.sql, qui a le dernier mot.
 */
export function canQualify(call: CallTimes, now: Date): boolean {
  return QUALIFIABLE.includes(call.status) && call.startsAt.getTime() <= now.getTime()
}

export function agendaStatus(call: CallTimes & { status: BookingStatus }, now: Date): AgendaStatus {
  return isToQualify(call, now) ? 'to_qualify' : call.status
}

/**
 * Lien `tel:` d'un numéro déchiffré : ses seuls chiffres, et le « + » s'il ouvre le numéro. Même
 * nombre de chiffres que la validation (6 à 15, src/lib/validation/demande.ts) ; sinon, pas de lien,
 * le numéro s'affiche comme texte. Rien d'autre ne passe dans l'adresse.
 */
export function telHref(numero: string): string | null {
  const chiffres = numero.replace(/\D/g, '')
  if (chiffres.length < 6 || chiffres.length > 15) return null
  return `tel:${/^[\s(]*\+/.test(numero) ? '+' : ''}${chiffres}`
}
