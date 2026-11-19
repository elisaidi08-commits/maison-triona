import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readSmsConfig } from '../../src/lib/sms/config.ts'

const KEY = 'cle-secrete-de-test-0123456789'

describe('readSmsConfig', () => {
  it('renvoie null quand aucune variable n’est posée : les SMS sont coupés', () => {
    assert.equal(readSmsConfig({}), null)
    assert.equal(readSmsConfig({ SEVEN_API_KEY: '  ', SMS_SENDER: '' }), null)
  })

  it('lit la clé et l’expéditeur', () => {
    assert.deepEqual(readSmsConfig({ SEVEN_API_KEY: KEY, SMS_SENDER: 'Triona' }), {
      apiKey: KEY,
      sender: 'Triona',
    })
  })

  it('refuse une configuration à moitié posée, en nommant la variable et jamais la valeur', () => {
    assert.throws(
      () => readSmsConfig({ SEVEN_API_KEY: KEY }),
      (error: Error) => {
        assert.match(error.message, /SMS_SENDER/)
        assert.ok(!error.message.includes(KEY))
        return true
      },
    )
    assert.throws(() => readSmsConfig({ SMS_SENDER: 'Triona' }), /SEVEN_API_KEY/)
  })

  for (const sender of [
    'Maison Triona',
    'MaisonTriona',
    'Tri-ona',
    'Triona.',
    'Tr',
    '12345',
    'Trïona',
  ]) {
    it(`refuse l’expéditeur ${JSON.stringify(sender)} (3 à 11 lettres ou chiffres, dont une lettre)`, () => {
      assert.throws(
        () => readSmsConfig({ SEVEN_API_KEY: KEY, SMS_SENDER: sender }),
        (error: Error) => {
          assert.match(error.message, /SMS_SENDER/)
          assert.ok(!error.message.includes(sender))
          return true
        },
      )
    })
  }

  it('refuse une clé hors ASCII visible (espace, contrôle, accent, caractère invisible)', () => {
    for (const apiKey of [
      'abc def',
      'abc\ndef',
      'abc\u0000def',
      'clé',
      'abc\u200bdef',
      'abc\u2060def',
    ]) {
      assert.throws(
        () => readSmsConfig({ SEVEN_API_KEY: apiKey, SMS_SENDER: 'Triona' }),
        /SEVEN_API_KEY/,
      )
    }
  })
})
