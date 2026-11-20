import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateToken } from '../../src/lib/booking/tokens.ts'
import { callPhase, canChange, isCancelled } from '../../src/lib/booking/manage.ts'
import { adresseAppel, estErreurAppel, lireResultat } from '../../src/lib/coffre/appels.ts'
import {
  lireIdentifiantAppel,
  LECTURE_MAX,
  validerDeplacementCoffre,
  validerGesteConfirme,
} from '../../src/lib/validation/agenda.ts'
import { lireEnvoiGestion, validerDeplacement } from '../../src/lib/validation/booking-manage.ts'

// Déplacer et annuler un appel (story 3.11) : où en est un appel (mêmes règles que les déclencheurs
// de db/migrations/0014_deplacer_annuler.sql), validation du lien de gestion et des gestes du coffre,
// codes de résultat de l'agenda (liste fermée). Données factices.

const DEBUT = new Date('2027-03-02T09:30:00Z')
const FIN = new Date('2027-03-02T10:00:00Z')
const AVANT = new Date('2027-03-01T08:00:00Z')
const ID = '6f1c2b8e-3a4d-4e5f-9a0b-1c2d3e4f5a6b'

function formulaire(champs: Record<string, string>): FormData {
  const donnees = new FormData()
  for (const [nom, valeur] of Object.entries(champs)) donnees.set(nom, valeur)
  return donnees
}

describe('phase d’un appel', () => {
  const appel = { status: 'confirmed' as const, startsAt: DEBUT, endsAt: FIN }

  it('à venir tant qu’il n’a pas commencé, puis commencé, puis fini', () => {
    assert.equal(callPhase(appel, AVANT), 'upcoming')
    assert.equal(callPhase(appel, new Date(DEBUT.getTime() - 1)), 'upcoming')
    assert.equal(callPhase(appel, DEBUT), 'started')
    assert.equal(callPhase(appel, FIN), 'over')
    assert.equal(canChange(appel, AVANT), true)
    assert.equal(canChange(appel, DEBUT), false)
  })

  it('annulé reste annulé ; qualifié ne se change plus', () => {
    for (const status of ['cancelled_by_guest', 'cancelled_by_house'] as const) {
      assert.equal(isCancelled(status), true)
      assert.equal(callPhase({ ...appel, status }, AVANT), 'cancelled')
      assert.equal(callPhase({ ...appel, status }, FIN), 'cancelled')
      assert.equal(canChange({ ...appel, status }, AVANT), false)
    }
    for (const status of ['done', 'no_answer'] as const) {
      assert.equal(isCancelled(status), false)
      assert.equal(callPhase({ ...appel, status }, AVANT), 'started')
      assert.equal(canChange({ ...appel, status }, AVANT), false)
    }
    assert.throws(() => callPhase(appel, new Date(Number.NaN)), RangeError)
  })
})

describe('validation du lien de gestion', () => {
  it('ne garde qu’un jeton bien formé et une langue connue', () => {
    const { token } = generateToken()
    assert.deepEqual(lireEnvoiGestion(formulaire({ jeton: token, locale: 'en' })), {
      jeton: token,
      locale: 'en',
    })
    assert.deepEqual(lireEnvoiGestion(formulaire({ jeton: 'court', locale: 'de' })), {
      jeton: null,
      locale: 'fr',
    })
    assert.deepEqual(lireEnvoiGestion(new FormData()), { jeton: null, locale: 'fr' })
  })

  it('accepte un instant ISO en UTC, refuse le reste sans citer la valeur', () => {
    const lu = validerDeplacement(formulaire({ creneau: '2027-03-02T09:30:00.000Z' }))
    assert.equal(lu.ok, true)
    if (lu.ok) assert.equal(lu.debut.toISOString(), '2027-03-02T09:30:00.000Z')
    for (const valeur of ['', 'demain', '2027-03-02', '2027-02-30T09:30:00Z', '<script>']) {
      const refus = validerDeplacement(formulaire({ creneau: valeur }))
      assert.deepEqual(refus, { ok: false, erreur: 'creneau' }, valeur)
    }
    assert.deepEqual(validerDeplacement(new FormData()), { ok: false, erreur: 'creneau' })
  })
})

describe('gestes du coffre sur un appel', () => {
  it('déplacer : un identifiant et un créneau', () => {
    const lu = validerDeplacementCoffre(
      formulaire({ id: ID.toUpperCase(), creneau: '2027-03-02T09:30:00Z' }),
    )
    assert.equal(lu.ok, true)
    if (lu.ok) {
      assert.equal(lu.valeur.id, ID)
      assert.equal(lu.valeur.debut.toISOString(), '2027-03-02T09:30:00.000Z')
    }
    assert.deepEqual(validerDeplacementCoffre(formulaire({ id: 'x', creneau: '' })), {
      ok: false,
      erreur: 'identifiant',
    })
    assert.deepEqual(validerDeplacementCoffre(formulaire({ id: ID, creneau: 'demain' })), {
      ok: false,
      erreur: 'creneau',
    })
  })

  it('annuler ou effacer : la case de confirmation est exigée', () => {
    assert.deepEqual(validerGesteConfirme(formulaire({ id: ID, confirmation: 'oui' })), {
      ok: true,
      valeur: { id: ID },
    })
    assert.deepEqual(validerGesteConfirme(formulaire({ id: ID })), {
      ok: false,
      erreur: 'confirmation',
    })
    assert.deepEqual(validerGesteConfirme(formulaire({ id: '1', confirmation: 'oui' })), {
      ok: false,
      erreur: 'identifiant',
    })
    assert.equal(lireIdentifiantAppel(ID.toUpperCase()), ID)
    assert.equal(lireIdentifiantAppel('pas-un-uuid'), null)
    assert.equal(lireIdentifiantAppel(undefined), null)
  })

  it('codes de résultat : liste fermée, toute autre valeur ignorée', () => {
    assert.equal(lireResultat('deplace'), 'deplace')
    assert.equal(lireResultat('efface'), 'efface')
    assert.equal(lireResultat('<b>'), null)
    assert.equal(lireResultat(['deplace']), null)
    assert.equal(estErreurAppel('deplace'), false)
    assert.equal(estErreurAppel('annule'), false)
    assert.equal(estErreurAppel('pris'), true)
    assert.equal(estErreurAppel('confirmation'), true)
    assert.equal(adresseAppel(ID), `/coffre/appels/${ID}`)
    assert.equal(adresseAppel(ID, 'pris'), `/coffre/appels/${ID}?resultat=pris`)
  })

  it('la borne de lecture reste celle des appels non annulés (une semaine au plafond, plus 50)', () => {
    assert.equal(LECTURE_MAX, 7 * 12 + 50)
  })
})
