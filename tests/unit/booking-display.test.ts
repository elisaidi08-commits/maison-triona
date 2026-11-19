import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { lundiDe, presenterCreneaux } from '../../src/lib/booking/display.ts'
import { grouperParSemaine, teteDeListe } from '../../src/lib/booking/grouping.ts'
import type { Slot } from '../../src/lib/booking/slots.ts'
import { zonedTimeToUtc } from '../../src/lib/booking/zoned-time.ts'

// Créneaux de la page de réservation (story 3.10) : libellés composés sur le serveur (FR, EN), trois
// créneaux en tête (les prochains, ou les plus proches d'un créneau qui vient d'être pris), puis le
// reste groupé par semaine et par jour.

const FUSEAU = 'Europe/Brussels'

function creneau(date: string, heure: string): Slot {
  const start = zonedTimeToUtc(date, heure, FUSEAU)
  return { start, end: new Date(start.getTime() + 30 * 60_000), localDate: date, localTime: heure }
}

const CRENEAUX = [
  creneau('2027-03-02', '10:30'),
  creneau('2027-03-02', '11:15'),
  creneau('2027-03-02', '16:00'),
  creneau('2027-03-03', '10:30'),
  creneau('2027-03-05', '17:30'),
  creneau('2027-03-08', '10:30'),
  creneau('2027-03-29', '10:30'),
]

describe('créneaux affichés', () => {
  it('compose les libellés en français : jour, « 1er », heure à la française, semaine', () => {
    const [mardi] = presenterCreneaux([creneau('2027-03-02', '10:30')], 'fr')
    assert.deepEqual(mardi, {
      debut: '2027-03-02T09:30:00.000Z',
      jour: '2027-03-02',
      semaine: '2027-03-01',
      libelleJour: 'Mardi 2 mars',
      libelleHeure: '10 h 30',
      libelleSemaine: '1er mars',
    })
    const [premier] = presenterCreneaux([creneau('2027-04-01', '16:00')], 'fr')
    assert.equal(premier?.libelleJour, 'Jeudi 1er avril')
    assert.equal(premier?.libelleHeure, '16 h')
  })

  it('compose les libellés en anglais', () => {
    const [mardi] = presenterCreneaux([creneau('2027-03-02', '16:45')], 'en')
    assert.equal(mardi?.libelleJour, 'Tuesday 2 March')
    assert.equal(mardi?.libelleHeure, '16:45')
    assert.equal(mardi?.libelleSemaine, '1 March')
  })

  it('suit l’heure d’été : 10 h 30 à Bruxelles reste 10 h 30', () => {
    const [ete] = presenterCreneaux([creneau('2027-03-29', '10:30')], 'fr')
    assert.equal(ete?.debut, '2027-03-29T08:30:00.000Z')
    assert.equal(ete?.libelleHeure, '10 h 30')
  })

  it('trouve le lundi d’une semaine, dimanche compris', () => {
    assert.equal(lundiDe('2027-03-01'), '2027-03-01')
    assert.equal(lundiDe('2027-03-07'), '2027-03-01')
    assert.equal(lundiDe('2027-03-08'), '2027-03-08')
    assert.equal(lundiDe('2027-01-01'), '2026-12-28')
  })

  it('met en tête les trois prochains créneaux', () => {
    const affiches = presenterCreneaux(CRENEAUX, 'fr')
    assert.deepEqual(
      teteDeListe(affiches).map((c) => c.debut),
      affiches.slice(0, 3).map((c) => c.debut),
    )
    assert.deepEqual(teteDeListe([]), [])
  })

  it('après un créneau pris, met en tête les trois plus proches, dans l’ordre du temps', () => {
    const affiches = presenterCreneaux(CRENEAUX, 'fr')
    // Pris : vendredi 5 mars à 16 h (il n'est plus dans la liste). Écarts : 1 h 30 (vendredi
    // 17 h 30), 2 jours 5 h 30 (mercredi 10 h 30), 2 jours 18 h 30 (lundi 8 mars 10 h 30), etc.
    const pris = zonedTimeToUtc('2027-03-05', '16:00', FUSEAU).toISOString()
    assert.deepEqual(
      teteDeListe(affiches, pris).map((c) => `${c.jour} ${c.libelleHeure}`),
      ['2027-03-03 10 h 30', '2027-03-05 17 h 30', '2027-03-08 10 h 30'],
    )
    // Valeur illisible : les trois prochains.
    assert.deepEqual(teteDeListe(affiches, 'n’importe quoi'), affiches.slice(0, 3))
  })

  it('groupe le reste par semaine puis par jour, sans répéter la tête', () => {
    const affiches = presenterCreneaux(CRENEAUX, 'fr')
    const tete = teteDeListe(affiches)
    const semaines = grouperParSemaine(affiches, tete)
    assert.deepEqual(
      semaines.map((semaine) => ({
        semaine: semaine.semaine,
        libelle: semaine.libelle,
        jours: semaine.jours.map((jour) => [
          jour.libelle,
          jour.creneaux.map((c) => c.libelleHeure),
        ]),
      })),
      [
        {
          semaine: '2027-03-01',
          libelle: '1er mars',
          jours: [
            ['Mercredi 3 mars', ['10 h 30']],
            ['Vendredi 5 mars', ['17 h 30']],
          ],
        },
        { semaine: '2027-03-08', libelle: '8 mars', jours: [['Lundi 8 mars', ['10 h 30']]] },
        { semaine: '2027-03-29', libelle: '29 mars', jours: [['Lundi 29 mars', ['10 h 30']]] },
      ],
    )
  })
})
