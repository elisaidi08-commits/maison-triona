import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  adresseVue,
  estErreurAppel,
  heuresAppel,
  jourAppel,
  libelleDemande,
  lireVue,
  MESSAGES_APPEL,
  optionsDemandes,
  STATUTS_APPEL,
} from '../../src/lib/coffre/appels.ts'
import {
  AUCUNE_DEMANDE,
  LECTURE_MAX,
  validerIdentifiantsAppels,
  validerQualification,
  validerRattachement,
} from '../../src/lib/validation/agenda.ts'

// Actions de /coffre/appels (story 3.13) : validation de ce qu'envoie le navigateur (statut,
// rattachement, identifiants à déchiffrer), codes d'erreur sans valeur reçue ; libellés de la page.

const APPEL = '6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b'
const DEMANDE = '0b7e2d4c-1a2b-4c3d-9e8f-7a6b5c4d3e2f'

function formulaire(champs: Record<string, string>): FormData {
  const donnees = new FormData()
  for (const [nom, valeur] of Object.entries(champs)) donnees.set(nom, valeur)
  return donnees
}

describe('qualification d’un appel', () => {
  test('« fait » et « pas de réponse » seulement', () => {
    for (const statut of ['done', 'no_answer']) {
      assert.deepEqual(validerQualification(formulaire({ id: APPEL, statut })), {
        ok: true,
        valeur: { id: APPEL, statut },
      })
    }
    for (const statut of [
      'confirmed',
      'cancelled_by_guest',
      'cancelled_by_house',
      'to_qualify',
      '',
      'DONE',
    ]) {
      assert.deepEqual(validerQualification(formulaire({ id: APPEL, statut })), {
        ok: false,
        erreur: 'statut',
      })
    }
    assert.deepEqual(validerQualification(formulaire({ id: APPEL })), {
      ok: false,
      erreur: 'statut',
    })
  })

  test('identifiant d’appel : un UUID, ramené en minuscules, sinon refus sans le citer', () => {
    assert.deepEqual(
      validerQualification(formulaire({ id: APPEL.toUpperCase(), statut: 'done' })),
      {
        ok: true,
        valeur: { id: APPEL, statut: 'done' },
      },
    )
    for (const id of ['', 'pas-un-id', `${APPEL}x`, `'; DROP TABLE bookings; --`]) {
      const lu = validerQualification(formulaire({ id, statut: 'done' }))
      assert.deepEqual(lu, { ok: false, erreur: 'identifiant' })
      assert.ok(!JSON.stringify(lu).includes('DROP'))
    }
    const fichier = new FormData()
    fichier.set('id', new Blob(['x']), 'x.txt')
    fichier.set('statut', 'done')
    assert.deepEqual(validerQualification(fichier), { ok: false, erreur: 'identifiant' })
  })
})

describe('rattachement à une demande', () => {
  test('une demande, ou « aucune » pour retirer le rattachement', () => {
    assert.deepEqual(validerRattachement(formulaire({ id: APPEL, demande: DEMANDE })), {
      ok: true,
      valeur: { id: APPEL, demande: DEMANDE },
    })
    assert.deepEqual(validerRattachement(formulaire({ id: APPEL, demande: AUCUNE_DEMANDE })), {
      ok: true,
      valeur: { id: APPEL, demande: null },
    })
  })

  test('refuse une demande mal formée ou absente, un appel mal formé', () => {
    for (const demande of ['', 'demande', `${DEMANDE} `.repeat(2)]) {
      assert.deepEqual(validerRattachement(formulaire({ id: APPEL, demande })), {
        ok: false,
        erreur: 'demande',
      })
    }
    assert.deepEqual(validerRattachement(formulaire({ id: APPEL })), {
      ok: false,
      erreur: 'demande',
    })
    assert.deepEqual(validerRattachement(formulaire({ id: 'x', demande: DEMANDE })), {
      ok: false,
      erreur: 'identifiant',
    })
  })
})

describe('identifiants à déchiffrer', () => {
  test('un tableau d’UUID, sans doublon', () => {
    assert.deepEqual(validerIdentifiantsAppels([APPEL, DEMANDE, APPEL.toUpperCase()]), [
      APPEL,
      DEMANDE,
    ])
  })

  test('refuse un tableau vide, trop long, ou autre chose', () => {
    const trop = Array.from(
      { length: LECTURE_MAX + 1 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    )
    assert.equal(validerIdentifiantsAppels(trop.slice(0, LECTURE_MAX))?.length, LECTURE_MAX)
    for (const valeur of [[], trop, APPEL, null, undefined, { 0: APPEL }, [APPEL, 'x'], [1]]) {
      assert.equal(validerIdentifiantsAppels(valeur), null)
    }
  })
})

describe('libellés de l’agenda', () => {
  test('statuts en mots, « à qualifier » compris', () => {
    assert.equal(STATUTS_APPEL.to_qualify, 'À qualifier')
    assert.equal(STATUTS_APPEL.no_answer, 'Pas de réponse')
    assert.equal(Object.keys(STATUTS_APPEL).length, 6)
  })

  test('vue lue dans l’adresse : « semaine », sinon le jour', () => {
    assert.equal(lireVue('semaine'), 'semaine')
    for (const valeur of ['jour', undefined, '', ['semaine'], 'SEMAINE']) {
      assert.equal(lireVue(valeur), 'jour')
    }
    assert.equal(adresseVue('jour'), '/coffre/appels')
    assert.equal(adresseVue('semaine'), '/coffre/appels?vue=semaine')
  })

  test('heures et jour à Bruxelles, typographie française (espaces insécables)', () => {
    assert.equal(
      heuresAppel(new Date('2026-11-19T09:30:00Z'), new Date('2026-11-19T10:00:00Z')),
      '10\u00a0h\u00a030 à 11\u00a0h',
    )
    // Été : UTC+2.
    assert.equal(
      heuresAppel(new Date('2027-06-01T14:00:00Z'), new Date('2027-06-01T14:30:00Z')),
      '16\u00a0h à 16\u00a0h\u00a030',
    )
    assert.equal(jourAppel(new Date('2026-11-22T23:30:00Z')), '2026-11-23')
  })

  test('demande : colonnes en clair seulement', () => {
    const demande = {
      id: DEMANDE,
      createdAt: new Date('2026-11-18T13:02:00Z'),
      kind: 'request' as const,
      service: 'conciergerie',
      country: 'BE',
    }
    assert.equal(libelleDemande(demande), '18/11/26 14:02 · Demande · Conciergerie · Belgique')
    const options = optionsDemandes([demande], null)
    assert.deepEqual(options[0], { value: AUCUNE_DEMANDE, label: 'Aucune demande' })
    assert.deepEqual(options[1], { value: DEMANDE, label: libelleDemande(demande) })
    // La demande rattachée, plus ancienne que la liste : ajoutée une fois.
    const ancienne = { id: APPEL, createdAt: new Date('2026-01-05T09:00:00Z') }
    const avec = optionsDemandes([demande], ancienne)
    assert.equal(avec.length, 3)
    assert.equal(avec[2]?.value, APPEL)
    assert.equal(
      optionsDemandes([demande], { id: DEMANDE, createdAt: demande.createdAt }).length,
      2,
    )
  })

  test('messages : les erreurs se disent « Erreur : », les réussites non', () => {
    for (const [code, message] of Object.entries(MESSAGES_APPEL)) {
      const erreur = estErreurAppel(code as keyof typeof MESSAGES_APPEL)
      assert.equal(message.startsWith('Erreur : '), erreur, code)
    }
  })
})
