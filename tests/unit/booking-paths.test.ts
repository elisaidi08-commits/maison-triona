import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  bookingCalendarPath,
  bookingConfirmationPath,
  bookingPath,
  switchLocalePath,
} from '../../src/i18n/pathnames.ts'

// Chemins des liens de réservation (story 3.10) : même chemin dans les deux langues, et le sélecteur
// de langue garde le lien (le jeton ne change pas) au lieu de renvoyer à l'accueil.

const JETON = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'

describe('chemins des liens de réservation', () => {
  it('composent la réservation, la confirmation et le fichier .ics', () => {
    assert.equal(JETON.length, 43)
    assert.equal(bookingPath('fr', JETON), `/fr/contact/appel/${JETON}`)
    assert.equal(bookingConfirmationPath('en', JETON), `/en/contact/appel/${JETON}/confirmation`)
    assert.equal(bookingCalendarPath('fr', JETON), `/fr/contact/appel/${JETON}/agenda`)
  })

  it('passent d’une langue à l’autre sans perdre le lien', () => {
    assert.equal(switchLocalePath(`/fr/contact/appel/${JETON}`, 'en'), `/en/contact/appel/${JETON}`)
    assert.equal(
      switchLocalePath(`/en/contact/appel/${JETON}/confirmation`, 'fr'),
      `/fr/contact/appel/${JETON}/confirmation`,
    )
    // Toute autre forme : l'accueil, comme pour une adresse inconnue.
    assert.equal(switchLocalePath('/fr/contact/appel/court', 'en'), '/en')
    assert.equal(switchLocalePath(`/fr/contact/appel/${JETON}/autre`, 'en'), '/en')
    // Les pages de la table ne changent pas de règle.
    assert.equal(switchLocalePath('/fr/la-maison', 'en'), '/en/the-house')
    assert.equal(switchLocalePath('/en/contact', 'fr'), '/fr/contact')
  })
})
