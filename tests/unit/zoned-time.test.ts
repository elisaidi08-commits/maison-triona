import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  isoWeekday,
  minutesToTime,
  timeToMinutes,
  zonedParts,
  zonedTimeToUtc,
} from '../../src/lib/booking/zoned-time.ts'

const BRUSSELS = 'Europe/Brussels'

describe('heures locales', () => {
  test('convertit « HH:MM » en minutes et retour', () => {
    assert.equal(timeToMinutes('10:30'), 630)
    assert.equal(timeToMinutes('00:00'), 0)
    assert.equal(minutesToTime(630), '10:30')
    assert.equal(minutesToTime(0), '00:00')
  })

  test('refuse une heure mal formée', () => {
    assert.throws(() => timeToMinutes('24:00'), RangeError)
    assert.throws(() => timeToMinutes('9:30'), RangeError)
  })
})

describe('dates locales', () => {
  test('ajoute des jours en passant les fins de mois et les années bissextiles', () => {
    assert.equal(addDays('2027-02-28', 1), '2027-03-01')
    assert.equal(addDays('2028-02-28', 1), '2028-02-29')
    assert.equal(addDays('2027-12-31', 1), '2028-01-01')
    assert.equal(addDays('2027-03-01', -1), '2027-02-28')
  })

  test('donne le jour de la semaine ISO', () => {
    assert.equal(isoWeekday('2027-01-18'), 1)
    assert.equal(isoWeekday('2027-03-28'), 7)
  })

  test('refuse une date mal formée', () => {
    assert.throws(() => addDays('18/01/2027', 1), RangeError)
  })

  test('refuse une date impossible', () => {
    assert.throws(() => addDays('2027-02-30', 0), RangeError)
    assert.throws(() => addDays('2027-01-00', 1), RangeError)
    assert.throws(() => isoWeekday('2027-13-01'), RangeError)
  })
})

describe('fuseau de Bruxelles', () => {
  test('10 h 30 en hiver et en été', () => {
    assert.equal(
      zonedTimeToUtc('2027-01-18', '10:30', BRUSSELS).toISOString(),
      '2027-01-18T09:30:00.000Z',
    )
    assert.equal(
      zonedTimeToUtc('2027-07-15', '10:30', BRUSSELS).toISOString(),
      '2027-07-15T08:30:00.000Z',
    )
  })

  test('10 h 30 les jours de changement d’heure', () => {
    assert.equal(
      zonedTimeToUtc('2027-03-28', '10:30', BRUSSELS).toISOString(),
      '2027-03-28T08:30:00.000Z',
    )
    assert.equal(
      zonedTimeToUtc('2027-10-31', '10:30', BRUSSELS).toISOString(),
      '2027-10-31T09:30:00.000Z',
    )
  })

  test('une heure qui n’existe pas (passage à l’heure d’été) est décalée d’une heure', () => {
    assert.equal(
      zonedTimeToUtc('2027-03-28', '02:30', BRUSSELS).toISOString(),
      '2027-03-28T01:30:00.000Z',
    )
  })

  test('une heure qui existe deux fois (retour à l’heure d’hiver) donne la seconde', () => {
    assert.equal(
      zonedTimeToUtc('2027-10-31', '02:30', BRUSSELS).toISOString(),
      '2027-10-31T01:30:00.000Z',
    )
  })

  test('refuse un fuseau inconnu', () => {
    assert.throws(() => zonedTimeToUtc('2027-01-18', '10:30', 'Europe/Atlantide'), RangeError)
  })

  test('lit la date et l’heure locales, de part et d’autre du passage à l’heure d’été', () => {
    assert.deepEqual(zonedParts(new Date('2027-03-28T00:30:00Z'), BRUSSELS), {
      date: '2027-03-28',
      time: '01:30',
    })
    assert.deepEqual(zonedParts(new Date('2027-03-28T01:30:00Z'), BRUSSELS), {
      date: '2027-03-28',
      time: '03:30',
    })
  })

  test('change de date à minuit heure locale, pas à minuit UTC', () => {
    assert.deepEqual(zonedParts(new Date('2027-01-17T23:30:00Z'), BRUSSELS), {
      date: '2027-01-18',
      time: '00:30',
    })
  })
})
