import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { belgianHolidays } from '../../src/lib/booking/belgian-holidays.ts'
import {
  DEFAULT_AVAILABILITY_RULES,
  DEFAULT_BOOKING_SETTINGS,
} from '../../src/lib/booking/settings.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { applyRoles, coffrePool, resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Tables des disponibilités (story 3.8 B, db/migrations/0007_disponibilites.sql) : valeurs par défaut
// de la spec §3.1 à l'installation, jours fériés belges préremplis, contraintes de la base, droits
// des deux rôles (`coffre` : le strict nécessaire ; `site_public` : lecture seule depuis la story 3.10).

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const TABLES = ['booking_settings', 'availability_rules', 'availability_exceptions']
const REFUS = { code: '42501' }
const CONTROLE = { code: '23514' }
const admin = testPool()
const coffre = coffrePool()
const site = new pg.Pool({
  connectionString: TEST_DATABASE_URL,
  options: '-c role=site_public',
  max: 2,
})

describe('tables des disponibilités', () => {
  before(async () => {
    await resetDatabase(admin)
    await migrate(admin, MIGRATIONS)
    await applyRoles(admin)
  })
  after(async () => {
    await site.end()
    await coffre.end()
    await admin.end()
  })

  it('pose les réglages par défaut de la spec, sur une seule ligne', async () => {
    const { rows } = await admin.query('SELECT * FROM booking_settings')
    assert.equal(rows.length, 1)
    const [ligne] = rows
    assert.deepEqual(
      {
        timeZone: ligne.time_zone,
        durationMinutes: ligne.duration_minutes,
        bufferMinutes: ligne.buffer_minutes,
        minNoticeMinutes: ligne.min_notice_minutes,
        horizonDays: ligne.horizon_days,
        dailyCap: ligne.daily_cap,
      },
      DEFAULT_BOOKING_SETTINGS,
    )
    assert.equal(ligne.daily_cap, 4)
    // Une seconde ligne est impossible, même pour l'administrateur.
    await assert.rejects(admin.query('INSERT INTO booking_settings (id) VALUES (false)'), CONTROLE)
    await assert.rejects(admin.query('INSERT INTO booking_settings DEFAULT VALUES'), {
      code: '23505',
    })
  })

  it('pose la semaine type par défaut : lundi à vendredi, 10 h 30-12 h 30 et 16 h-18 h', async () => {
    const { rows } = await admin.query(
      `SELECT weekday, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS end
       FROM availability_rules ORDER BY weekday, start_time`,
    )
    assert.deepEqual(
      rows.map((row) => ({ weekday: row.weekday, start: row.start, end: row.end })),
      DEFAULT_AVAILABILITY_RULES,
    )
  })

  it('préremplit les jours fériés belges de 2026 à 2035, actifs, comme belgianHolidays()', async () => {
    const { rows } = await admin.query(
      `SELECT to_char(start_date, 'YYYY-MM-DD') AS date, label AS name, active,
              start_date = end_date AS un_jour
       FROM availability_exceptions WHERE kind = 'holiday' ORDER BY start_date`,
    )
    const attendus = []
    for (let annee = 2026; annee <= 2035; annee++) attendus.push(...belgianHolidays(annee))
    assert.deepEqual(
      rows.map((row) => ({ date: row.date, name: row.name })),
      attendus,
    )
    assert.ok(rows.every((row) => row.active && row.un_jour))
    const { rows: autres } = await admin.query(
      `SELECT count(*)::int AS n FROM availability_exceptions WHERE kind <> 'holiday'`,
    )
    assert.equal(autres[0].n, 0)
  })

  it('refuse des réglages hors bornes, même hors de l’application', async () => {
    for (const sql of [
      'UPDATE booking_settings SET duration_minutes = 10',
      'UPDATE booking_settings SET duration_minutes = 32',
      'UPDATE booking_settings SET duration_minutes = 125',
      'UPDATE booking_settings SET buffer_minutes = -5',
      'UPDATE booking_settings SET buffer_minutes = 7',
      'UPDATE booking_settings SET min_notice_minutes = 0',
      'UPDATE booking_settings SET min_notice_minutes = 90',
      'UPDATE booking_settings SET min_notice_minutes = 10140',
      'UPDATE booking_settings SET horizon_days = 0',
      'UPDATE booking_settings SET horizon_days = 91',
      'UPDATE booking_settings SET daily_cap = 0',
      'UPDATE booking_settings SET daily_cap = 13',
      "UPDATE booking_settings SET time_zone = 'Europe/Paris'",
    ]) {
      await assert.rejects(admin.query(sql), CONTROLE, sql)
    }
  })

  it('refuse une plage à l’envers, un jour inconnu, des secondes, un chevauchement', async () => {
    for (const sql of [
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (6, '12:00', '10:00')",
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (6, '10:00', '10:00')",
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (0, '10:00', '11:00')",
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (8, '10:00', '11:00')",
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (6, '10:00:30', '11:00')",
    ]) {
      await assert.rejects(admin.query(sql), CONTROLE, sql)
    }
    // Lundi 12 h-13 h chevauche 10 h 30-12 h 30 : refusé, sans valeur dans le message.
    await assert.rejects(
      admin.query(
        "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (1, '12:00', '13:00')",
      ),
      (error: { code?: string; message?: string }) =>
        error.code === '23P01' && !/\d/.test(error.message ?? ''),
    )
    // Qui se touchent : acceptées (12 h 30-13 h après 10 h 30-12 h 30).
    await admin.query(
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (1, '12:30', '13:00')",
    )
    await admin.query("DELETE FROM availability_rules WHERE weekday = 1 AND start_time = '12:30'")
  })

  it('refuse une absence à l’envers, trop longue, un férié sans nom, un congé décoché', async () => {
    for (const sql of [
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('leave', '2027-02-10', '2027-02-01')",
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('leave', '2027-01-01', '2028-01-02')",
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('blocked', '2027-01-04', '2027-01-05')",
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('holiday', '2036-01-01', '2036-01-01')",
      "INSERT INTO availability_exceptions (kind, start_date, end_date, label) VALUES ('leave', '2027-01-04', '2027-01-05', 'Vacances')",
      "INSERT INTO availability_exceptions (kind, start_date, end_date, active) VALUES ('leave', '2027-01-04', '2027-01-05', false)",
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('autre', '2027-01-04', '2027-01-04')",
    ]) {
      await assert.rejects(admin.query(sql), CONTROLE, sql)
    }
    // Une journée bloquée par date.
    await admin.query(
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('blocked', '2027-01-04', '2027-01-04')",
    )
    await assert.rejects(
      admin.query(
        "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('blocked', '2027-01-04', '2027-01-04')",
      ),
      { code: '23505' },
    )
    await admin.query("DELETE FROM availability_exceptions WHERE kind = 'blocked'")
  })

  it('site_public lit les disponibilités (story 3.10), sans rien écrire ni effacer', async () => {
    for (const table of TABLES) {
      // Lecture : la page publique de réservation calcule les créneaux (story 3.10).
      await site.query(`SELECT * FROM ${table}`)
      for (const sql of [
        `UPDATE ${table} SET id = id`,
        `DELETE FROM ${table}`,
        `TRUNCATE ${table}`,
      ]) {
        await assert.rejects(site.query(sql), REFUS, sql)
      }
    }
    for (const sql of [
      'INSERT INTO booking_settings DEFAULT VALUES',
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (6, '10:00', '11:00')",
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('blocked', '2027-01-04', '2027-01-04')",
    ]) {
      await assert.rejects(site.query(sql), REFUS, sql)
    }
  })

  it('coffre lit tout, modifie les réglages et les absences, sans rien de plus', async () => {
    for (const table of TABLES) await coffre.query(`SELECT * FROM ${table}`)
    await coffre.query('UPDATE booking_settings SET duration_minutes = 45, updated_at = now()')
    await coffre.query(
      "INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (6, '10:00', '11:00')",
    )
    await coffre.query('DELETE FROM availability_rules WHERE weekday = 6')
    await coffre.query(
      "INSERT INTO availability_exceptions (kind, start_date, end_date) VALUES ('leave', '2027-02-01', '2027-02-05')",
    )
    await coffre.query(
      "UPDATE availability_exceptions SET active = false WHERE kind = 'holiday' AND start_date = '2027-07-21'",
    )
    await coffre.query("DELETE FROM availability_exceptions WHERE kind = 'leave'")

    for (const sql of [
      "UPDATE booking_settings SET time_zone = 'Europe/Brussels'",
      'UPDATE booking_settings SET id = true',
      'INSERT INTO booking_settings DEFAULT VALUES',
      'DELETE FROM booking_settings',
      'TRUNCATE booking_settings',
      "UPDATE availability_rules SET start_time = '09:00'",
      'UPDATE availability_rules SET weekday = 6',
      'TRUNCATE availability_rules',
      "UPDATE availability_exceptions SET start_date = '2027-01-02'",
      "UPDATE availability_exceptions SET kind = 'blocked'",
      "UPDATE availability_exceptions SET label = 'Autre'",
      'TRUNCATE availability_exceptions',
    ]) {
      await assert.rejects(coffre.query(sql), REFUS, sql)
    }
    await admin.query('UPDATE booking_settings SET duration_minutes = 30')
    await admin.query('UPDATE availability_exceptions SET active = true')
  })

  it('le journal accepte `availability`, sans demande visée', async () => {
    await coffre.query(
      "INSERT INTO vault_access_log (actor, action) VALUES ('u1@exemple.test', 'availability')",
    )
    await assert.rejects(
      coffre.query(
        `INSERT INTO vault_access_log (actor, action, request_id)
         VALUES ('u1@exemple.test', 'availability', gen_random_uuid())`,
      ),
      CONTROLE,
    )
    await assert.rejects(
      coffre.query(
        `INSERT INTO vault_access_log (actor, action, purged_requests)
         VALUES ('u1@exemple.test', 'availability', 1)`,
      ),
      CONTROLE,
    )
  })
})
