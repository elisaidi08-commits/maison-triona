import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  bookingWindow,
  callsDuring,
  toAvailabilityState,
  toSlotConfig,
  type AvailabilityRows,
} from '../../src/lib/booking/config.ts'
import {
  DEFAULT_AVAILABILITY_RULES,
  DEFAULT_BOOKING_SETTINGS,
} from '../../src/lib/booking/settings.ts'
import { computeSlots } from '../../src/lib/booking/slots.ts'

// Assemblage des réglages lus en base (story 3.8 B) au format de computeSlots : lignes de
// booking_settings, availability_rules et availability_exceptions, telles que les rend
// src/lib/booking/repository.ts (heures « HH:MM » et dates « YYYY-MM-DD » déjà en texte).

const SETTINGS_ROW = {
  time_zone: 'Europe/Brussels',
  duration_minutes: 30,
  buffer_minutes: 15,
  min_notice_minutes: 1440,
  horizon_days: 21,
  daily_cap: 4,
}

let suivant = 0
const id = () => `00000000-0000-4000-8000-${String(++suivant).padStart(12, '0')}`

const DEFAULT_ROWS: AvailabilityRows = {
  settings: SETTINGS_ROW,
  rules: DEFAULT_AVAILABILITY_RULES.map((rule) => ({
    id: id(),
    weekday: rule.weekday,
    start_time: rule.start,
    end_time: rule.end,
  })),
  exceptions: [],
}

function holiday(date: string, active = true) {
  return {
    id: id(),
    kind: 'holiday',
    start_date: date,
    end_date: date,
    label: 'Fête nationale',
    active,
  }
}

describe('assemblage des réglages pour computeSlots', () => {
  test('les lignes par défaut donnent les réglages et la semaine type par défaut', () => {
    const config = toSlotConfig(toAvailabilityState(DEFAULT_ROWS))
    assert.deepEqual(config.settings, DEFAULT_BOOKING_SETTINGS)
    assert.deepEqual(config.rules, DEFAULT_AVAILABILITY_RULES)
    assert.deepEqual(config.exceptions, [])

    // Même calcul qu'avec les constantes de la partie A.
    const now = new Date('2027-01-15T11:00:00Z')
    const extra = { bookings: [], busy: [], now }
    assert.deepEqual(
      computeSlots({ ...config, ...extra }),
      computeSlots({
        settings: DEFAULT_BOOKING_SETTINGS,
        rules: DEFAULT_AVAILABILITY_RULES,
        exceptions: [],
        ...extra,
      }),
    )
  })

  test('garde les identifiants et les noms dans l’état, pas dans la configuration du calcul', () => {
    const rows = {
      ...DEFAULT_ROWS,
      exceptions: [
        holiday('2027-07-21'),
        {
          id: id(),
          kind: 'leave',
          start_date: '2027-02-01',
          end_date: '2027-02-05',
          label: null,
          active: true,
        },
      ],
    }
    const state = toAvailabilityState(rows)
    assert.deepEqual(
      state.exceptions.map((exception) => exception.label),
      [null, 'Fête nationale'],
    )
    assert.ok(state.rules.every((rule) => typeof rule.id === 'string'))
    assert.deepEqual(toSlotConfig(state).exceptions, [
      { startDate: '2027-02-01', endDate: '2027-02-05', kind: 'leave' },
      { startDate: '2027-07-21', endDate: '2027-07-21', kind: 'holiday' },
    ])
  })

  test('un jour férié décoché n’est plus une absence ; recoché, il le redevient', () => {
    const now = new Date('2027-07-16T08:00:00Z') // vendredi 16 juillet 2027
    const extra = { bookings: [], busy: [], now }
    const decoche = toSlotConfig(
      toAvailabilityState({ ...DEFAULT_ROWS, exceptions: [holiday('2027-07-21', false)] }),
    )
    assert.deepEqual(decoche.exceptions, [])
    assert.ok(
      computeSlots({ ...decoche, ...extra }).some((slot) => slot.localDate === '2027-07-21'),
    )

    const recoche = toSlotConfig(
      toAvailabilityState({ ...DEFAULT_ROWS, exceptions: [holiday('2027-07-21', true)] }),
    )
    assert.ok(
      !computeSlots({ ...recoche, ...extra }).some((slot) => slot.localDate === '2027-07-21'),
    )
  })

  test('trie la semaine type par jour et par heure', () => {
    const rows = {
      ...DEFAULT_ROWS,
      rules: [
        { id: id(), weekday: 3, start_time: '16:00', end_time: '18:00' },
        { id: id(), weekday: 1, start_time: '16:00', end_time: '18:00' },
        { id: id(), weekday: 1, start_time: '09:00', end_time: '10:00' },
      ],
    }
    assert.deepEqual(
      toSlotConfig(toAvailabilityState(rows)).rules.map((rule) => `${rule.weekday} ${rule.start}`),
      ['1 09:00', '1 16:00', '3 16:00'],
    )
  })

  test('refuse une ligne illisible plutôt que de proposer de faux créneaux', () => {
    const casses: AvailabilityRows[] = [
      { ...DEFAULT_ROWS, settings: { ...SETTINGS_ROW, duration_minutes: 30.5 } },
      { ...DEFAULT_ROWS, settings: { ...SETTINGS_ROW, daily_cap: Number.NaN } },
      {
        ...DEFAULT_ROWS,
        rules: [{ id: id(), weekday: 0, start_time: '09:00', end_time: '10:00' }],
      },
      { ...DEFAULT_ROWS, rules: [{ id: id(), weekday: 1, start_time: '9:00', end_time: '10:00' }] },
      {
        ...DEFAULT_ROWS,
        rules: [{ id: id(), weekday: 1, start_time: '11:00', end_time: '10:00' }],
      },
      { ...DEFAULT_ROWS, exceptions: [{ ...holiday('2027-02-30') }] },
      { ...DEFAULT_ROWS, exceptions: [{ ...holiday('2027-07-21'), kind: 'autre' }] },
      {
        ...DEFAULT_ROWS,
        exceptions: [{ ...holiday('2027-07-21'), start_date: '2027-07-22' }],
      },
    ]
    for (const rows of casses) {
      assert.throws(() => toAvailabilityState(rows), RangeError)
    }
  })
})

describe('appels pendant une absence (journée bloquée qui a déjà des appels)', () => {
  const appel = (iso: string) => {
    const start = new Date(iso)
    return { start, occupiedUntil: new Date(start.getTime() + 45 * 60_000) }
  }

  test('compte les appels par date locale de Bruxelles, bornes incluses', () => {
    const calls = [
      appel('2027-02-01T09:30:00Z'), // lundi 1er février, 10 h 30
      appel('2027-02-05T16:00:00Z'), // vendredi 5 février, 17 h
      appel('2027-02-05T23:30:00Z'), // samedi 6 février, 0 h 30 à Bruxelles
      appel('2027-01-31T22:59:00Z'), // dimanche 31 janvier, 23 h 59
    ]
    const pendant = callsDuring(
      calls,
      { startDate: '2027-02-01', endDate: '2027-02-05' },
      'Europe/Brussels',
    )
    assert.deepEqual(
      pendant.map((call) => call.start.toISOString()),
      ['2027-02-01T09:30:00.000Z', '2027-02-05T16:00:00.000Z'],
    )
  })

  test('sans appel confirmé (avant la story 3.10), rien à signaler', () => {
    assert.deepEqual(
      callsDuring([], { startDate: '2027-02-01', endDate: '2027-02-01' }, 'Europe/Brussels'),
      [],
    )
  })
})

describe('période des appels à lire (story 3.10)', () => {
  test('du début du jour local au lendemain du dernier jour de l’horizon, heure d’été comprise', () => {
    const periode = bookingWindow(
      { timeZone: 'Europe/Brussels', horizonDays: 21 },
      new Date('2027-03-15T23:30:00Z'),
    )
    // 16 mars à 0 h 30 à Bruxelles : le jour local est le 16.
    assert.equal(periode.from.toISOString(), '2027-03-15T23:00:00.000Z')
    // 16 + 22 jours = 7 avril, à minuit, heure d'été (UTC+2).
    assert.equal(periode.to.toISOString(), '2027-04-06T22:00:00.000Z')
    assert.throws(() => bookingWindow(DEFAULT_BOOKING_SETTINGS, new Date(Number.NaN)), RangeError)
  })

  test('un appel déjà passé aujourd’hui compte dans le plafond du jour', () => {
    const now = new Date('2027-03-02T11:00:00Z')
    const { from } = bookingWindow(DEFAULT_BOOKING_SETTINGS, now)
    const matin = new Date('2027-03-02T09:30:00Z')
    assert.ok(from.getTime() <= matin.getTime())
    const slots = computeSlots({
      settings: { ...DEFAULT_BOOKING_SETTINGS, minNoticeMinutes: 60, dailyCap: 1 },
      rules: DEFAULT_AVAILABILITY_RULES,
      exceptions: [],
      bookings: [{ start: matin, occupiedUntil: new Date('2027-03-02T10:15:00Z') }],
      busy: [],
      now,
    })
    assert.ok(slots.every((slot) => slot.localDate !== '2027-03-02'))
  })
})
