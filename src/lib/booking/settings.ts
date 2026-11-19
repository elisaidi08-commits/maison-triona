/**
 * Réglages de la réservation d'appel (spec §3.1). Les valeurs par défaut ont été validées par
 * Sady le 06/11/2026 ; Cat les modifie depuis le coffre (story 3.8, partie B).
 */
import type { IsoWeekday } from './zoned-time.ts'

export interface BookingSettings {
  /** Fuseau des plages de Cat. */
  timeZone: string
  /** Durée d'un appel. */
  durationMinutes: number
  /** Pause après chaque appel. */
  bufferMinutes: number
  /** Délai minimal entre maintenant et le début d'un appel. */
  minNoticeMinutes: number
  /** Nombre de jours réservables, aujourd'hui compris. */
  horizonDays: number
  /** Nombre maximal d'appels confirmés par jour. */
  dailyCap: number
}

/** Une plage d'ouverture de la semaine type, en heure locale. */
export interface AvailabilityRule {
  weekday: IsoWeekday
  start: string
  end: string
}

export type ExceptionKind = 'leave' | 'holiday' | 'blocked'

/** Une absence : congé, jour férié ou journée bloquée, dates locales incluses. */
export interface AvailabilityException {
  startDate: string
  endDate: string
  kind: ExceptionKind
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  timeZone: 'Europe/Brussels',
  durationMinutes: 30,
  bufferMinutes: 15,
  minNoticeMinutes: 24 * 60,
  horizonDays: 21,
  dailyCap: 4,
}

/** Les réglages que Cat modifie dans le coffre (tout sauf le fuseau, figé sur Bruxelles). */
export type EditableBookingSettings = Omit<BookingSettings, 'timeZone'>

export interface SettingLimit {
  min: number
  max: number
  step: number
}

/**
 * Bornes des réglages : validation du coffre (src/lib/validation/disponibilites.ts) et contraintes
 * de la base (db/migrations/0007_disponibilites.sql), qui les doublent. Délai minimal : d'une heure à
 * une semaine, à l'heure près ; horizon : jusqu'à trois mois.
 */
export const SETTINGS_LIMITS: Record<keyof EditableBookingSettings, SettingLimit> = {
  durationMinutes: { min: 15, max: 120, step: 5 },
  bufferMinutes: { min: 0, max: 60, step: 5 },
  minNoticeMinutes: { min: 60, max: 7 * 24 * 60, step: 60 },
  horizonDays: { min: 1, max: 90, step: 1 },
  dailyCap: { min: 1, max: 12, step: 1 },
}

const WORKING_DAYS: IsoWeekday[] = [1, 2, 3, 4, 5]

/** Lundi à vendredi, fin de matinée et fin d'après-midi (D41). */
export const DEFAULT_AVAILABILITY_RULES: AvailabilityRule[] = WORKING_DAYS.flatMap((weekday) => [
  { weekday, start: '10:30', end: '12:30' },
  { weekday, start: '16:00', end: '18:00' },
])
