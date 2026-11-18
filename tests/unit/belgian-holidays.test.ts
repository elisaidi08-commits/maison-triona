import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { belgianHolidays, easterSunday } from '../../src/lib/booking/belgian-holidays.ts'

describe('jours fériés belges', () => {
  test('dimanche de Pâques de 2024 à 2028', () => {
    assert.equal(easterSunday(2024), '2024-03-31')
    assert.equal(easterSunday(2025), '2025-04-20')
    assert.equal(easterSunday(2026), '2026-04-05')
    assert.equal(easterSunday(2027), '2027-03-28')
    assert.equal(easterSunday(2028), '2028-04-16')
  })

  test('les dix jours fériés de 2027', () => {
    assert.deepEqual(
      belgianHolidays(2027).map((holiday) => holiday.date),
      [
        '2027-01-01',
        '2027-03-29',
        '2027-05-01',
        '2027-05-06',
        '2027-05-17',
        '2027-07-21',
        '2027-08-15',
        '2027-11-01',
        '2027-11-11',
        '2027-12-25',
      ],
    )
  })

  test('les fêtes mobiles de 2026', () => {
    const byName = new Map(belgianHolidays(2026).map((holiday) => [holiday.name, holiday.date]))
    assert.equal(byName.get('Lundi de Pâques'), '2026-04-06')
    assert.equal(byName.get('Ascension'), '2026-05-14')
    assert.equal(byName.get('Lundi de Pentecôte'), '2026-05-25')
  })

  test('reste trié quand l’Ascension précède le 1er mai (Pâques le 22 mars 2285)', () => {
    assert.equal(easterSunday(2285), '2285-03-22')
    const dates = belgianHolidays(2285).map((holiday) => holiday.date)
    assert.deepEqual(dates, [...dates].sort())
    assert.equal(dates.indexOf('2285-04-30'), 2)
  })
})
