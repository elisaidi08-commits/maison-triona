import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  validerAbsence,
  validerAnnee,
  validerIdentifiant,
  validerJournee,
  validerJoursFeries,
  validerPlage,
  validerReglages,
} from '../../src/lib/validation/disponibilites.ts'

// Validation des formulaires de /coffre/disponibilites (story 3.8 B). Les valeurs arrivent du
// navigateur (FormData) : tout est revérifié ici, bornes comprises (SETTINGS_LIMITS), et une erreur
// ne rend qu'un code, jamais la valeur reçue.

const AUJOURDHUI = '2026-11-19'

function formulaire(champs: Record<string, string | string[]>): FormData {
  const donnees = new FormData()
  for (const [nom, valeur] of Object.entries(champs)) {
    for (const une of Array.isArray(valeur) ? valeur : [valeur]) donnees.append(nom, une)
  }
  return donnees
}

const REGLAGES = { duree: '30', pause: '15', delai: '24', horizon: '21', plafond: '4' }

describe('réglages des appels', () => {
  test('accepte les valeurs par défaut, délai converti d’heures en minutes', () => {
    assert.deepEqual(validerReglages(formulaire(REGLAGES)), {
      ok: true,
      valeur: {
        durationMinutes: 30,
        bufferMinutes: 15,
        minNoticeMinutes: 1440,
        horizonDays: 21,
        dailyCap: 4,
      },
    })
  })

  test('accepte les bornes, espaces autour compris', () => {
    const bas = validerReglages(
      formulaire({ duree: '15', pause: '0', delai: '1', horizon: ' 1 ', plafond: '1' }),
    )
    assert.equal(bas.ok, true)
    const haut = validerReglages(
      formulaire({ duree: '120', pause: '60', delai: '168', horizon: '90', plafond: '12' }),
    )
    assert.deepEqual(haut.ok && haut.valeur.minNoticeMinutes, 168 * 60)
  })

  const refus: [string, Record<string, string>, string][] = [
    ['durée trop courte', { duree: '10' }, 'duree'],
    ['durée trop longue', { duree: '125' }, 'duree'],
    ['durée hors pas de 5', { duree: '32' }, 'duree'],
    ['durée décimale', { duree: '30.5' }, 'duree'],
    ['durée vide', { duree: '' }, 'duree'],
    ['pause négative', { pause: '-5' }, 'pause'],
    ['pause hors pas de 5', { pause: '7' }, 'pause'],
    ['délai nul', { delai: '0' }, 'delai'],
    ['délai au-delà d’une semaine', { delai: '169' }, 'delai'],
    ['horizon nul', { horizon: '0' }, 'horizon'],
    ['horizon au-delà de 90 jours', { horizon: '91' }, 'horizon'],
    ['plafond nul', { plafond: '0' }, 'plafond'],
    ['plafond au-delà de 12', { plafond: '13' }, 'plafond'],
    ['plafond en lettres', { plafond: 'quatre' }, 'plafond'],
    ['plafond en notation exponentielle', { plafond: '1e1' }, 'plafond'],
  ]
  for (const [nom, champs, erreur] of refus) {
    test(`refuse : ${nom}`, () => {
      assert.deepEqual(validerReglages(formulaire({ ...REGLAGES, ...champs })), {
        ok: false,
        erreur,
      })
    })
  }

  test('refuse un champ absent ou un fichier, et signale le premier champ fautif', () => {
    const sansDuree = formulaire(REGLAGES)
    sansDuree.delete('duree')
    assert.deepEqual(validerReglages(sansDuree), { ok: false, erreur: 'duree' })
    const avecFichier = formulaire({ ...REGLAGES, pause: [] })
    avecFichier.append('pause', new Blob(['15']), 'pause.txt')
    assert.deepEqual(validerReglages(avecFichier), { ok: false, erreur: 'pause' })
    assert.deepEqual(validerReglages(formulaire({ ...REGLAGES, delai: '0', plafond: '0' })), {
      ok: false,
      erreur: 'delai',
    })
  })
})

describe('plage de la semaine type', () => {
  test('accepte une plage, heures du navigateur avec ou sans secondes', () => {
    assert.deepEqual(validerPlage(formulaire({ jour: '6', debut: '09:00', fin: '11:30' })), {
      ok: true,
      valeur: { weekday: 6, start: '09:00', end: '11:30' },
    })
    assert.deepEqual(validerPlage(formulaire({ jour: '7', debut: '09:00:00', fin: '10:15:00' })), {
      ok: true,
      valeur: { weekday: 7, start: '09:00', end: '10:15' },
    })
  })

  const refus: [string, Record<string, string>, string][] = [
    ['jour inconnu', { jour: '0', debut: '09:00', fin: '10:00' }, 'jour-semaine'],
    ['jour en lettres', { jour: 'lundi', debut: '09:00', fin: '10:00' }, 'jour-semaine'],
    ['début mal formé', { jour: '1', debut: '9h', fin: '10:00' }, 'debut'],
    ['début impossible', { jour: '1', debut: '24:00', fin: '10:00' }, 'debut'],
    ['fin mal formée', { jour: '1', debut: '09:00', fin: '10:60' }, 'fin'],
    ['secondes non nulles', { jour: '1', debut: '09:00:30', fin: '10:00' }, 'debut'],
    ['fin avant le début', { jour: '1', debut: '12:00', fin: '10:00' }, 'plage-ordre'],
    ['plage vide', { jour: '1', debut: '10:00', fin: '10:00' }, 'plage-ordre'],
  ]
  for (const [nom, champs, erreur] of refus) {
    test(`refuse : ${nom}`, () => {
      assert.deepEqual(validerPlage(formulaire(champs)), { ok: false, erreur })
    })
  }
})

describe('absence (congé)', () => {
  test('accepte un jour ou une plage de dates, jusqu’à 366 jours', () => {
    assert.deepEqual(
      validerAbsence(formulaire({ du: '2026-12-21', au: '2027-01-03' }), AUJOURDHUI),
      {
        ok: true,
        valeur: { startDate: '2026-12-21', endDate: '2027-01-03' },
      },
    )
    assert.equal(
      validerAbsence(formulaire({ du: AUJOURDHUI, au: AUJOURDHUI }), AUJOURDHUI).ok,
      true,
    )
    assert.equal(
      validerAbsence(formulaire({ du: '2027-01-01', au: '2028-01-01' }), AUJOURDHUI).ok,
      true,
    )
  })

  const refus: [string, Record<string, string>, string][] = [
    ['début mal formé', { du: '21/12/2026', au: '2027-01-03' }, 'du'],
    ['date impossible', { du: '2027-02-30', au: '2027-03-03' }, 'du'],
    ['fin absente', { du: '2026-12-21', au: '' }, 'au'],
    ['fin avant le début', { du: '2027-01-03', au: '2026-12-21' }, 'absence-ordre'],
    ['plus de 366 jours', { du: '2027-01-01', au: '2028-01-02' }, 'absence-longue'],
    ['déjà passée', { du: '2026-11-01', au: '2026-11-18' }, 'au'],
  ]
  for (const [nom, champs, erreur] of refus) {
    test(`refuse : ${nom}`, () => {
      assert.deepEqual(validerAbsence(formulaire(champs), AUJOURDHUI), { ok: false, erreur })
    })
  }
})

describe('journée bloquée, identifiant, année', () => {
  test('journée : une date d’aujourd’hui ou à venir', () => {
    assert.deepEqual(validerJournee(formulaire({ date: '2026-11-24' }), AUJOURDHUI), {
      ok: true,
      valeur: '2026-11-24',
    })
    for (const date of ['2026-11-18', '2026-13-01', '24/11/2026', '']) {
      assert.deepEqual(validerJournee(formulaire({ date }), AUJOURDHUI), {
        ok: false,
        erreur: 'date',
      })
    }
  })

  test('identifiant : un UUID, rien d’autre', () => {
    const id = '0b6f4f0e-9d2c-4c35-9a52-5f0a1c2d3e4f'
    assert.deepEqual(validerIdentifiant(formulaire({ id })), { ok: true, valeur: id })
    for (const autre of ['', '42', `${id}x`, "' OR 1=1 --"]) {
      assert.deepEqual(validerIdentifiant(formulaire({ id: autre })), {
        ok: false,
        erreur: 'identifiant',
      })
    }
  })

  test('année à préremplir : de 2026 à 2100', () => {
    assert.deepEqual(validerAnnee(formulaire({ annee: '2036' })), { ok: true, valeur: 2036 })
    for (const annee of ['2025', '2101', '20366', 'deux mille']) {
      assert.deepEqual(validerAnnee(formulaire({ annee })), { ok: false, erreur: 'annee' })
    }
  })
})

describe('jours fériés (cocher, décocher)', () => {
  test('rend les jours affichés et ceux qui restent fermés', () => {
    assert.deepEqual(
      validerJoursFeries(
        formulaire({ affiches: ['2027-07-21', '2027-08-15'], fermes: ['2027-08-15'] }),
      ),
      { ok: true, valeur: { affiches: ['2027-07-21', '2027-08-15'], fermes: ['2027-08-15'] } },
    )
    // Tout décoché : aucun « fermes ».
    assert.deepEqual(validerJoursFeries(formulaire({ affiches: ['2027-07-21'] })), {
      ok: true,
      valeur: { affiches: ['2027-07-21'], fermes: [] },
    })
  })

  test('refuse une date mal formée, un jour coché non affiché, une liste vide ou trop longue', () => {
    const refus: Record<string, string | string[]>[] = [
      { affiches: ['2027-07-21', '21/07/2027'] },
      { affiches: ['2027-07-21'], fermes: ['2027-08-15'] },
      { affiches: [] },
      {
        affiches: Array.from(
          { length: 41 },
          (_, i) => `2027-01-${String((i % 28) + 1).padStart(2, '0')}`,
        ),
      },
    ]
    for (const champs of refus) {
      assert.deepEqual(validerJoursFeries(formulaire(champs)), { ok: false, erreur: 'feries' })
    }
  })
})
