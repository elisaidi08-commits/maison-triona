/**
 * Assemblage des disponibilités lues en base (story 3.8, partie B) au format de `computeSlots`.
 * Fonctions pures : les lignes arrivent de src/lib/booking/repository.ts, heures « HH:MM » et dates
 * « YYYY-MM-DD » déjà converties en texte par la requête (jamais d'objet Date pour une date locale :
 * le pilote la lirait dans le fuseau du serveur).
 */
import type {
  AvailabilityException,
  AvailabilityRule,
  BookingSettings,
  ExceptionKind,
} from './settings.ts'
import type { BookedCall, SlotInput } from './slots.ts'
import {
  addDays,
  timeToMinutes,
  zonedParts,
  zonedTimeToUtc,
  type IsoWeekday,
} from './zoned-time.ts'

/** Ligne de `booking_settings`. */
export interface SettingsRow {
  time_zone: string
  duration_minutes: number
  buffer_minutes: number
  min_notice_minutes: number
  horizon_days: number
  daily_cap: number
}

/** Ligne de `availability_rules`, heures en « HH:MM ». */
export interface RuleRow {
  id: string
  weekday: number
  start_time: string
  end_time: string
}

/** Ligne de `availability_exceptions`, dates en « YYYY-MM-DD ». */
export interface ExceptionRow {
  id: string
  kind: string
  start_date: string
  end_date: string
  label: string | null
  active: boolean
}

export interface AvailabilityRows {
  settings: SettingsRow
  rules: RuleRow[]
  exceptions: ExceptionRow[]
}

export interface StoredRule extends AvailabilityRule {
  id: string
}

/** Une absence telle qu'en base : `active` ne vaut faux que pour un jour férié décoché. */
export interface StoredException extends AvailabilityException {
  id: string
  label: string | null
  active: boolean
}

/** Ce que montre /coffre/disponibilites : réglages, plages et absences, identifiants compris. */
export interface AvailabilityState {
  settings: BookingSettings
  rules: StoredRule[]
  exceptions: StoredException[]
}

/** Ce qu'attend `computeSlots`, hors appels confirmés, heures occupées et horloge. */
export type SlotConfig = Pick<SlotInput, 'settings' | 'rules' | 'exceptions'>

const KINDS: readonly ExceptionKind[] = ['leave', 'holiday', 'blocked']

// Sans valeur dans le message : seulement ce qui est illisible.
function illisible(what: string): never {
  throw new RangeError(`Disponibilités : ${what} illisible`)
}

function count(value: number, what: string): number {
  if (!Number.isInteger(value)) illisible(what)
  return value
}

function toSettings(row: SettingsRow): BookingSettings {
  if (typeof row.time_zone !== 'string' || row.time_zone === '') illisible('fuseau')
  return {
    timeZone: row.time_zone,
    durationMinutes: count(row.duration_minutes, 'durée'),
    bufferMinutes: count(row.buffer_minutes, 'pause'),
    minNoticeMinutes: count(row.min_notice_minutes, 'délai'),
    horizonDays: count(row.horizon_days, 'horizon'),
    dailyCap: count(row.daily_cap, 'plafond'),
  }
}

function isWeekday(value: number): value is IsoWeekday {
  return Number.isInteger(value) && value >= 1 && value <= 7
}

function minutes(time: string): number {
  try {
    return timeToMinutes(time)
  } catch {
    return illisible('heure')
  }
}

function toRule(row: RuleRow): StoredRule {
  if (!isWeekday(row.weekday)) illisible('jour')
  if (minutes(row.start_time) >= minutes(row.end_time)) illisible('plage')
  return { id: row.id, weekday: row.weekday, start: row.start_time, end: row.end_time }
}

function isKind(value: string): value is ExceptionKind {
  return (KINDS as readonly string[]).includes(value)
}

function checkDate(date: string): string {
  try {
    // addDays refuse toute date qui n'est pas « YYYY-MM-DD » ou qui n'existe pas (30 février).
    if (addDays(date, 0) !== date) illisible('date')
  } catch {
    illisible('date')
  }
  return date
}

function toException(row: ExceptionRow): StoredException {
  if (!isKind(row.kind)) illisible('type d’absence')
  const startDate = checkDate(row.start_date)
  const endDate = checkDate(row.end_date)
  if (startDate > endDate) illisible('absence')
  return {
    id: row.id,
    kind: row.kind,
    startDate,
    endDate,
    label: row.label,
    active: row.active === true,
  }
}

/** Lignes de la base → état de la page ; plages triées par jour et heure, absences par date. */
export function toAvailabilityState(rows: AvailabilityRows): AvailabilityState {
  return {
    settings: toSettings(rows.settings),
    rules: rows.rules
      .map(toRule)
      .sort((x, y) => x.weekday - y.weekday || x.start.localeCompare(y.start)),
    exceptions: rows.exceptions
      .map(toException)
      .sort((x, y) => x.startDate.localeCompare(y.startDate) || x.kind.localeCompare(y.kind)),
  }
}

/** État → paramètres de `computeSlots` : seules les absences actives comptent. */
export function toSlotConfig(state: AvailabilityState): SlotConfig {
  return {
    settings: { ...state.settings },
    rules: state.rules.map(({ weekday, start, end }) => ({ weekday, start, end })),
    exceptions: state.exceptions
      .filter((exception) => exception.active)
      .map(({ startDate, endDate, kind }) => ({ startDate, endDate, kind })),
  }
}

/**
 * Appels confirmés qui tombent pendant une absence, par date locale du fuseau des réglages.
 * Bloquer une journée ne les annule pas : le coffre les signale (spec §3.1, §5).
 */
export function callsDuring(
  calls: BookedCall[],
  absence: Pick<AvailabilityException, 'startDate' | 'endDate'>,
  timeZone: string,
): BookedCall[] {
  return calls.filter((call) => {
    const { date } = zonedParts(call.start, timeZone)
    return absence.startDate <= date && date <= absence.endDate
  })
}

/**
 * Période des appels confirmés à lire pour calculer les créneaux à cet instant : du début du jour
 * local (les appels déjà passés aujourd'hui comptent dans le plafond du jour) au lendemain du dernier
 * jour de l'horizon. Rien avant : un appel passé ne bloque plus aucun créneau.
 */
export function bookingWindow(
  settings: Pick<BookingSettings, 'timeZone' | 'horizonDays'>,
  now: Date,
): { from: Date; to: Date } {
  if (Number.isNaN(now.getTime())) throw new RangeError('Date invalide')
  const today = zonedParts(now, settings.timeZone).date
  return {
    from: zonedTimeToUtc(today, '00:00', settings.timeZone),
    to: zonedTimeToUtc(addDays(today, settings.horizonDays + 1), '00:00', settings.timeZone),
  }
}
