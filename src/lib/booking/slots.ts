/**
 * Calcul des créneaux réservables (spec réservation d'appel §4.3). Fonction pure : aucune
 * lecture de base, d'horloge ni de réseau ; tout arrive en paramètre.
 */
import type { AvailabilityException, AvailabilityRule, BookingSettings } from './settings.ts'
import {
  addDays,
  isoWeekday,
  minutesToTime,
  timeToMinutes,
  zonedParts,
  zonedTimeToUtc,
} from './zoned-time.ts'

export interface TimeInterval {
  start: Date
  end: Date
}

/** Un appel confirmé, tel qu'enregistré en base (colonne `slot`). */
export interface BookedCall {
  start: Date
  /** Borne haute de `slot` : fin de l'appel + pause en vigueur au moment de la réservation. */
  occupiedUntil: Date
}

export interface Slot {
  start: Date
  end: Date
  /** Date locale dans le fuseau des réglages, « YYYY-MM-DD ». */
  localDate: string
  /** Heure locale de début, « HH:MM ». */
  localTime: string
}

export interface SlotInput {
  settings: BookingSettings
  rules: AvailabilityRule[]
  exceptions: AvailabilityException[]
  /** Appels confirmés, sans celui que la personne est en train de déplacer. */
  bookings: BookedCall[]
  /** Heures occupées venues d'ailleurs (agenda Google, story 3.14). */
  busy: TimeInterval[]
  now: Date
}

const MINUTE_MS = 60_000

interface Range {
  start: number
  end: number
}

function overlapsAny(start: number, end: number, ranges: Range[]): boolean {
  return ranges.some((range) => start < range.end && range.start < end)
}

function countByLocalDate(calls: BookedCall[], timeZone: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { start } of calls) {
    const { date } = zonedParts(start, timeZone)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return counts
}

/** Filet de sécurité : la validation Zod du coffre (story 3.8, partie B) reste le vrai garde. */
function assertValidSettings(settings: BookingSettings): void {
  const { durationMinutes, bufferMinutes, minNoticeMinutes, horizonDays, dailyCap } = settings
  const isCount = (value: number): boolean => Number.isInteger(value) && value >= 0
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    ![bufferMinutes, minNoticeMinutes, horizonDays, dailyCap].every(isCount)
  ) {
    throw new RangeError('Réglages invalides')
  }
}

/**
 * Créneaux réservables, du plus proche au plus lointain. Un créneau occupe [début, fin + pause),
 * comme un appel confirmé : c'est la même règle que la contrainte d'exclusion en base (§4.2).
 * Les appels confirmés gardent la plage enregistrée en base, même si Cat a changé la pause depuis.
 */
export function computeSlots(input: SlotInput): Slot[] {
  const { settings, rules, exceptions, bookings, busy, now } = input
  assertValidSettings(settings)

  const bufferMs = settings.bufferMinutes * MINUTE_MS
  const durationMs = settings.durationMinutes * MINUTE_MS
  const step = settings.durationMinutes + settings.bufferMinutes
  const earliest = now.getTime() + settings.minNoticeMinutes * MINUTE_MS
  const today = zonedParts(now, settings.timeZone).date
  const bookingsPerDay = countByLocalDate(bookings, settings.timeZone)
  const taken: Range[] = bookings.map((call) => ({
    start: call.start.getTime(),
    end: call.occupiedUntil.getTime(),
  }))
  const external: Range[] = busy.map((interval) => ({
    start: interval.start.getTime(),
    end: interval.end.getTime(),
  }))

  const slots: Slot[] = []
  const seen = new Set<number>()

  for (let offset = 0; offset < settings.horizonDays; offset++) {
    const date = addDays(today, offset)
    if ((bookingsPerDay.get(date) ?? 0) >= settings.dailyCap) continue
    if (exceptions.some((absence) => absence.startDate <= date && date <= absence.endDate)) continue

    const weekday = isoWeekday(date)
    for (const rule of rules.filter((candidate) => candidate.weekday === weekday)) {
      const ruleEnd = timeToMinutes(rule.end)
      for (
        let minute = timeToMinutes(rule.start);
        minute + settings.durationMinutes <= ruleEnd;
        minute += step
      ) {
        const localTime = minutesToTime(minute)
        const start = zonedTimeToUtc(date, localTime, settings.timeZone).getTime()
        const occupiedEnd = start + durationMs + bufferMs
        if (start < earliest || seen.has(start)) continue
        if (overlapsAny(start, occupiedEnd, taken)) continue
        if (overlapsAny(start, occupiedEnd, external)) continue
        seen.add(start)
        slots.push({
          start: new Date(start),
          end: new Date(start + durationMs),
          localDate: date,
          localTime,
        })
      }
    }
  }

  return slots.sort((x, y) => x.start.getTime() - y.start.getTime())
}
