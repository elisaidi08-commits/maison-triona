import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_ATTEMPTS,
  PURGE_AFTER_DAYS,
  RETRY_DELAYS_MS,
  TRACKING_WINDOW_MS,
  nextAttemptAt,
  purgeBefore,
  trackingExpired,
} from '../../src/lib/outbox/schedule.ts'

const NOW = new Date('2026-11-18T10:00:00.000Z')
const HEURE = 60 * 60_000

describe('délais de la boîte d’envoi', () => {
  it('expose les constantes', () => {
    assert.deepEqual(RETRY_DELAYS_MS, [5 * 60_000, 30 * 60_000, 2 * HEURE])
    assert.equal(MAX_ATTEMPTS, 4)
    assert.equal(TRACKING_WINDOW_MS, 72 * HEURE)
    assert.equal(PURGE_AFTER_DAYS, 30)
  })

  it('nextAttemptAt planifie les reprises puis abandonne', () => {
    assert.equal(nextAttemptAt(1, NOW)?.getTime(), NOW.getTime() + 5 * 60_000)
    assert.equal(nextAttemptAt(2, NOW)?.getTime(), NOW.getTime() + 30 * 60_000)
    assert.equal(nextAttemptAt(3, NOW)?.getTime(), NOW.getTime() + 2 * HEURE)
    for (let n = 4; n <= 10; n++) assert.equal(nextAttemptAt(n, NOW), null)
  })

  it('nextAttemptAt refuse les entrées invalides', () => {
    for (const n of [0, 11, 1.5, Number.NaN, -1]) {
      assert.throws(() => nextAttemptAt(n, NOW), RangeError)
    }
    assert.throws(() => nextAttemptAt(1, new Date('invalide')), RangeError)
  })

  it('trackingExpired vaut vrai à partir de 72 h', () => {
    const accepted = new Date(NOW.getTime() - 72 * HEURE + 1)
    assert.equal(trackingExpired(accepted, NOW), false)
    assert.equal(trackingExpired(new Date(NOW.getTime() - 72 * HEURE), NOW), true)
    assert.throws(() => trackingExpired(new Date('x'), NOW), RangeError)
    assert.throws(() => trackingExpired(NOW, new Date('x')), RangeError)
  })

  it('purgeBefore recule de 30 jours', () => {
    assert.equal(purgeBefore(NOW).getTime(), NOW.getTime() - 30 * 24 * HEURE)
    assert.throws(() => purgeBefore(new Date('x')), RangeError)
  })
})
