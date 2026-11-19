import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { measureSms } from '../../src/lib/sms/gsm7.ts'
import {
  assertSendableSms,
  renderBookingSms,
  renderCatSms,
  SMS_MAX_UNITS,
  SMS_TEMPLATES,
} from '../../src/lib/sms/templates.ts'

const LOCALES = ['fr', 'en'] as const
const KINDS = ['confirmation', 'reminder'] as const

// Mercredi 25/11/2026 à 16 h 30 à Bruxelles (UTC+1).
const WEDNESDAY_1630 = new Date('2026-11-25T15:30:00Z')

describe('renderBookingSms : rendu', () => {
  it('rend la confirmation en français, heure de Bruxelles', () => {
    assert.equal(
      renderBookingSms({ kind: 'confirmation', locale: 'fr', startsAt: WEDNESDAY_1630 }),
      "Maison Triona : votre appel est convenu pour le mercredi 25/11 à 16 h 30. Pour le déplacer ou l'annuler, suivez le lien de notre e-mail.",
    )
  })

  it('rend la confirmation en anglais', () => {
    assert.equal(
      renderBookingSms({ kind: 'confirmation', locale: 'en', startsAt: WEDNESDAY_1630 }),
      'Maison Triona: your call is arranged for Wednesday 25/11 at 16:30. To rearrange or cancel, please use the link in our email.',
    )
  })

  it('rend les rappels avec l’heure seule', () => {
    assert.equal(
      renderBookingSms({ kind: 'reminder', locale: 'fr', startsAt: WEDNESDAY_1630 }),
      "Maison Triona : comme convenu, nous vous appelons aujourd'hui à 16 h 30. Pour déplacer ou annuler l'appel, suivez le lien de notre e-mail.",
    )
    assert.equal(
      renderBookingSms({ kind: 'reminder', locale: 'en', startsAt: WEDNESDAY_1630 }),
      'Maison Triona: as arranged, we will call you today at 16:30. To rearrange or cancel, please use the link in our email.',
    )
  })

  it('suit le passage à l’heure d’été (29/03/2027, UTC+2)', () => {
    assert.match(
      renderBookingSms({
        kind: 'confirmation',
        locale: 'fr',
        startsAt: new Date('2027-03-29T08:30:00Z'),
      }),
      / le lundi 29\/03 à 10 h 30\. /,
    )
  })

  it('refuse une langue, un type de SMS ou une date inconnus', () => {
    const base = { kind: 'reminder', locale: 'fr', startsAt: WEDNESDAY_1630 } as const
    assert.throws(() => renderBookingSms({ ...base, locale: 'de' as 'fr' }), RangeError)
    assert.throws(() => renderBookingSms({ ...base, kind: 'promo' as 'reminder' }), RangeError)
    assert.throws(() => renderBookingSms({ ...base, startsAt: new Date('x') }), RangeError)
  })
})

describe('SMS_TEMPLATES : textes de la maison', () => {
  it('existent pour chaque langue et chaque type, avec {time} et sans autre champ', () => {
    for (const locale of LOCALES) {
      for (const kind of KINDS) {
        const template = SMS_TEMPLATES[locale][kind]
        assert.ok(template.includes('{time}'), `${locale} ${kind}`)
        assert.equal(template.replaceAll(/\{(date|time)\}/g, '').match(/[{}]/), null)
      }
    }
  })

  it('ne nomment aucun service ni rien qui touche à la santé (écran verrouillé)', () => {
    const forbidden =
      /concierg|grand.?[âa]ge|enfant|child|garde|nanny|senior|elder|parent|sant[ée]|health|soin|care|aide|help|m[ée]dic/i
    for (const locale of LOCALES) {
      for (const kind of KINDS) {
        assert.doesNotMatch(SMS_TEMPLATES[locale][kind], forbidden, `${locale} ${kind}`)
      }
    }
  })

  // Chaque jour de la semaine (« mercredi », « Wednesday » sont les plus longs), chaque heure de
  // 9 h à 19 h : un seul segment, alphabet GSM-7, marge pour un « STOP » ajouté par un opérateur.
  for (const locale of LOCALES) {
    for (const kind of KINDS) {
      it(`${locale} · ${kind} : GSM-7 et ${SMS_MAX_UNITS} unités au plus, au pire cas`, () => {
        for (let day = 23; day <= 29; day++) {
          for (let hour = 8; hour <= 18; hour++) {
            const startsAt = new Date(Date.UTC(2026, 10, day, hour, 30))
            const text = renderBookingSms({ kind, locale, startsAt })
            const { encoding, units } = measureSms(text)
            assert.equal(encoding, 'gsm7', text)
            assert.ok(units <= SMS_MAX_UNITS, `${units} unités : ${text}`)
          }
        }
      })
    }
  }
})

describe('assertSendableSms : refus', () => {
  it('accepte un texte de la maison', () => {
    assert.doesNotThrow(() => assertSendableSms('Maison Triona : rappel à 16 h 30.'))
  })

  it('refuse un caractère hors GSM-7, comme l’apostrophe typographique', () => {
    assert.throws(() => assertSendableSms('Maison Triona : aujourd’hui.'), /GSM-7/)
  })

  it(`refuse un texte de plus de ${SMS_MAX_UNITS} unités`, () => {
    assert.throws(() => assertSendableSms(`Maison Triona : ${'a'.repeat(140)}`), /unités/)
  })

  it('refuse tout ce qui ressemble à un lien (D71)', () => {
    for (const link of [
      'https://maisontriona.com',
      'http://x.be',
      'www.maisontriona.com',
      'maisontriona.com/fr',
      'bit.ly/abc',
      't.co/x',
      'maisontriona.io',
      'santé.fr',
      'cat@maisontriona',
      'ftp://x',
    ]) {
      assert.throws(() => assertSendableSms(`Maison Triona : ${link}`), /lien/, link)
    }
  })

  it('refuse un texte qui ne commence pas par « Maison Triona » (numéro court en Belgique)', () => {
    assert.throws(() => assertSendableSms('Votre appel à 16 h 30.'), /Maison Triona/)
  })
})

describe('renderCatSms', () => {
  it('annonce un nouvel appel à Cat, sans nom ni numéro (D06), en disant qui écrit', () => {
    assert.equal(
      renderCatSms({ startsAt: WEDNESDAY_1630 }),
      'Maison Triona : nouvel appel mercredi 25/11 à 16 h 30.',
    )
  })
})
