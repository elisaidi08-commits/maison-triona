import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RETENTION_MONTHS, retentionDeadline } from '../../src/lib/vault/retention.ts'

describe('retentionDeadline', () => {
  it('garde le plafond proposé de 12 mois', () => {
    assert.equal(RETENTION_MONTHS, 12)
  })

  it('ramène au dernier jour du mois quand le jour n’existe pas', () => {
    assert.equal(
      retentionDeadline(new Date('2027-01-31T08:30:00Z'), 1).toISOString(),
      '2027-02-28T08:30:00.000Z',
    )
  })

  it('ramène le 29 février au 28 février d’une année non bissextile', () => {
    assert.equal(
      retentionDeadline(new Date('2028-02-29T00:00:00Z'), 12).toISOString(),
      '2029-02-28T00:00:00.000Z',
    )
  })

  it('garde le même jour et la même heure UTC', () => {
    assert.equal(
      retentionDeadline(new Date('2027-03-15T10:00:00Z'), 12).toISOString(),
      '2028-03-15T10:00:00.000Z',
    )
  })

  it('refuse un nombre de mois non entier ou négatif, et une date invalide', () => {
    const date = new Date('2027-03-15T10:00:00Z')
    assert.throws(() => retentionDeadline(date, 1.5), RangeError)
    assert.throws(() => retentionDeadline(date, -1), RangeError)
    assert.throws(() => retentionDeadline(date, Number.NaN), RangeError)
    assert.throws(() => retentionDeadline(new Date('pas une date'), 12), RangeError)
  })
})
