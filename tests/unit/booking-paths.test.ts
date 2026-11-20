import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  bookingPath,
  manageCalendarPath,
  manageCancelPath,
  managePath,
  switchLocalePath,
} from '../../src/i18n/pathnames.ts'

// Chemins des liens de réservation (story 3.10) : même chemin dans les deux langues, et le sélecteur
// de langue garde le lien (le jeton ne change pas) au lieu de renvoyer à l'accueil. Story 3.11 : le
// lien de gestion, sa page d'annulation et son fichier .ics remplacent la confirmation.

const JETON = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'

describe('chemins des liens de réservation', () => {
  it('composent la réservation, la gestion, l’annulation et le fichier .ics', () => {
    assert.equal(JETON.length, 43)
    assert.equal(bookingPath('fr', JETON), `/fr/contact/appel/${JETON}`)
    assert.equal(managePath('en', JETON), `/en/contact/appel/gerer/${JETON}`)
    assert.equal(manageCancelPath('fr', JETON), `/fr/contact/appel/gerer/${JETON}/annuler`)
    assert.equal(manageCalendarPath('fr', JETON), `/fr/contact/appel/gerer/${JETON}/agenda`)
  })

  it('passent d’une langue à l’autre sans perdre le lien', () => {
    assert.equal(switchLocalePath(`/fr/contact/appel/${JETON}`, 'en'), `/en/contact/appel/${JETON}`)
    assert.equal(
      switchLocalePath(`/en/contact/appel/gerer/${JETON}`, 'fr'),
      `/fr/contact/appel/gerer/${JETON}`,
    )
    assert.equal(
      switchLocalePath(`/fr/contact/appel/gerer/${JETON}/annuler`, 'en'),
      `/en/contact/appel/gerer/${JETON}/annuler`,
    )
    // La confirmation du lien d'accès n'existe plus (3.11).
    assert.equal(switchLocalePath(`/en/contact/appel/${JETON}/confirmation`, 'fr'), '/fr')
    assert.equal(switchLocalePath('/fr/contact/appel/gerer/court', 'en'), '/en')
    // Toute autre forme : l'accueil, comme pour une adresse inconnue.
    assert.equal(switchLocalePath('/fr/contact/appel/court', 'en'), '/en')
    assert.equal(switchLocalePath(`/fr/contact/appel/${JETON}/autre`, 'en'), '/en')
    // Les pages de la table ne changent pas de règle.
    assert.equal(switchLocalePath('/fr/la-maison', 'en'), '/en/the-house')
    assert.equal(switchLocalePath('/en/contact', 'fr'), '/fr/contact')
  })
})
