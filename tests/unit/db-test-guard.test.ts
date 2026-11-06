import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assertTestDatabase } from '../integration/helpers.ts'

describe('assertTestDatabase', () => {
  it('accepte une base dont le nom finit par _test', () => {
    assert.doesNotThrow(() => assertTestDatabase('postgres://localhost:5432/maison_triona_test'))
  })

  it('refuse toute autre base, sans citer l’URL', () => {
    assert.throws(
      () => assertTestDatabase('postgres://u:secret-factice@localhost:5432/maison_triona_dev'),
      (error: Error) => {
        assert.ok(!error.message.includes('secret-factice'))
        return true
      },
    )
  })

  it('refuse une URL sans nom de base', () => {
    assert.throws(() => assertTestDatabase('postgres://localhost:5432'))
  })
})
