import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { belgianHolidays } from '../../src/lib/booking/belgian-holidays.ts'
import {
  addRule,
  addLeave,
  blockDay,
  listConfirmedCalls,
  loadAvailability,
  loadSlotConfig,
  prefillHolidays,
  removeAbsence,
  removeRule,
  setHolidays,
  updateSettings,
} from '../../src/lib/booking/repository.ts'
import {
  DEFAULT_AVAILABILITY_RULES,
  DEFAULT_BOOKING_SETTINGS,
} from '../../src/lib/booking/settings.ts'
import { computeSlots } from '../../src/lib/booking/slots.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { VaultError } from '../../src/lib/vault/repository.ts'
import { applyRoles, coffrePool, resetDatabase, testPool } from './helpers.ts'

// Accès aux données des disponibilités (story 3.8 B, src/lib/booking/repository.ts), par le rôle
// `coffre`, comme l'espace /coffre : valeurs par défaut, réglages, semaine type, absences, jours
// fériés décochés puis recochés, journée bloquée, et une ligne `availability` au journal par
// modification, sans aucune valeur.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const ACTEUR = 'cat@exemple.test'
const admin = testPool()
const coffre = coffrePool()

async function lignesDuJournal() {
  const { rows } = await admin.query(
    `SELECT * FROM vault_access_log WHERE action = 'availability' ORDER BY id`,
  )
  return rows as Record<string, unknown>[]
}

async function nombreDeLignes(): Promise<number> {
  return (await lignesDuJournal()).length
}

describe('disponibilités dans le coffre', () => {
  // Chaque test repart des valeurs posées par la migration.
  beforeEach(async () => {
    await resetDatabase(admin)
    await migrate(admin, MIGRATIONS)
    await applyRoles(admin)
  })
  after(async () => {
    await coffre.end()
    await admin.end()
  })

  it('lit les valeurs par défaut au format de computeSlots', async () => {
    const config = await loadSlotConfig(coffre, { since: '2027-01-01' })
    assert.deepEqual(config.settings, DEFAULT_BOOKING_SETTINGS)
    assert.deepEqual(config.rules, DEFAULT_AVAILABILITY_RULES)
    const feries = belgianHolidays(2027).map((holiday) => ({
      startDate: holiday.date,
      endDate: holiday.date,
      kind: 'holiday',
    }))
    assert.deepEqual(config.exceptions.slice(0, 10), feries)

    // `since` écarte les absences finies avant cette date.
    const etat = await loadAvailability(coffre, { since: '2035-12-01' })
    assert.deepEqual(
      etat.exceptions.map((exception) => exception.startDate),
      ['2035-12-25'],
    )

    // Le calcul tourne sur ce qui est lu : 2027-07-21 (Fête nationale) reste fermé.
    const slots = computeSlots({
      ...config,
      bookings: await listConfirmedCalls(coffre, new Date(), new Date()),
      busy: [],
      now: new Date('2027-07-16T08:00:00Z'),
    })
    assert.ok(slots.length > 0)
    assert.ok(!slots.some((slot) => slot.localDate === '2027-07-21'))
  })

  it('modifie les réglages, une ligne au journal, rien si rien ne change', async () => {
    const reglages = {
      durationMinutes: 45,
      bufferMinutes: 10,
      minNoticeMinutes: 48 * 60,
      horizonDays: 14,
      dailyCap: 3,
    }
    assert.equal(await updateSettings(coffre, reglages, ACTEUR), true)
    const { settings } = await loadSlotConfig(coffre)
    assert.deepEqual(settings, { timeZone: 'Europe/Brussels', ...reglages })
    assert.equal(await nombreDeLignes(), 1)

    assert.equal(await updateSettings(coffre, reglages, ACTEUR), false)
    assert.equal(await nombreDeLignes(), 1)
  })

  it('refuse des réglages hors bornes par la base, avec une erreur sans valeur', async () => {
    await assert.rejects(
      updateSettings(
        coffre,
        {
          durationMinutes: 999,
          bufferMinutes: 15,
          minNoticeMinutes: 1440,
          horizonDays: 21,
          dailyCap: 4,
        },
        ACTEUR,
      ),
      (error: unknown) =>
        error instanceof VaultError &&
        error.code === '23514' &&
        !error.message.includes('999') &&
        error.cause === undefined,
    )
    assert.equal(await nombreDeLignes(), 0)
  })

  it('ajoute et retire une plage ; un chevauchement est refusé sans rien écrire', async () => {
    assert.equal(await addRule(coffre, { weekday: 6, start: '09:00', end: '11:00' }, ACTEUR), 'ok')
    assert.equal(
      await addRule(coffre, { weekday: 1, start: '12:00', end: '13:00' }, ACTEUR),
      'overlap',
    )
    assert.equal(await nombreDeLignes(), 1)

    const etat = await loadAvailability(coffre)
    const samedi = etat.rules.find((rule) => rule.weekday === 6)
    assert.deepEqual(samedi && { start: samedi.start, end: samedi.end }, {
      start: '09:00',
      end: '11:00',
    })
    assert.equal(await removeRule(coffre, samedi?.id ?? '', ACTEUR), true)
    assert.equal(await removeRule(coffre, samedi?.id ?? '', ACTEUR), false)
    assert.equal(await removeRule(coffre, 'pas-un-uuid', ACTEUR), false)
    assert.equal(await nombreDeLignes(), 2)
    assert.deepEqual((await loadSlotConfig(coffre)).rules, DEFAULT_AVAILABILITY_RULES)
  })

  it('ajoute et retire un congé ; un jour férié ne se retire pas, il se décoche', async () => {
    await addLeave(coffre, { startDate: '2027-02-01', endDate: '2027-02-05' }, ACTEUR)
    const etat = await loadAvailability(coffre, { since: '2027-01-01' })
    const conge = etat.exceptions.find((exception) => exception.kind === 'leave')
    assert.deepEqual(conge && [conge.startDate, conge.endDate, conge.active, conge.label], [
      '2027-02-01',
      '2027-02-05',
      true,
      null,
    ])
    const ferie = etat.exceptions.find((exception) => exception.kind === 'holiday')
    assert.equal(await removeAbsence(coffre, ferie?.id ?? '', ACTEUR), false)
    assert.equal(await removeAbsence(coffre, conge?.id ?? '', ACTEUR), true)
    assert.equal(await removeAbsence(coffre, conge?.id ?? '', ACTEUR), false)
    assert.equal(await nombreDeLignes(), 2)
    const apres = await loadAvailability(coffre, { since: '2027-01-01' })
    assert.ok(!apres.exceptions.some((exception) => exception.kind === 'leave'))
    assert.ok(apres.exceptions.some((exception) => exception.id === ferie?.id))
  })

  it('décoche puis recoche un jour férié', async () => {
    const affiches = ['2027-07-21', '2027-08-15']
    const now = new Date('2027-07-16T08:00:00Z')
    const ouvert = async () =>
      computeSlots({ ...(await loadSlotConfig(coffre)), bookings: [], busy: [], now }).some(
        (slot) => slot.localDate === '2027-07-21',
      )
    assert.equal(await ouvert(), false)

    // Décoché : le 21 juillet s'ouvre, le 15 août reste fermé.
    assert.equal(await setHolidays(coffre, { affiches, fermes: ['2027-08-15'] }, ACTEUR), 1)
    assert.equal(await ouvert(), true)
    const etat = await loadAvailability(coffre, { since: '2027-07-01' })
    assert.deepEqual(
      etat.exceptions
        .filter((exception) => affiches.includes(exception.startDate))
        .map((exception) => [exception.startDate, exception.active]),
      [
        ['2027-07-21', false],
        ['2027-08-15', true],
      ],
    )
    // Même envoi : rien ne change, rien au journal.
    assert.equal(await setHolidays(coffre, { affiches, fermes: ['2027-08-15'] }, ACTEUR), 0)
    assert.equal(await nombreDeLignes(), 1)

    // Recoché : fermé de nouveau.
    assert.equal(await setHolidays(coffre, { affiches, fermes: affiches }, ACTEUR), 1)
    assert.equal(await ouvert(), false)
    assert.equal(await nombreDeLignes(), 2)
  })

  it('bloque une journée en un clic, une fois ; la débloque', async () => {
    const now = new Date('2027-01-15T11:00:00Z')
    const jours = async () =>
      computeSlots({ ...(await loadSlotConfig(coffre)), bookings: [], busy: [], now }).map(
        (slot) => slot.localDate,
      )
    assert.ok((await jours()).includes('2027-01-18'))

    assert.equal(await blockDay(coffre, '2027-01-18', ACTEUR), true)
    // Double clic : rien de plus.
    assert.equal(await blockDay(coffre, '2027-01-18', ACTEUR), false)
    assert.ok(!(await jours()).includes('2027-01-18'))
    const bloquees = (await loadAvailability(coffre)).exceptions.filter(
      (exception) => exception.kind === 'blocked',
    )
    assert.equal(bloquees.length, 1)
    assert.equal(await nombreDeLignes(), 1)

    // Le point d'accroche des appels du jour (story 3.10) ne rend encore rien.
    assert.deepEqual(
      await listConfirmedCalls(
        coffre,
        new Date('2027-01-17T23:00:00Z'),
        new Date('2027-01-18T23:00:00Z'),
      ),
      [],
    )

    assert.equal(await removeAbsence(coffre, bloquees[0]?.id ?? '', ACTEUR), true)
    assert.ok((await jours()).includes('2027-01-18'))
    assert.equal(await nombreDeLignes(), 2)
  })

  it('préremplit les jours fériés d’une année suivante, une fois', async () => {
    assert.equal(await prefillHolidays(coffre, 2036, ACTEUR), 10)
    assert.equal(await prefillHolidays(coffre, 2036, ACTEUR), 0)
    const etat = await loadAvailability(coffre, { since: '2036-01-01' })
    assert.deepEqual(
      etat.exceptions.map((exception) => ({
        date: exception.startDate,
        name: exception.label,
      })),
      belgianHolidays(2036),
    )
    assert.equal(await nombreDeLignes(), 1)
  })

  it('le journal ne garde que qui et quand : aucune valeur', async () => {
    await updateSettings(
      coffre,
      {
        durationMinutes: 50,
        bufferMinutes: 20,
        minNoticeMinutes: 36 * 60,
        horizonDays: 30,
        dailyCap: 5,
      },
      ACTEUR,
    )
    await addRule(coffre, { weekday: 6, start: '09:05', end: '11:35' }, ACTEUR)
    await addLeave(coffre, { startDate: '2027-03-01', endDate: '2027-03-09' }, ACTEUR)
    await blockDay(coffre, '2027-01-19', ACTEUR)
    await setHolidays(coffre, { affiches: ['2027-07-21'], fermes: [] }, ACTEUR)
    await prefillHolidays(coffre, 2036, ACTEUR)

    const lignes = await lignesDuJournal()
    assert.equal(lignes.length, 6)
    for (const ligne of lignes) {
      const renseignees = Object.entries(ligne)
        .filter(([, valeur]) => valeur !== null)
        .map(([colonne]) => colonne)
        .sort()
      assert.deepEqual(renseignees, ['action', 'actor', 'at', 'id'])
      assert.equal(ligne.actor, ACTEUR)
    }
    const texte = JSON.stringify(lignes.map(({ actor, action }) => ({ actor, action })))
    for (const valeur of ['50', '09:05', '11:35', '2027', '2036', '07-21']) {
      assert.ok(!texte.includes(valeur), valeur)
    }
  })
})
