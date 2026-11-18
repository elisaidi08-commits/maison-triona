import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isExpired,
  RETENTION_MONTHS,
  RETENTION_RUN_ALERT_HOURS,
  retentionDeadline,
  retentionRunStatus,
} from '../../src/lib/vault/retention.ts'

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

describe('isExpired (conservation automatique, partie D)', () => {
  const now = new Date('2027-06-01T12:00:00Z')

  it('désigne une demande dont l’échéance est atteinte ou passée', () => {
    assert.equal(
      isExpired({ retentionUntil: new Date('2027-01-01T00:00:00Z'), frozen: false }, now),
      true,
    )
    assert.equal(isExpired({ retentionUntil: now, frozen: false }, now), true)
    assert.equal(
      isExpired({ retentionUntil: new Date(now.getTime() + 1), frozen: false }, now),
      false,
    )
  })

  it('exclut toujours une demande gelée, même échue depuis longtemps', () => {
    assert.equal(
      isExpired({ retentionUntil: new Date('2000-01-01T00:00:00Z'), frozen: true }, now),
      false,
    )
    assert.equal(isExpired({ retentionUntil: now, frozen: true }, now), false)
  })

  it('refuse une date invalide plutôt que de deviner', () => {
    assert.throws(
      () => isExpired({ retentionUntil: now, frozen: false }, new Date('invalide')),
      RangeError,
    )
  })
})

describe('retentionRunStatus (accueil du coffre, partie D)', () => {
  const now = new Date('2027-06-03T12:00:00Z')
  const heures = (n: number) => new Date(now.getTime() - n * 3600 * 1000)

  it('signale l’absence de passage et un passage de plus de 48 heures', () => {
    assert.equal(RETENTION_RUN_ALERT_HOURS, 48)
    assert.equal(retentionRunStatus(null, now), 'never')
    assert.equal(retentionRunStatus(heures(1), now), 'recent')
    assert.equal(retentionRunStatus(heures(48), now), 'recent')
    assert.equal(retentionRunStatus(new Date(heures(48).getTime() - 1), now), 'late')
    assert.equal(retentionRunStatus(heures(24 * 7), now), 'late')
  })
})
