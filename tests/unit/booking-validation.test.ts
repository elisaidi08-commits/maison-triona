import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { lireValeursReservation, validerReservation } from '../../src/lib/validation/booking.ts'

// Validation de la réservation d'appel (story 3.10) : Zod `jitless`, codes d'erreur seulement, une
// erreur par champ, saisie relue sans espaces superflus.

const VALIDE = {
  creneau: '2027-03-02T09:30:00.000Z',
  nom: 'Hortense Factice',
  telephone: '+32 470 12 34 56',
  langue: 'fr',
  consentement: 'oui',
  locale: 'en',
}

function formulaire(valeurs: Record<string, string>): FormData {
  const donnees = new FormData()
  for (const [nom, valeur] of Object.entries(valeurs)) donnees.append(nom, valeur)
  return donnees
}

describe('validation de la réservation', () => {
  it('accepte une réservation complète, options comprises', () => {
    const resultat = validerReservation({ ...VALIDE, sms: 'oui', origine: 'salon' })
    assert.ok(resultat.succes)
    assert.equal(resultat.reservation.debut.toISOString(), '2027-03-02T09:30:00.000Z')
    assert.equal(resultat.reservation.sms, true)
    assert.equal(resultat.reservation.origine, 'salon')
    assert.equal(resultat.reservation.locale, 'en')
  })

  it('sans option : pas de SMS, origine nulle ; une langue d’interface inconnue retombe sur le français', () => {
    const resultat = validerReservation({ ...VALIDE, locale: 'de' })
    assert.ok(resultat.succes)
    assert.equal(resultat.reservation.sms, false)
    assert.equal(resultat.reservation.origine, null)
    assert.equal(resultat.reservation.locale, 'fr')
    // Une valeur de case trafiquée ne vaut pas un choix.
    const trafique = validerReservation({ ...VALIDE, sms: 'peut-etre' })
    assert.ok(trafique.succes)
    assert.equal(trafique.reservation.sms, false)
  })

  it('rend un code par champ fautif, tout en une fois', () => {
    const resultat = validerReservation({ locale: 'fr' })
    assert.equal(resultat.succes, false)
    assert.deepEqual(resultat.succes ? {} : resultat.erreurs, {
      creneau: 'creneau',
      nom: 'nomRequis',
      telephone: 'telephoneRequis',
      langue: 'langue',
      consentement: 'consentement',
    })
  })

  for (const [cas, valeurs, champ, code] of [
    ['créneau sans fuseau', { creneau: '2027-03-02T09:30:00' }, 'creneau', 'creneau'],
    ['créneau qui n’est pas une date', { creneau: 'demain matin' }, 'creneau', 'creneau'],
    ['nom trop court', { nom: 'H' }, 'nom', 'nomCourt'],
    ['nom trop long', { nom: 'H'.repeat(121) }, 'nom', 'nomLong'],
    ['numéro avec des lettres', { telephone: '+32 470 AB' }, 'telephone', 'telephoneFormat'],
    ['numéro trop court', { telephone: '12345' }, 'telephone', 'telephoneFormat'],
    ['numéro trop long', { telephone: '+'.concat('1'.repeat(31)) }, 'telephone', 'telephoneFormat'],
    ['langue inconnue', { langue: 'nl' }, 'langue', 'langue'],
    ['origine hors liste', { origine: 'internet' }, 'origine', 'origine'],
    ['consentement trafiqué', { consentement: 'non' }, 'consentement', 'consentement'],
  ] as const) {
    it(`refuse : ${cas}`, () => {
      const resultat = validerReservation({ ...VALIDE, ...valeurs })
      assert.equal(resultat.succes, false)
      if (!resultat.succes) assert.deepEqual(resultat.erreurs, { [champ]: code })
    })
  }

  it('relit le formulaire : champs connus seulement, nettoyés, vides absents', () => {
    const valeurs = lireValeursReservation(
      formulaire({
        jeton: 'x'.repeat(43),
        locale: 'fr',
        creneau: VALIDE.creneau,
        nom: '  Hortense  ',
        telephone: ' +32 470 12 34 56 ',
        langue: 'en',
        sms: 'oui',
        origine: '',
        consentement: 'oui',
        intrus: 'valeur',
      }),
    )
    assert.deepEqual(valeurs, {
      jeton: 'x'.repeat(43),
      locale: 'fr',
      creneau: VALIDE.creneau,
      nom: 'Hortense',
      telephone: '+32 470 12 34 56',
      langue: 'en',
      sms: 'oui',
      consentement: 'oui',
    })
  })
})
