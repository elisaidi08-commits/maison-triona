/**
 * Déplacer et annuler un appel (story 3.11 ; docs/reservation-appel.md §2, étape 6, §3.2), règles
 * pures : où en est un appel à cet instant, et ce qu'on peut encore en faire. Les mêmes règles sont
 * imposées par la base, sous tout rôle (déclencheurs de db/migrations/0014_deplacer_annuler.sql), qui
 * a le dernier mot ; elles servent ici à afficher la bonne page sans rien écrire.
 * Imports relatifs seulement : testé par node --test, lu aussi par les pages.
 */
import type { BookingStatus } from './agenda.ts'

/** Statuts d'un appel annulé : par la personne (lien de gestion), par la maison (coffre). */
export const CANCELLED_STATUSES = ['cancelled_by_guest', 'cancelled_by_house'] as const
export type CancelledStatus = (typeof CANCELLED_STATUSES)[number]

/**
 * - `upcoming` : confirmé, pas encore commencé : il se déplace et s'annule ;
 * - `started` : commencé (ou déjà qualifié), pas encore fini : on ne peut plus rien y changer ;
 * - `cancelled` : annulé, par la personne ou par la maison ;
 * - `over` : fini.
 */
export type CallPhase = 'upcoming' | 'started' | 'cancelled' | 'over'

export interface CallMoment {
  status: BookingStatus
  startsAt: Date
  endsAt: Date
}

export function isCancelled(status: string): status is CancelledStatus {
  return (CANCELLED_STATUSES as readonly string[]).includes(status)
}

export function callPhase(call: CallMoment, now: Date): CallPhase {
  if (Number.isNaN(now.getTime())) throw new RangeError('Date invalide')
  if (isCancelled(call.status)) return 'cancelled'
  if (now.getTime() >= call.endsAt.getTime()) return 'over'
  if (call.status !== 'confirmed' || now.getTime() >= call.startsAt.getTime()) return 'started'
  return 'upcoming'
}

/** Déplacer ou annuler : seulement un appel confirmé qui n'a pas commencé. */
export function canChange(call: CallMoment, now: Date): boolean {
  return callPhase(call, now) === 'upcoming'
}
