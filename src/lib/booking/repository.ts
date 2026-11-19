import type { Pool, PoolClient } from 'pg'

import { withTransaction } from '../db/transaction.ts'
import { VaultError } from '../vault/repository.ts'
import { belgianHolidays } from './belgian-holidays.ts'
import {
  toAvailabilityState,
  toSlotConfig,
  type AvailabilityState,
  type ExceptionRow,
  type RuleRow,
  type SettingsRow,
  type SlotConfig,
} from './config.ts'
import type { AvailabilityRule, EditableBookingSettings } from './settings.ts'
import type { BookedCall } from './slots.ts'

// Disponibilités de Cat (story 3.8, partie B ; db/migrations/0007_disponibilites.sql), sans ORM, dans
// le style de src/lib/vault/repository.ts : requêtes paramétrées, erreurs réduites à leur code
// (VaultError, jamais la valeur refusée). Tables en clair : rien de personnel.
// Lecture : rôles `coffre` et, depuis la story 3.10, `site_public` (page publique de réservation).
// Écriture : rôle `coffre` seulement, chaque modification dans une transaction avec sa ligne
// `availability` au journal d'accès (au nom du compte, sans demande ni valeur). Ce qui ne change
// rien (même réglages, journée déjà bloquée, plage inconnue) n'écrit rien, journal compris.

type Db = Pool | PoolClient

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LOG = "INSERT INTO vault_access_log (actor, action) VALUES ($1, 'availability')"
// Contrainte d'exclusion levée par le déclencheur de la semaine type (exclusion_violation).
const CHEVAUCHEMENT = '23P01'

async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw error instanceof VaultError ? error : new VaultError(operation, error)
  }
}

// Écriture et ligne de journal dans la même transaction ; journal seulement si quelque chose change.
async function modifier(
  pool: Pool,
  operation: string,
  actor: string,
  write: (client: PoolClient) => Promise<number>,
): Promise<number> {
  return guard(operation, () =>
    withTransaction(pool, async (client) => {
      const changed = await write(client)
      if (changed > 0) await client.query(LOG, [actor])
      return changed
    }),
  )
}

export interface LoadOptions {
  /** Date locale « YYYY-MM-DD » : les absences finies avant ne sont pas lues. */
  since?: string
}

/** Réglages, semaine type et absences, identifiants compris (page du coffre). */
export async function loadAvailability(
  db: Db,
  options: LoadOptions = {},
): Promise<AvailabilityState> {
  const since = options.since ?? null
  const rows = await guard('loadAvailability', async () => {
    const settings = await db.query<SettingsRow>(
      `SELECT time_zone, duration_minutes, buffer_minutes, min_notice_minutes, horizon_days,
              daily_cap
       FROM booking_settings`,
    )
    const rules = await db.query<RuleRow>(
      `SELECT id, weekday, to_char(start_time, 'HH24:MI') AS start_time,
              to_char(end_time, 'HH24:MI') AS end_time
       FROM availability_rules ORDER BY weekday, start_time`,
    )
    const exceptions = await db.query<ExceptionRow>(
      `SELECT id, kind, to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date, label, active
       FROM availability_exceptions
       WHERE $1::date IS NULL OR end_date >= $1::date
       ORDER BY start_date, kind`,
      [since],
    )
    return { settings: settings.rows[0], rules: rules.rows, exceptions: exceptions.rows }
  })
  if (!rows.settings) throw new VaultError('loadAvailability', null)
  return toAvailabilityState({ ...rows, settings: rows.settings })
}

/** Les mêmes, au format de `computeSlots` (absences actives seulement). */
export async function loadSlotConfig(db: Db, options: LoadOptions = {}): Promise<SlotConfig> {
  return toSlotConfig(await loadAvailability(db, options))
}

/**
 * Appels confirmés dont la plage occupée (début → fin + pause) touche la période, au format de
 * `computeSlots` (`occupiedUntil` = borne haute de `slot`), du plus tôt au plus tard. Branché sur
 * `bookings` par la story 3.10 : lu par la page publique de réservation (rôle `site_public`, colonnes
 * `slot` et `status` seulement) et par le coffre (aperçu des créneaux, appels gardés d'une journée
 * bloquée, spec §3.1). Rien de personnel : des instants.
 */
export async function listConfirmedCalls(db: Db, from: Date, to: Date): Promise<BookedCall[]> {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new RangeError('Période invalide')
  }
  const { rows } = await guard('listConfirmedCalls', () =>
    db.query<{ debut: Date; fin: Date }>(
      `SELECT lower(slot) AS debut, upper(slot) AS fin FROM bookings
       WHERE status = 'confirmed' AND slot && tstzrange($1::timestamptz, $2::timestamptz)
       ORDER BY lower(slot)`,
      [from, to],
    ),
  )
  return rows.map((row) => ({ start: row.debut, occupiedUntil: row.fin }))
}

/** Réglages des appels ; vrai s'ils ont changé. */
export async function updateSettings(
  pool: Pool,
  settings: EditableBookingSettings,
  actor: string,
): Promise<boolean> {
  const values = [
    settings.durationMinutes,
    settings.bufferMinutes,
    settings.minNoticeMinutes,
    settings.horizonDays,
    settings.dailyCap,
  ]
  const changed = await modifier(pool, 'updateSettings', actor, async (client) => {
    const { rowCount } = await client.query(
      `UPDATE booking_settings
       SET duration_minutes = $1, buffer_minutes = $2, min_notice_minutes = $3, horizon_days = $4,
           daily_cap = $5, updated_at = now()
       WHERE (duration_minutes, buffer_minutes, min_notice_minutes, horizon_days, daily_cap)
             IS DISTINCT FROM ($1::int, $2::int, $3::int, $4::int, $5::int)`,
      values,
    )
    return rowCount ?? 0
  })
  return changed > 0
}

/** Ajoute une plage à la semaine type ; `overlap` si elle chevauche une plage du même jour. */
export async function addRule(
  pool: Pool,
  rule: AvailabilityRule,
  actor: string,
): Promise<'ok' | 'overlap'> {
  try {
    await modifier(pool, 'addRule', actor, async (client) => {
      const { rowCount } = await client.query(
        `INSERT INTO availability_rules (weekday, start_time, end_time)
         VALUES ($1, $2::time, $3::time)`,
        [rule.weekday, rule.start, rule.end],
      )
      return rowCount ?? 0
    })
    return 'ok'
  } catch (error) {
    if (error instanceof VaultError && error.code === CHEVAUCHEMENT) return 'overlap'
    throw error
  }
}

/** Retire une plage ; faux si elle n'existe pas. */
export async function removeRule(pool: Pool, id: string, actor: string): Promise<boolean> {
  if (!UUID.test(id)) return false
  const changed = await modifier(pool, 'removeRule', actor, async (client) => {
    const { rowCount } = await client.query('DELETE FROM availability_rules WHERE id = $1', [id])
    return rowCount ?? 0
  })
  return changed > 0
}

/** Congé, dates locales incluses (bornes vérifiées par la validation et par la base). */
export async function addLeave(
  pool: Pool,
  leave: { startDate: string; endDate: string },
  actor: string,
): Promise<void> {
  await modifier(pool, 'addLeave', actor, async (client) => {
    const { rowCount } = await client.query(
      `INSERT INTO availability_exceptions (kind, start_date, end_date)
       VALUES ('leave', $1::date, $2::date)`,
      [leave.startDate, leave.endDate],
    )
    return rowCount ?? 0
  })
}

/**
 * « Bloquer cette journée » : vrai si elle vient d'être bloquée, faux si elle l'était déjà (double
 * clic). Les appels déjà confirmés ce jour-là sont gardés (spec §3.1) : la page les signale, par
 * `listConfirmedCalls` et `callsDuring`.
 */
export async function blockDay(pool: Pool, date: string, actor: string): Promise<boolean> {
  const changed = await modifier(pool, 'blockDay', actor, async (client) => {
    const { rowCount } = await client.query(
      `INSERT INTO availability_exceptions (kind, start_date, end_date)
       VALUES ('blocked', $1::date, $1::date)
       ON CONFLICT DO NOTHING`,
      [date],
    )
    return rowCount ?? 0
  })
  return changed > 0
}

/** Retire un congé ou une journée bloquée ; un jour férié ne se retire pas, il se décoche. */
export async function removeAbsence(pool: Pool, id: string, actor: string): Promise<boolean> {
  if (!UUID.test(id)) return false
  const changed = await modifier(pool, 'removeAbsence', actor, async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM availability_exceptions WHERE id = $1 AND kind IN ('leave', 'blocked')`,
      [id],
    )
    return rowCount ?? 0
  })
  return changed > 0
}

/**
 * Jours fériés affichés par le formulaire : cochés (`fermes`), ils restent fermés aux appels ;
 * décochés, ils s'ouvrent. Rend le nombre de jours qui ont changé.
 */
export async function setHolidays(
  pool: Pool,
  holidays: { affiches: string[]; fermes: string[] },
  actor: string,
): Promise<number> {
  return modifier(pool, 'setHolidays', actor, async (client) => {
    const { rowCount } = await client.query(
      `UPDATE availability_exceptions
       SET active = (start_date = ANY ($2::date[]))
       WHERE kind = 'holiday' AND start_date = ANY ($1::date[])
         AND active IS DISTINCT FROM (start_date = ANY ($2::date[]))`,
      [holidays.affiches, holidays.fermes],
    )
    return rowCount ?? 0
  })
}

/**
 * Jours fériés d'une année au-delà de ceux de la migration (2026 à 2035), depuis belgianHolidays() ;
 * ceux qui existent déjà sont gardés tels quels (cochés ou non). Rend le nombre de jours ajoutés.
 */
export async function prefillHolidays(pool: Pool, year: number, actor: string): Promise<number> {
  if (!Number.isInteger(year) || year < 1583) throw new RangeError('Année invalide')
  const holidays = belgianHolidays(year)
  return modifier(pool, 'prefillHolidays', actor, async (client) => {
    const { rowCount } = await client.query(
      `INSERT INTO availability_exceptions (kind, start_date, end_date, label)
       SELECT 'holiday', day, day, name
       FROM unnest($1::date[], $2::text[]) AS holiday (day, name)
       ON CONFLICT DO NOTHING`,
      [holidays.map((holiday) => holiday.date), holidays.map((holiday) => holiday.name)],
    )
    return rowCount ?? 0
  })
}
