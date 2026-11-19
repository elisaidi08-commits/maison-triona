import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  adresseRetour,
  dateEnLettres,
  heureEnLettres,
  lireStatut,
} from '../../src/lib/coffre/disponibilites.ts'

// Libellés et messages de /coffre/disponibilites (story 3.8 B) : formats français, et retour des
// actions serveur par des codes de listes fermées, jamais une valeur reçue.

describe('libellés des disponibilités', () => {
  test('heures à la française', () => {
    assert.equal(heureEnLettres('10:30'), '10 h 30')
    assert.equal(heureEnLettres('16:00'), '16 h')
    assert.equal(heureEnLettres('09:05'), '9 h 05')
  })

  test('dates en lettres, « 1er » compris, sans décalage de fuseau', () => {
    assert.equal(dateEnLettres('2027-07-21'), 'Mercredi 21 juillet 2027')
    assert.equal(dateEnLettres('2027-01-01'), 'Vendredi 1er janvier 2027')
    assert.equal(dateEnLettres('2027-03-28'), 'Dimanche 28 mars 2027')
    assert.equal(dateEnLettres('2027-10-31'), 'Dimanche 31 octobre 2027')
  })
})

describe('retour des actions serveur', () => {
  test('lit un code connu, ignore le reste', () => {
    assert.deepEqual(lireStatut({ ok: 'reglages' }), { ok: 'reglages' })
    assert.deepEqual(lireStatut({ erreur: 'plage-ordre' }), { erreur: 'plage-ordre' })
    // L'erreur l'emporte si les deux sont là.
    assert.deepEqual(lireStatut({ ok: 'reglages', erreur: 'duree' }), { erreur: 'duree' })
    for (const parametres of [
      {},
      { ok: '<script>' },
      { erreur: 'toString' },
      { ok: '__proto__' },
      { ok: ['reglages'] },
      { erreur: 42 },
    ]) {
      assert.equal(lireStatut(parametres), null)
    }
  })

  test('compose l’adresse de retour', () => {
    assert.equal(adresseRetour({ ok: 'feries' }), '/coffre/disponibilites?ok=feries')
    assert.equal(
      adresseRetour({ erreur: 'indisponible' }),
      '/coffre/disponibilites?erreur=indisponible',
    )
  })
})
