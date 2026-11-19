import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { smsPropose } from '../../src/lib/booking/options.ts'

// Case SMS de la réservation (story 3.10) : masquée tant que le fournisseur n'est pas choisi.

describe('option SMS de la réservation', () => {
  it('n’est proposée que si BOOKING_SMS_OPT_IN vaut « true »', () => {
    assert.equal(smsPropose({}), false)
    for (const valeur of ['', 'false', '1', 'oui', 'TRUE ', 'yes']) {
      assert.equal(smsPropose({ BOOKING_SMS_OPT_IN: valeur }), false, valeur)
    }
    assert.equal(smsPropose({ BOOKING_SMS_OPT_IN: 'true' }), true)
    assert.equal(smsPropose({ BOOKING_SMS_OPT_IN: ' true ' }), true)
  })
})
