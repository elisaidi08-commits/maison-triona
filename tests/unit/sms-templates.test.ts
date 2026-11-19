import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { measureSms } from '../../src/lib/sms/gsm7.ts'
import { renderBookingSms, renderCatSms, SMS_MAX_UNITS } from '../../src/lib/sms/templates.ts'

type Locale = 'fr' | 'en'
const LOCALES: Locale[] = ['fr', 'en']

function smsMessages(locale: Locale): { confirmation: string; reminder: string } {
  const messages = JSON.parse(
    readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), 'utf8'),
  ) as { Sms: { confirmation: string; reminder: string } }
  return messages.Sms
}

// Mercredi 25/11/2026 à 16 h 30 à Bruxelles (UTC+1).
const WEDNESDAY_1630 = new Date('2026-11-25T15:30:00Z')

describe('renderBookingSms : rendu', () => {
  it('rend la confirmation en français, heure de Bruxelles', () => {
    assert.equal(
      renderBookingSms({
        template: smsMessages('fr').confirmation,
        locale: 'fr',
        startsAt: WEDNESDAY_1630,
      }),
      "Maison Triona : votre appel est confirmé le mercredi 25/11 à 16 h 30. Pour le déplacer ou l'annuler, voyez notre e-mail.",
    )
  })

  it('rend la confirmation en anglais', () => {
    assert.equal(
      renderBookingSms({
        template: smsMessages('en').confirmation,
        locale: 'en',
        startsAt: WEDNESDAY_1630,
      }),
      'Maison Triona: your call is confirmed for Wednesday 25/11 at 16:30. To move or cancel it, see our email.',
    )
  })

  it('rend les rappels sans date, avec l’heure seule', () => {
    assert.equal(
      renderBookingSms({
        template: smsMessages('fr').reminder,
        locale: 'fr',
        startsAt: WEDNESDAY_1630,
      }),
      "Maison Triona : rappel, nous vous appelons aujourd'hui à 16 h 30.",
    )
    assert.equal(
      renderBookingSms({
        template: smsMessages('en').reminder,
        locale: 'en',
        startsAt: WEDNESDAY_1630,
      }),
      'Maison Triona: reminder, we will call you today at 16:30.',
    )
  })

  it('suit le passage à l’heure d’été (29/03/2027, UTC+2)', () => {
    assert.match(
      renderBookingSms({
        template: smsMessages('fr').confirmation,
        locale: 'fr',
        startsAt: new Date('2027-03-29T08:30:00Z'),
      }),
      / le lundi 29\/03 à 10 h 30\. /,
    )
  })
})

describe('renderBookingSms : gabarits réels au pire cas', () => {
  // Chaque jour de la semaine (« mercredi », « Wednesday » sont les plus longs), chaque heure de
  // 9 h à 19 h : un seul segment, alphabet GSM-7, marge pour un « STOP » ajouté par un opérateur.
  for (const locale of LOCALES) {
    for (const kind of ['confirmation', 'reminder'] as const) {
      it(`${locale} · ${kind} : GSM-7 et ${SMS_MAX_UNITS} unités au plus`, () => {
        const template = smsMessages(locale)[kind]
        for (let day = 23; day <= 29; day++) {
          for (let hour = 8; hour <= 18; hour++) {
            const startsAt = new Date(Date.UTC(2026, 10, day, hour, 30))
            const text = renderBookingSms({ template, locale, startsAt })
            const { encoding, units } = measureSms(text)
            assert.equal(encoding, 'gsm7', text)
            assert.ok(units <= SMS_MAX_UNITS, `${units} unités : ${text}`)
          }
        }
      })
    }
  }
})

describe('renderBookingSms : refus', () => {
  const base = { locale: 'fr' as const, startsAt: WEDNESDAY_1630 }

  it('refuse un caractère hors GSM-7, comme l’apostrophe typographique', () => {
    assert.throws(
      () => renderBookingSms({ ...base, template: 'Maison Triona : aujourd’hui à {time}.' }),
      /GSM-7/,
    )
  })

  it(`refuse un texte de plus de ${SMS_MAX_UNITS} unités`, () => {
    assert.throws(
      () => renderBookingSms({ ...base, template: `Maison Triona : ${'a'.repeat(140)} {time}` }),
      /unités/,
    )
  })

  it('refuse tout lien (D71)', () => {
    for (const link of [
      'https://maisontriona.com',
      'http://x.be',
      'www.maisontriona.com',
      'maisontriona.com/fr',
    ]) {
      assert.throws(
        () => renderBookingSms({ ...base, template: `Maison Triona : {time}. ${link}` }),
        /lien/,
        link,
      )
    }
  })

  it('refuse un champ inconnu ou laissé dans le gabarit', () => {
    assert.throws(
      () => renderBookingSms({ ...base, template: 'Maison Triona : {name} à {time}.' }),
      /champ inconnu/i,
    )
  })

  it('refuse un gabarit qui ne commence pas par « Maison Triona » (numéro court en Belgique)', () => {
    assert.throws(
      () => renderBookingSms({ ...base, template: 'Votre appel à {time}.' }),
      /Maison Triona/,
    )
  })

  it('refuse une date invalide', () => {
    assert.throws(
      () =>
        renderBookingSms({ ...base, template: 'Maison Triona : {time}.', startsAt: new Date('x') }),
      RangeError,
    )
  })
})

describe('renderCatSms', () => {
  it('annonce un nouvel appel à Cat, sans nom ni numéro (D06)', () => {
    assert.equal(
      renderCatSms({ startsAt: WEDNESDAY_1630 }),
      'Nouvel appel mercredi 25/11 à 16 h 30.',
    )
  })
})
