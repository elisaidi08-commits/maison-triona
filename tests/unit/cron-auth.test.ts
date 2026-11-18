import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { cronAutorise } from '../../src/lib/security/cron.ts'

const SECRET = 'un-secret-de-plus-de-seize-caracteres'

describe('cronAutorise', () => {
  test('accepte exactement Bearer <secret>', () => {
    assert.equal(cronAutorise(`Bearer ${SECRET}`, SECRET), true)
  })
  test('refuse un en-tête absent', () => {
    assert.equal(cronAutorise(null, SECRET), false)
  })
  test('refuse un en-tête sans Bearer', () => {
    assert.equal(cronAutorise(SECRET, SECRET), false)
    assert.equal(cronAutorise(`Basic ${SECRET}`, SECRET), false)
    assert.equal(cronAutorise(`bearer ${SECRET}`, SECRET), false)
  })
  test('refuse un autre secret, plus court, plus long ou de même longueur', () => {
    assert.equal(cronAutorise(`Bearer ${SECRET}x`, SECRET), false)
    assert.equal(cronAutorise(`Bearer ${SECRET.slice(1)}`, SECRET), false)
    assert.equal(cronAutorise(`Bearer ${'a'.repeat(SECRET.length)}`, SECRET), false)
  })
  test('refuse si le secret manque, est vide ou trop court', () => {
    assert.equal(cronAutorise('Bearer ', undefined), false)
    assert.equal(cronAutorise('Bearer ', ''), false)
    assert.equal(cronAutorise('Bearer court', 'court'), false)
    assert.equal(cronAutorise(`Bearer ${'a'.repeat(15)}`, 'a'.repeat(15)), false)
    assert.equal(cronAutorise(`Bearer ${'a'.repeat(16)}`, 'a'.repeat(16)), true)
  })
})
