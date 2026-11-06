/**
 * Dates et heures locales dans un fuseau, sans dépendance (API Intl).
 * Node 24 n'a pas encore Temporal (spec réservation d'appel §4.3).
 * Conventions : date locale « YYYY-MM-DD », heure locale « HH:MM » sur 24 heures.
 */

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

const MINUTE_MS = 60_000
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Ce qu'affiche une horloge murale du fuseau à cet instant. */
function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Décalage du fuseau à cet instant, en minutes (Bruxelles : 60 en hiver, 120 en été). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const clock = wallClock(instant, timeZone)
  const wallAsUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  )
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000
  return Math.round((wallAsUtc - wholeSeconds) / MINUTE_MS)
}

const pad = (value: number): string => String(value).padStart(2, '0')

function parseDate(date: string): [number, number, number] {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new RangeError(`Date invalide : ${date}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** « 10:30 » → 630. Refuse tout ce qui n'est pas « HH:MM » entre 00:00 et 23:59. */
export function timeToMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time)
  if (!match) throw new RangeError(`Heure invalide : ${time}`)
  return Number(match[1]) * 60 + Number(match[2])
}

/** 630 → « 10:30 ». */
export function minutesToTime(totalMinutes: number): string {
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`
}

/** Ajoute (ou retire) des jours à une date locale. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = parseDate(date)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Jour de la semaine ISO d'une date locale. */
export function isoWeekday(date: string): IsoWeekday {
  const [year, month, day] = parseDate(date)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = dimanche
  return (weekday === 0 ? 7 : weekday) as IsoWeekday
}

/** Date et heure locales d'un instant dans le fuseau. */
export function zonedParts(instant: Date, timeZone: string): { date: string; time: string } {
  const clock = wallClock(instant, timeZone)
  return {
    date: `${clock.year}-${pad(clock.month)}-${pad(clock.day)}`,
    time: `${pad(clock.hour)}:${pad(clock.minute)}`,
  }
}

/**
 * Instant correspondant à une date et une heure locales. Deux passes : le décalage est relu
 * après la première conversion, ce qui suffit autour des changements d'heure. Une heure qui
 * n'existe pas (passage à l'heure d'été) est décalée d'une heure plus tard ; une heure qui existe
 * deux fois (retour à l'heure d'hiver) donne la seconde.
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = parseDate(date)
  const minutes = timeToMinutes(time)
  const wallAsUtc = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
  const firstGuess = wallAsUtc - offsetMinutes(new Date(wallAsUtc), timeZone) * MINUTE_MS
  return new Date(wallAsUtc - offsetMinutes(new Date(firstGuess), timeZone) * MINUTE_MS)
}
