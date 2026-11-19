import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  agendaStatus,
  canQualify,
  isToQualify,
  telHref,
  viewBounds,
  type BookingStatus,
} from '../../src/lib/booking/agenda.ts'

// Agenda des appels (story 3.13 ; docs/reservation-appel.md §3.2) : bornes des vues « Aujourd'hui »
// et « Cette semaine » à l'heure de Bruxelles, changements d'heure compris ; « à qualifier » déduit
// (confirmé, fin passée), jamais stocké ; qualification permise une fois l'appel commencé (même
// règle que le déclencheur de db/migrations/0011_agenda.sql) ; lien `tel:`.

const BRUXELLES = 'Europe/Brussels'
const HEURE = 3_600_000

function duree(bornes: { from: Date; to: Date }): number {
  return (bornes.to.getTime() - bornes.from.getTime()) / HEURE
}

describe('bornes des vues', () => {
  test('« Aujourd’hui » : de minuit à minuit, heure de Bruxelles', () => {
    // Jeudi 19 novembre 2026, 10 h à Bruxelles (heure d'hiver, UTC+1).
    const jour = viewBounds('jour', new Date('2026-11-19T09:00:00Z'), BRUXELLES)
    assert.equal(jour.from.toISOString(), '2026-11-18T23:00:00.000Z')
    assert.equal(jour.to.toISOString(), '2026-11-19T23:00:00.000Z')
    assert.deepEqual(jour.days, ['2026-11-19'])
  })

  test('« Cette semaine » : du lundi au dimanche, lundi suivant exclu', () => {
    const semaine = viewBounds('semaine', new Date('2026-11-19T09:00:00Z'), BRUXELLES)
    assert.equal(semaine.from.toISOString(), '2026-11-15T23:00:00.000Z')
    assert.equal(semaine.to.toISOString(), '2026-11-22T23:00:00.000Z')
    assert.deepEqual(semaine.days, [
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ])
    assert.equal(duree(semaine), 168)
  })

  test('le jour change à minuit à Bruxelles, pas à minuit UTC', () => {
    // Dimanche 22 novembre, 23 h 30 UTC : lundi 23 novembre, 0 h 30 à Bruxelles.
    const lundi = new Date('2026-11-22T23:30:00Z')
    assert.deepEqual(viewBounds('jour', lundi, BRUXELLES).days, ['2026-11-23'])
    assert.equal(viewBounds('semaine', lundi, BRUXELLES).days[0], '2026-11-23')
    // Dimanche 22 novembre, 22 h 59 UTC : encore dimanche, dernière journée de la semaine.
    const dimanche = new Date('2026-11-22T22:59:00Z')
    assert.deepEqual(viewBounds('jour', dimanche, BRUXELLES).days, ['2026-11-22'])
    assert.equal(viewBounds('semaine', dimanche, BRUXELLES).days[0], '2026-11-16')
  })

  test('passage à l’heure d’été (dernier dimanche de mars) : un jour de 23 heures', () => {
    const jour = viewBounds('jour', new Date('2027-03-28T10:00:00Z'), BRUXELLES)
    assert.equal(jour.from.toISOString(), '2027-03-27T23:00:00.000Z')
    assert.equal(jour.to.toISOString(), '2027-03-28T22:00:00.000Z')
    assert.equal(duree(jour), 23)
    const semaine = viewBounds('semaine', new Date('2027-03-24T10:00:00Z'), BRUXELLES)
    assert.equal(semaine.from.toISOString(), '2027-03-21T23:00:00.000Z')
    assert.equal(semaine.to.toISOString(), '2027-03-28T22:00:00.000Z')
    assert.equal(duree(semaine), 167)
  })

  test('retour à l’heure d’hiver (dernier dimanche d’octobre) : un jour de 25 heures', () => {
    const jour = viewBounds('jour', new Date('2027-10-31T12:00:00Z'), BRUXELLES)
    assert.equal(jour.from.toISOString(), '2027-10-30T22:00:00.000Z')
    assert.equal(jour.to.toISOString(), '2027-10-31T23:00:00.000Z')
    assert.equal(duree(jour), 25)
    const semaine = viewBounds('semaine', new Date('2027-10-27T12:00:00Z'), BRUXELLES)
    assert.equal(semaine.from.toISOString(), '2027-10-24T22:00:00.000Z')
    assert.equal(semaine.to.toISOString(), '2027-10-31T23:00:00.000Z')
    assert.equal(duree(semaine), 169)
    // Le lundi qui suit : de nouveau 24 heures, en heure d'hiver.
    const lundi = viewBounds('jour', new Date('2027-11-01T08:00:00Z'), BRUXELLES)
    assert.equal(lundi.from.toISOString(), '2027-10-31T23:00:00.000Z')
    assert.equal(duree(lundi), 24)
  })

  test('les vues se suivent sans trou ni chevauchement', () => {
    let instant = new Date('2027-03-22T00:30:00Z')
    for (let semaine = 0; semaine < 60; semaine += 1) {
      const vue = viewBounds('semaine', instant, BRUXELLES)
      const suivante = viewBounds('semaine', vue.to, BRUXELLES)
      assert.equal(suivante.from.getTime(), vue.to.getTime())
      instant = vue.to
    }
  })

  test('refuse une date invalide', () => {
    assert.throws(() => viewBounds('jour', new Date('nope'), BRUXELLES), RangeError)
  })
})

describe('« à qualifier » et qualification', () => {
  const debut = new Date('2026-11-19T09:30:00Z')
  const fin = new Date('2026-11-19T10:00:00Z')
  const appel = (status: string) => ({ status, startsAt: debut, endsAt: fin })
  const enBase = (status: BookingStatus) => ({ status, startsAt: debut, endsAt: fin })

  test('un appel confirmé passe « à qualifier » à son heure de fin, pas avant', () => {
    assert.equal(isToQualify(appel('confirmed'), new Date('2026-11-19T09:59:59Z')), false)
    assert.equal(isToQualify(appel('confirmed'), fin), true)
    assert.equal(isToQualify(appel('confirmed'), new Date('2026-12-01T00:00:00Z')), true)
  })

  test('un appel fait, sans réponse ou annulé n’est jamais « à qualifier »', () => {
    const tard = new Date('2026-12-01T00:00:00Z')
    for (const status of ['done', 'no_answer', 'cancelled_by_guest', 'cancelled_by_house']) {
      assert.equal(isToQualify(appel(status), tard), false, status)
    }
  })

  test('statut affiché : « à qualifier » se déduit, les autres restent tels quels', () => {
    assert.equal(agendaStatus(enBase('confirmed'), new Date('2026-11-19T09:00:00Z')), 'confirmed')
    assert.equal(agendaStatus(enBase('confirmed'), new Date('2026-11-19T10:00:00Z')), 'to_qualify')
    assert.equal(agendaStatus(enBase('done'), new Date('2026-11-19T11:00:00Z')), 'done')
    assert.equal(
      agendaStatus(enBase('cancelled_by_house'), new Date('2026-11-19T11:00:00Z')),
      'cancelled_by_house',
    )
  })

  test('« fait » et « pas de réponse » se choisissent une fois l’appel commencé', () => {
    assert.equal(canQualify(appel('confirmed'), new Date('2026-11-19T09:29:59Z')), false)
    assert.equal(canQualify(appel('confirmed'), debut), true)
    assert.equal(canQualify(appel('done'), new Date('2026-11-19T11:00:00Z')), true)
    assert.equal(canQualify(appel('no_answer'), new Date('2026-11-19T11:00:00Z')), true)
    for (const status of ['cancelled_by_guest', 'cancelled_by_house', 'inconnu']) {
      assert.equal(canQualify(appel(status), new Date('2026-11-20T00:00:00Z')), false, status)
    }
  })
})

describe('lien tel:', () => {
  test('garde les chiffres et le « + » initial', () => {
    assert.equal(telHref('+32 470 12 34 56'), 'tel:+32470123456')
    assert.equal(telHref('06.12.34.56.78'), 'tel:0612345678')
    assert.equal(telHref('(+33) 6-12-34-56-78'), 'tel:+33612345678')
    assert.equal(telHref(' +352 621 123 456 '), 'tel:+352621123456')
  })

  test('aucun lien pour un numéro trop court, trop long ou sans chiffres', () => {
    assert.equal(telHref('12345'), null)
    assert.equal(telHref(''), null)
    assert.equal(telHref('javascript:alert(1)'), null)
    assert.equal(telHref('+1'.padEnd(30, '9')), null)
  })

  test('n’en sort jamais qu’un lien tel: fait de chiffres', () => {
    for (const numero of ['+32 470 12 34 56', 'javascript:0612345678', '<b>0612345678</b>']) {
      const lien = telHref(numero)
      if (lien !== null) assert.match(lien, /^tel:\+?\d+$/)
    }
  })
})
