import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { measureSms } from '../../src/lib/sms/gsm7.ts'

describe('measureSms : alphabet', () => {
  it('compte un texte ASCII en GSM-7, un caractère par unité', () => {
    assert.deepEqual(measureSms('Maison Triona: 16:30.'), {
      encoding: 'gsm7',
      units: 21,
      segments: 1,
    })
  })

  it('garde en GSM-7 les accents de la table de base', () => {
    assert.equal(measureSms('é è ù ì ò à É Ç ä ö ñ ü ß Æ Ø Å').encoding, 'gsm7')
    assert.equal(measureSms("aujourd'hui, confirmé, déplacer").encoding, 'gsm7')
  })

  it('compte double les caractères de la table d’extension', () => {
    const { encoding, units } = measureSms('€[]{}^~|\\')
    assert.equal(encoding, 'gsm7')
    assert.equal(units, 18)
  })

  for (const [name, text] of [
    ['â', 'âge'],
    ['ê', 'fenêtre'],
    ['î', 'île'],
    ['ô', 'tôt'],
    ['û', 'août'],
    ['ç', 'reçu'],
    ['œ', 'œuvre'],
    ['guillemets', '« Maison »'],
    ['apostrophe typographique', 'aujourd’hui'],
    ['espace insécable', '16 h 30'],
    ['espace fine insécable', '16 h'],
    ['tiret cadratin', 'a — b'],
  ] as const) {
    it(`passe en UCS-2 avec : ${name}`, () => {
      assert.equal(measureSms(text).encoding, 'ucs2')
    })
  }
})

describe('measureSms : segments', () => {
  it('tient en un segment jusqu’à 160 unités GSM-7', () => {
    assert.equal(measureSms('a'.repeat(160)).segments, 1)
    assert.equal(measureSms('a'.repeat(161)).segments, 2)
  })

  it('découpe ensuite par 153 unités GSM-7', () => {
    assert.equal(measureSms('a'.repeat(306)).segments, 2)
    assert.equal(measureSms('a'.repeat(307)).segments, 3)
  })

  it('tient en un segment jusqu’à 70 unités UCS-2, puis découpe par 67', () => {
    assert.equal(measureSms('ç'.repeat(70)).segments, 1)
    assert.equal(measureSms('ç'.repeat(71)).segments, 2)
    assert.equal(measureSms('ç'.repeat(134)).segments, 2)
    assert.equal(measureSms('ç'.repeat(135)).segments, 3)
  })

  it('compte une unité UCS-2 par unité UTF-16 (un emoji en vaut deux)', () => {
    assert.deepEqual(measureSms('😀'), { encoding: 'ucs2', units: 2, segments: 1 })
  })
})
