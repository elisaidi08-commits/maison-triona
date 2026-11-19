import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { nomFichierExport, texteExport } from '../../src/lib/coffre/export.ts'
import { colonnesEnClair, libelle, PAYS, valeurScellee } from '../../src/lib/coffre/libelles.ts'
import type { VaultRequestSummary } from '../../src/lib/vault/repository.ts'

// Libellés et export d'une demande du coffre (story 3.2, partie D). Données factices.

const ID = '6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b'
const DEMANDE: VaultRequestSummary = {
  id: ID,
  kind: 'request',
  createdAt: new Date('2027-03-15T09:30:00Z'),
  service: 'grand-age',
  country: 'LU',
  locale: 'fr',
  urgency: 'semaines',
  source: 'salon',
  status: 'new',
  frozen: true,
  retentionUntil: new Date('2028-03-15T09:30:00Z'),
  privacyVersion: '2026-11-18',
}

describe('libellés du coffre', () => {
  it('met les codes en mots, laisse une valeur inconnue telle quelle et marque le vide', () => {
    assert.equal(libelle(PAYS, 'LU'), 'Luxembourg')
    assert.equal(libelle(PAYS, 'XX'), 'XX')
    assert.equal(libelle(PAYS, null), '–')
    // Pas de piège par le prototype des objets.
    assert.equal(libelle(PAYS, 'toString'), 'toString')
    assert.equal(valeurScellee('pourQui', 'proche'), 'Pour un proche')
    assert.equal(valeurScellee('creneau', 'apres-midi'), 'L’après-midi')
    assert.equal(valeurScellee('telephone', null), '–')
    assert.equal(valeurScellee('nom', 'Personne Factice'), 'Personne Factice')
  })

  it('présente les colonnes en clair dans l’ordre, à l’heure de Bruxelles, gel compris', () => {
    assert.deepEqual(colonnesEnClair(DEMANDE), [
      { libelle: 'Reçue le', valeur: '15/03/27 10:30' },
      { libelle: 'Type', valeur: 'Demande' },
      { libelle: 'Besoin', valeur: 'Grand âge' },
      { libelle: 'Pays', valeur: 'Luxembourg' },
      { libelle: 'Langue de réponse', valeur: 'Français' },
      { libelle: 'Urgence', valeur: 'Semaines à venir' },
      { libelle: 'Origine', valeur: 'Salon' },
      { libelle: 'Statut', valeur: 'Nouvelle' },
      { libelle: 'Conservée jusqu’au', valeur: '15/03/28 (gelée)' },
    ])
  })
})

describe('export d’une demande', () => {
  it('compose un texte brut : en-tête, colonnes en clair, champs déchiffrés, mot libre intact', () => {
    const texte = texteExport({
      id: ID,
      colonnes: colonnesEnClair(DEMANDE),
      champs: {
        nom: 'Personne Factice',
        email: 'personne@exemple.test',
        telephone: null,
        pourQui: 'proche',
        creneau: 'matin',
        message: 'Première ligne.\nSeconde ligne, avec <balise> & guillemets "".',
      },
      exporteLe: new Date('2027-04-01T08:00:00Z'),
    })
    assert.equal(
      texte,
      [
        'Maison Triona · Coffre',
        `Demande ${ID}`,
        'Exportée le 1/04/27 10:00',
        '',
        'Reçue le : 15/03/27 10:30',
        'Type : Demande',
        'Besoin : Grand âge',
        'Pays : Luxembourg',
        'Langue de réponse : Français',
        'Urgence : Semaines à venir',
        'Origine : Salon',
        'Statut : Nouvelle',
        'Conservée jusqu’au : 15/03/28 (gelée)',
        '',
        'Nom : Personne Factice',
        'E-mail : personne@exemple.test',
        'Téléphone : –',
        'Pour qui : Pour un proche',
        'Moment pour être joint : Le matin',
        'Mot libre :',
        'Première ligne.',
        'Seconde ligne, avec <balise> & guillemets "".',
        '',
      ].join('\n'),
    )
  })

  it('nomme le fichier par l’identifiant seul, jamais par un contenu', () => {
    assert.equal(nomFichierExport(ID), `demande-${ID}.txt`)
  })
})
