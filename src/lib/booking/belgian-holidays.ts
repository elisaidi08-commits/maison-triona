/**
 * Les dix jours fériés légaux belges, préremplis comme absences dans les réglages de Cat
 * (spec réservation d'appel §3.1). Libellés internes au coffre, en français.
 */
import { addDays } from './zoned-time.ts'

export interface Holiday {
  date: string
  name: string
}

/** Dimanche de Pâques, calendrier grégorien (algorithme de Meeus, Jones et Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = h + l - 7 * m + 114
  const month = Math.floor(n / 31)
  const day = (n % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Jours fériés belges d'une année, triés par date. */
export function belgianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)
  const holidays: Holiday[] = [
    { date: `${year}-01-01`, name: "Jour de l'An" },
    { date: addDays(easter, 1), name: 'Lundi de Pâques' },
    { date: `${year}-05-01`, name: 'Fête du Travail' },
    { date: addDays(easter, 39), name: 'Ascension' },
    { date: addDays(easter, 50), name: 'Lundi de Pentecôte' },
    { date: `${year}-07-21`, name: 'Fête nationale' },
    { date: `${year}-08-15`, name: 'Assomption' },
    { date: `${year}-11-01`, name: 'Toussaint' },
    { date: `${year}-11-11`, name: 'Armistice' },
    { date: `${year}-12-25`, name: 'Noël' },
  ]
  // L'Ascension peut tomber avant le 1er mai quand Pâques est très tôt (22 mars).
  return holidays.sort((x, y) => x.date.localeCompare(y.date))
}
