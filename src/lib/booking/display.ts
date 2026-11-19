/**
 * Libellés des créneaux de la page de réservation (story 3.10 ; docs/reservation-appel.md §2) :
 * composés ici, sur le serveur, dans la langue de la page ; le navigateur les reçoit tout faits (pas
 * d'écart de formatage entre le rendu serveur et l'hydratation). Heure de Bruxelles (spec §2). La
 * mise en ordre (tête, semaines, jours) est dans ./grouping.ts, sans Intl, lue aussi par le
 * navigateur.
 * Imports relatifs seulement : testé par node --test.
 */
import type { CreneauAffiche } from './form.ts'
import type { Slot } from './slots.ts'
import { addDays, isoWeekday } from './zoned-time.ts'

export type Langue = 'fr' | 'en'

const JOUR: Record<Langue, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }),
  en: new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }),
}

const JOUR_MOIS: Record<Langue, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }),
}

// Date locale lue comme telle : midi UTC, aucun fuseau ne la fait changer de jour.
function midi(date: string): Date {
  const [annee, mois, jour] = date.split('-').map(Number)
  return new Date(Date.UTC(annee ?? 0, (mois ?? 1) - 1, jour ?? 1, 12))
}

// « 1 mars » → « 1er mars » (typographie française).
function premier(texte: string): string {
  return texte.replace(/(^|\s)1 /u, '$11er ')
}

function capitale(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/** « Mardi 2 mars » · « Tuesday 2 March ». */
export function libelleJour(date: string, langue: Langue): string {
  const texte = JOUR[langue].format(midi(date))
  return langue === 'fr' ? capitale(premier(texte)) : texte
}

/** « 1er mars » · « 1 March ». */
export function libelleJourMois(date: string, langue: Langue): string {
  const texte = JOUR_MOIS[langue].format(midi(date))
  return langue === 'fr' ? premier(texte) : texte
}

/** « 10:30 » → « 10 h 30 », « 16:00 » → « 16 h » ; en anglais, « 10:30 » tel quel. */
export function libelleHeure(heure: string, langue: Langue): string {
  if (langue === 'en') return heure
  const [heures = '', minutes = ''] = heure.split(':')
  const h = String(Number(heures))
  return minutes === '00' ? `${h} h` : `${h} h ${minutes}`
}

/** Lundi de la semaine d'une date locale. */
export function lundiDe(date: string): string {
  return addDays(date, 1 - isoWeekday(date))
}

export function presenterCreneaux(slots: Slot[], langue: Langue): CreneauAffiche[] {
  return slots.map((slot) => {
    const semaine = lundiDe(slot.localDate)
    return {
      debut: slot.start.toISOString(),
      jour: slot.localDate,
      semaine,
      libelleJour: libelleJour(slot.localDate, langue),
      libelleHeure: libelleHeure(slot.localTime, langue),
      libelleSemaine: libelleJourMois(semaine, langue),
    }
  })
}
