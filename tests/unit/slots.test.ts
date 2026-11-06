import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { belgianHolidays } from '../../src/lib/booking/belgian-holidays.ts'
import {
  DEFAULT_AVAILABILITY_RULES,
  DEFAULT_BOOKING_SETTINGS,
} from '../../src/lib/booking/settings.ts'
import { computeSlots, type Slot, type SlotInput } from '../../src/lib/booking/slots.ts'

/** Vendredi 15 janvier 2027, 12 h à Bruxelles. */
const NOW = new Date('2027-01-15T11:00:00Z')
const MONDAY = '2027-01-18'
const TUESDAY = '2027-01-19'
const FULL_DAY = ['10:30', '11:15', '12:00', '16:00', '16:45', '17:30']

function compute(overrides: Partial<SlotInput> = {}): Slot[] {
  return computeSlots({
    settings: DEFAULT_BOOKING_SETTINGS,
    rules: DEFAULT_AVAILABILITY_RULES,
    exceptions: [],
    bookings: [],
    busy: [],
    now: NOW,
    ...overrides,
  })
}

function timesOn(slots: Slot[], date: string): string[] {
  return slots.filter((slot) => slot.localDate === date).map((slot) => slot.localTime)
}

/** Un appel confirmé de 30 minutes, donné en heure UTC. */
function booking(startIso: string) {
  const start = new Date(startIso)
  return { start, end: new Date(start.getTime() + 30 * 60_000) }
}

describe('créneaux avec les réglages par défaut', () => {
  test('six créneaux un lundi ordinaire, de 30 minutes, à l’heure de Bruxelles', () => {
    const slots = compute()
    assert.deepEqual(timesOn(slots, MONDAY), FULL_DAY)
    const first = slots.find((slot) => slot.localDate === MONDAY)
    assert.equal(first?.start.toISOString(), '2027-01-18T09:30:00.000Z')
    assert.equal(first?.end.toISOString(), '2027-01-18T10:00:00.000Z')
  })

  test('triés du plus proche au plus lointain', () => {
    const starts = compute().map((slot) => slot.start.getTime())
    assert.deepEqual(
      starts,
      [...starts].sort((x, y) => x - y),
    )
  })

  test('aucun créneau le week-end', () => {
    const slots = compute()
    assert.deepEqual(timesOn(slots, '2027-01-16'), [])
    assert.deepEqual(timesOn(slots, '2027-01-17'), [])
  })

  test('respecte le délai minimal de 24 heures, limite comprise', () => {
    const mondayAtTen = compute({ now: new Date('2027-01-18T09:00:00Z') })
    assert.deepEqual(timesOn(mondayAtTen, MONDAY), [])
    assert.deepEqual(timesOn(mondayAtTen, TUESDAY), FULL_DAY)

    const exactlyOneDay = compute({ now: new Date('2027-01-18T09:30:00Z') })
    assert.equal(timesOn(exactlyOneDay, TUESDAY)[0], '10:30')
  })

  test('s’arrête à l’horizon de 21 jours, aujourd’hui compris', () => {
    const slots = compute()
    assert.equal(slots.at(-1)?.localDate, '2027-02-04')
    assert.deepEqual(timesOn(slots, '2027-02-05'), [])
  })
})

describe('absences', () => {
  test('un congé ferme tous ses jours, bornes comprises', () => {
    const slots = compute({
      exceptions: [{ startDate: MONDAY, endDate: TUESDAY, kind: 'leave' }],
    })
    assert.deepEqual(timesOn(slots, MONDAY), [])
    assert.deepEqual(timesOn(slots, TUESDAY), [])
    assert.deepEqual(timesOn(slots, '2027-01-20'), FULL_DAY)
  })

  test('les jours fériés belges ferment le lundi de Pâques 2027', () => {
    const exceptions = belgianHolidays(2027).map((holiday) => ({
      startDate: holiday.date,
      endDate: holiday.date,
      kind: 'holiday' as const,
    }))
    const slots = compute({ exceptions, now: new Date('2027-03-24T12:00:00Z') })
    assert.deepEqual(timesOn(slots, '2027-03-29'), [])
    assert.deepEqual(timesOn(slots, '2027-03-30'), FULL_DAY)
  })
})

describe('appels déjà pris', () => {
  test('un appel confirmé retire son créneau, pause comprise', () => {
    const slots = compute({ bookings: [booking('2027-01-18T10:15:00Z')] }) // 11 h 15 à Bruxelles
    assert.deepEqual(timesOn(slots, MONDAY), ['10:30', '12:00', '16:00', '16:45', '17:30'])
  })

  test('un appel hors grille retire tous les créneaux qu’il chevauche', () => {
    const slots = compute({ bookings: [booking('2027-01-18T10:00:00Z')] }) // 11 h à Bruxelles
    assert.deepEqual(timesOn(slots, MONDAY), ['12:00', '16:00', '16:45', '17:30'])
  })

  test('trois appels laissent les créneaux libres de la journée', () => {
    const slots = compute({
      bookings: [
        booking('2027-01-18T09:30:00Z'),
        booking('2027-01-18T10:15:00Z'),
        booking('2027-01-18T11:00:00Z'),
      ],
    })
    assert.deepEqual(timesOn(slots, MONDAY), ['16:00', '16:45', '17:30'])
  })

  test('quatre appels confirmés ferment la journée (plafond)', () => {
    const slots = compute({
      bookings: [
        booking('2027-01-18T09:30:00Z'),
        booking('2027-01-18T10:15:00Z'),
        booking('2027-01-18T11:00:00Z'),
        booking('2027-01-18T15:00:00Z'),
      ],
    })
    assert.deepEqual(timesOn(slots, MONDAY), [])
    assert.deepEqual(timesOn(slots, TUESDAY), FULL_DAY)
  })

  test('une heure occupée ailleurs retire le créneau qu’elle touche', () => {
    const slots = compute({
      busy: [{ start: new Date('2027-01-18T15:20:00Z'), end: new Date('2027-01-18T15:40:00Z') }],
    })
    assert.deepEqual(timesOn(slots, MONDAY), ['10:30', '11:15', '12:00', '16:45', '17:30'])
  })
})

describe('changements d’heure', () => {
  test('fin mars 2027 : 10 h 30 passe de 9 h 30 à 8 h 30 UTC', () => {
    const slots = compute({ now: new Date('2027-03-24T12:00:00Z') })
    const startOf = (date: string) =>
      slots.find((slot) => slot.localDate === date)?.start.toISOString()
    assert.equal(startOf('2027-03-26'), '2027-03-26T09:30:00.000Z')
    assert.equal(startOf('2027-03-30'), '2027-03-30T08:30:00.000Z')
  })

  test('fin octobre 2027 : 10 h 30 passe de 8 h 30 à 9 h 30 UTC', () => {
    const slots = compute({ now: new Date('2027-10-27T12:00:00Z') })
    const startOf = (date: string) =>
      slots.find((slot) => slot.localDate === date)?.start.toISOString()
    assert.equal(startOf('2027-10-29'), '2027-10-29T08:30:00.000Z')
    assert.equal(startOf('2027-11-02'), '2027-11-02T09:30:00.000Z')
  })
})

describe('réglages limites', () => {
  test('une plage plus courte qu’un appel ne donne aucun créneau', () => {
    assert.deepEqual(compute({ rules: [{ weekday: 1, start: '10:00', end: '10:20' }] }), [])
  })

  test('deux plages qui se chevauchent ne donnent pas de doublon', () => {
    const slots = compute({
      rules: [
        { weekday: 1, start: '10:30', end: '12:30' },
        { weekday: 1, start: '10:30', end: '11:30' },
      ],
    })
    assert.deepEqual(timesOn(slots, MONDAY), ['10:30', '11:15', '12:00'])
  })

  test('refuse une durée nulle', () => {
    assert.throws(
      () => compute({ settings: { ...DEFAULT_BOOKING_SETTINGS, durationMinutes: 0 } }),
      RangeError,
    )
  })
})
