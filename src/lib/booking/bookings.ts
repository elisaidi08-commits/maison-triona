import { randomUUID } from 'node:crypto'

import type { Pool, PoolClient } from 'pg'

import { withTransaction } from '../db/transaction.ts'
import { enqueueAccessLink } from '../outbox/repository.ts'
import { VaultError } from '../vault/repository.ts'
import { RETENTION_MONTHS, retentionDeadline } from '../vault/retention.ts'
import { BOOKING_SEALED_BYTES } from '../vault/seal.ts'
import { bookingWindow, type SlotConfig } from './config.ts'
import { listConfirmedCalls, loadSlotConfig } from './repository.ts'
import { DEFAULT_BOOKING_SETTINGS } from './settings.ts'
import { computeSlots, type Slot } from './slots.ts'
import {
  ACCESS_TOKEN_TTL_HOURS,
  accessTokenExpiry,
  accessTokenState,
  generateToken,
  hashToken,
  isTokenFormat,
  tokenMatches,
  type StoredToken,
} from './tokens.ts'
import { zonedParts } from './zoned-time.ts'

// Liens et réservations (story 3.10 ; docs/reservation-appel.md §4.2, §4.4 ; db/migrations/
// 0008_reservations.sql), sans ORM, dans le style de src/lib/vault/repository.ts : requêtes
// paramétrées, erreurs réduites à leur code (VaultError). Le jeton ne quitte jamais ce module que vers
// la personne : la base ne reçoit que son empreinte, aucun journal ne le voit.
// - Coffre (rôle `coffre`) : `createBookingLink`, un lien d'accès sans cible, journalisé.
// - Site public (rôle `site_public`) : `readBookingLink` et `readConfirmation` ne font que lire (une
//   page affichée par GET n'engage rien, §4.4) ; `bookSlot` réserve, dans une transaction.
// - Story 3.9 : `requestAccessLink` (rôle `site_public`) émet un lien avec l'empreinte d'une adresse,
//   ce qui annule d'abord les liens vivants de cette adresse (un nouveau lien annule l'ancien), et
//   inscrit l'e-mail d'accès dans la boîte d'envoi, dans la même transaction.

type Db = Pool | PoolClient

const MINUTE_MS = 60_000
const EXCLUSION = '23P01'
const UNIQUE = '23505'

interface TokenRow {
  id: string
  token_hash: Buffer
  purpose: 'access' | 'manage'
  expires_at: Date
  used_at: Date | null
  revoked_at: Date | null
}

interface FoundToken extends StoredToken {
  id: string
}

async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw error instanceof VaultError ? error : new VaultError(operation, error)
  }
}

function assertValidDate(date: Date, label: string): void {
  if (Number.isNaN(date.getTime())) throw new RangeError(`${label} invalide`)
}

// Retrouve un jeton par son empreinte, puis compare à temps constant. Une forme inattendue
// n'atteint pas la base. `forUpdate` : verrou de ligne jusqu'à la fin de la transaction (deux envois
// du même lien passent l'un après l'autre).
async function findToken(db: Db, token: string, forUpdate = false): Promise<FoundToken | null> {
  if (!isTokenFormat(token)) return null
  const { rows } = await db.query<TokenRow>(
    `SELECT id, token_hash, purpose, expires_at, used_at, revoked_at
     FROM booking_tokens WHERE token_hash = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [hashToken(token)],
  )
  const row = rows[0]
  if (!row || !tokenMatches(token, row.token_hash)) return null
  return {
    id: row.id,
    purpose: row.purpose,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
  }
}

interface BookingRow {
  id: string
  starts_at: Date
  ends_at: Date
  status: string
}

async function bookingOfToken(db: Db, tokenId: string): Promise<BookingRow | null> {
  const { rows } = await db.query<BookingRow>(
    'SELECT id, starts_at, ends_at, status FROM bookings WHERE access_token_id = $1',
    [tokenId],
  )
  return rows[0] ?? null
}

export interface IssuedLink {
  /** À remettre une seule fois à la personne, jamais conservé ni journalisé. */
  token: string
  expiresAt: Date
}

/**
 * Émet un lien d'accès (48 heures) dans la transaction donnée. Avec l'empreinte d'une adresse
 * (story 3.9), les liens vivants de cette adresse sont d'abord annulés, sous verrou consultatif :
 * l'index unique de la base n'en tolère qu'un ; création et échéance à l'heure de la base (`now` est
 * ignoré). Sans empreinte (coffre), rien n'est annulé, et `now` fixe la création.
 */
export async function issueAccessToken(
  client: PoolClient,
  options: { emailHmac: Uint8Array | null; now: Date },
): Promise<IssuedLink> {
  const { emailHmac, now } = options
  const expiresAt = accessTokenExpiry(now)
  const { token, hash } = generateToken()
  const id = randomUUID()
  if (emailHmac) {
    if (emailHmac.length !== 32) throw new RangeError('Empreinte d’adresse invalide')
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('maison-triona:lien:' || encode($1::bytea, 'hex')))",
      [emailHmac],
    )
    // Fonction de la base (migration 0011) : le site public n'annule que les liens de cette empreinte.
    await client.query('SELECT revoke_live_access_links($1)', [emailHmac])
    // Heures de la base : le site public ne fixe ni la création ni l'usage du lien (rôle
    // `site_public`, 0011) ; `now` ne sert qu'aux liens du coffre.
    const { rows } = await client.query<{ expires_at: Date }>(
      `INSERT INTO booking_tokens (id, token_hash, email_hmac, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(hours => $4))
       RETURNING expires_at`,
      [id, hash, emailHmac, ACCESS_TOKEN_TTL_HOURS],
    )
    return { token, expiresAt: rows[0]?.expires_at ?? expiresAt }
  }
  await client.query(
    `INSERT INTO booking_tokens (id, token_hash, purpose, created_at, expires_at)
     VALUES ($1, $2, 'access', $3, $4)`,
    [id, hash, now, expiresAt],
  )
  return { token, expiresAt }
}

/**
 * « Créer un lien de réservation » depuis le coffre (pont en attendant l'e-mail de la story 3.9) :
 * le jeton et la ligne `booking_link` du journal (au nom du compte, sans valeur) dans la même
 * transaction. Le lien s'affiche une fois ; Cat l'envoie elle-même.
 */
export async function createBookingLink(pool: Pool, actor: string, now: Date): Promise<IssuedLink> {
  assertValidDate(now, 'Date de création')
  return guard('createBookingLink', () =>
    withTransaction(pool, async (client) => {
      const issued = await issueAccessToken(client, { emailHmac: null, now })
      await client.query(
        "INSERT INTO vault_access_log (actor, action) VALUES ($1, 'booking_link')",
        [actor],
      )
      return issued
    }),
  )
}

/**
 * Demande de lien (story 3.9, rôle `site_public`) : dans une transaction, le lien d'accès de cette
 * empreinte d'adresse (les précédents annulés) et sa ligne `booking_access` dans la boîte d'envoi.
 * L'un ne va jamais sans l'autre : un lien sans e-mail ne servirait à personne, un e-mail sans lien
 * mènerait à une page « Ce lien n'est plus valable ». Rend le jeton, à remettre au seul premier essai
 * d'envoi, jamais conservé.
 */
export async function requestAccessLink(
  pool: Pool,
  input: { emailHmac: Uint8Array; outboxId: string; now: Date },
): Promise<IssuedLink> {
  assertValidDate(input.now, 'Date de la demande')
  if (!(input.emailHmac instanceof Uint8Array) || input.emailHmac.length !== 32) {
    throw new RangeError('Empreinte d’adresse invalide')
  }
  return guard('requestAccessLink', () =>
    withTransaction(pool, async (client) => {
      const issued = await issueAccessToken(client, {
        emailHmac: input.emailHmac,
        now: input.now,
      })
      await enqueueAccessLink(client, input.outboxId)
      return issued
    }),
  )
}

export interface OpenSlots {
  slots: Slot[]
  config: SlotConfig
}

// Créneaux ouverts à cet instant : réglages, semaine type, absences actives, appels confirmés.
async function loadOpenSlotsWith(db: Db, now: Date, config?: SlotConfig): Promise<OpenSlots> {
  const today = zonedParts(now, DEFAULT_BOOKING_SETTINGS.timeZone).date
  const lue = config ?? (await loadSlotConfig(db, { since: today }))
  const { from, to } = bookingWindow(lue.settings, now)
  const bookings = await listConfirmedCalls(db, from, to)
  return { config: lue, slots: computeSlots({ ...lue, bookings, busy: [], now }) }
}

export async function loadOpenSlots(db: Db, now: Date): Promise<Slot[]> {
  assertValidDate(now, 'Date')
  return guard('loadOpenSlots', async () => (await loadOpenSlotsWith(db, now)).slots)
}

export type LinkState = { state: 'valid'; slots: Slot[] } | { state: 'invalid' }

/**
 * Page de réservation (GET) : le lien vaut-il encore, et quels créneaux proposer. Ne fait que lire.
 * Inconnu, mal formé, expiré, annulé ou déjà utilisé : `invalid`, sans dire pourquoi.
 */
export async function readBookingLink(db: Db, token: string, now: Date): Promise<LinkState> {
  assertValidDate(now, 'Date')
  if (!isTokenFormat(token)) return { state: 'invalid' }
  return guard('readBookingLink', async () => {
    const found = await findToken(db, token)
    if (!found || accessTokenState(found, now) !== 'valid') return { state: 'invalid' }
    return { state: 'valid', slots: (await loadOpenSlotsWith(db, now)).slots }
  })
}

export type LinkCheck = 'valid' | 'booked' | 'invalid'

/**
 * Avant de sceller et de réserver (Server Action) : le lien vaut-il encore ? Lecture seule. `booked` :
 * le lien a déjà servi à un appel confirmé à venir (double clic, renvoi), la confirmation suffit.
 * Un lien sans valeur ne coûte ainsi ni scellement ni transaction ; `bookSlot` revérifie de toute
 * façon, sous verrou.
 */
export async function checkBookingLink(db: Db, token: string, now: Date): Promise<LinkCheck> {
  assertValidDate(now, 'Date')
  if (!isTokenFormat(token)) return 'invalid'
  return guard('checkBookingLink', async () => {
    const found = await findToken(db, token)
    if (!found) return 'invalid'
    const state = accessTokenState(found, now)
    if (state === 'valid') return 'valid'
    if (state !== 'used') return 'invalid'
    const booking = await bookingOfToken(db, found.id)
    return booking?.status === 'confirmed' && booking.ends_at.getTime() > now.getTime()
      ? 'booked'
      : 'invalid'
  })
}

export interface Confirmation {
  bookingId: string
  start: Date
  end: Date
}

/**
 * Confirmation et fichier .ics (GET) : le lien a servi à une réservation encore confirmée et pas
 * encore passée. Ne fait que lire. Jusqu'à la story 3.11 (lien de gestion), le lien d'accès consommé
 * tient lieu de clé de cette confirmation, jusqu'à la fin de l'appel.
 */
export async function readConfirmation(
  db: Db,
  token: string,
  now: Date,
): Promise<Confirmation | null> {
  assertValidDate(now, 'Date')
  if (!isTokenFormat(token)) return null
  return guard('readConfirmation', async () => {
    const found = await findToken(db, token)
    if (!found || accessTokenState(found, now) !== 'used') return null
    const booking = await bookingOfToken(db, found.id)
    if (!booking || booking.status !== 'confirmed') return null
    if (booking.ends_at.getTime() <= now.getTime()) return null
    return { bookingId: booking.id, start: booking.starts_at, end: booking.ends_at }
  })
}

export interface NewBooking {
  token: string
  /** Début choisi : il doit être, à cet instant, l'un des créneaux ouverts. */
  start: Date
  /** La personne, déjà scellée (`sealBooking`, 2 096 octets). */
  sealed: Uint8Array
  privacyVersion: string
  now: Date
}

export type BookingResult =
  | { status: 'booked'; bookingId: string }
  /** Le même lien a déjà servi (double clic, renvoi) : la réservation faite, rien de plus. */
  | { status: 'already-booked'; bookingId: string }
  | { status: 'invalid-link' }
  /** Le créneau n'est plus ouvert : pris, plafond du jour atteint, réglages changés. */
  | { status: 'taken'; slots: Slot[] }

function codeOf(error: unknown): string | undefined {
  return error instanceof VaultError ? error.code : undefined
}

/**
 * Réserve un créneau (§4.2), dans une transaction :
 * 1. le lien, retrouvé par son empreinte, est verrouillé (FOR UPDATE) : deux envois du même lien
 *    passent l'un après l'autre, le second trouve le lien consommé et rend la réservation faite ;
 * 2. verrou consultatif sur le jour local du créneau : deux réservations du même jour passent l'une
 *    après l'autre, le plafond par jour se compte sans course ;
 * 3. les créneaux ouverts sont recalculés (computeSlots : semaine type, absences, délai, horizon,
 *    plafond, appels confirmés) ; le début choisi doit en être ;
 * 4. insertion (la contrainte d'exclusion reste le dernier mot : une violation rend `taken`), puis
 *    le lien est consommé (`used_at`). L'identifiant est tiré ici : insertion sans RETURNING.
 * Rien n'est écrit si le lien ne vaut plus ou si le créneau n'est plus ouvert.
 */
export async function bookSlot(pool: Pool, input: NewBooking): Promise<BookingResult> {
  const { token, start, sealed, privacyVersion, now } = input
  assertValidDate(start, 'Début')
  assertValidDate(now, 'Date')
  if (sealed.length !== BOOKING_SEALED_BYTES) throw new RangeError('Réservation scellée invalide')
  if (!isTokenFormat(token)) return { status: 'invalid-link' }

  try {
    return await guard('bookSlot', () =>
      withTransaction(pool, async (client): Promise<BookingResult> => {
        const found = await findToken(client, token, true)
        if (!found) return { status: 'invalid-link' }
        const state = accessTokenState(found, now)
        if (state === 'used') {
          const booking = await bookingOfToken(client, found.id)
          return booking?.status === 'confirmed'
            ? { status: 'already-booked', bookingId: booking.id }
            : { status: 'invalid-link' }
        }
        if (state !== 'valid') return { status: 'invalid-link' }

        const today = zonedParts(now, DEFAULT_BOOKING_SETTINGS.timeZone).date
        const config = await loadSlotConfig(client, { since: today })
        const day = zonedParts(start, config.settings.timeZone).date
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('maison-triona:appels:' || $1))",
          [day],
        )
        const { slots } = await loadOpenSlotsWith(client, now, config)
        const slot = slots.find((candidate) => candidate.start.getTime() === start.getTime())
        if (!slot) return { status: 'taken', slots }

        const id = randomUUID()
        const occupiedUntil = new Date(
          slot.end.getTime() + config.settings.bufferMinutes * MINUTE_MS,
        )
        await client.query(
          `INSERT INTO bookings
             (id, access_token_id, starts_at, ends_at, slot, privacy_version, retention_until, sealed)
           VALUES ($1, $2, $3::timestamptz, $4::timestamptz,
                   tstzrange($3::timestamptz, $5::timestamptz, '[)'), $6, $7, $8)`,
          [
            id,
            found.id,
            slot.start,
            slot.end,
            occupiedUntil,
            privacyVersion,
            retentionDeadline(slot.start, RETENTION_MONTHS),
            sealed,
          ],
        )
        const { rowCount } = await client.query(
          'UPDATE booking_tokens SET used_at = $2 WHERE id = $1 AND used_at IS NULL',
          [found.id, now],
        )
        if (rowCount !== 1) throw new Error('Lien déjà consommé')
        return { status: 'booked', bookingId: id }
      }),
    )
  } catch (error) {
    // Créneau pris par une autre transaction (contrainte d'exclusion) : la transaction est annulée ;
    // les créneaux encore ouverts sont relus. Même lien déjà inscrit (unicité) : la réservation faite.
    const code = codeOf(error)
    if (code === EXCLUSION) return { status: 'taken', slots: await loadOpenSlots(pool, now) }
    if (code === UNIQUE) {
      const found = await guard('bookSlot', () => findToken(pool, token))
      const booking = found ? await guard('bookSlot', () => bookingOfToken(pool, found.id)) : null
      if (booking?.status === 'confirmed')
        return { status: 'already-booked', bookingId: booking.id }
    }
    throw error
  }
}

/** Délai après l'expiration d'un jeton avant son effacement par la conservation planifiée. */
export const TOKEN_PURGE_DELAY_HOURS = 48

/**
 * Conservation planifiée (story 3.2 D, /api/cron/retention ; rôle `coffre`) : efface les réservations
 * dont l'échéance de conservation est passée. Rend le nombre effacé, rien d'autre.
 */
export async function purgeBookings(db: Db, now: Date): Promise<number> {
  assertValidDate(now, 'Date de purge')
  return guard('purgeBookings', async () => {
    const { rowCount } = await db.query('DELETE FROM bookings WHERE retention_until <= $1', [now])
    return rowCount ?? 0
  })
}

/**
 * Même tâche : efface les jetons expirés depuis plus de 48 heures, sauf celui qui sert encore de clé à
 * la confirmation d'un appel confirmé à venir (jusqu'à la story 3.11) ; il part au premier passage qui
 * suit la fin de l'appel. Rend le nombre effacé.
 */
export async function purgeTokens(db: Db, now: Date): Promise<number> {
  assertValidDate(now, 'Date de purge')
  const limite = new Date(now.getTime() - TOKEN_PURGE_DELAY_HOURS * 3600 * 1000)
  return guard('purgeTokens', async () => {
    const { rowCount } = await db.query(
      `DELETE FROM booking_tokens AS t
       WHERE t.expires_at <= $1
         AND NOT EXISTS (
           SELECT 1 FROM bookings AS b
           WHERE b.access_token_id = t.id AND b.status = 'confirmed' AND b.ends_at > $2
         )`,
      [limite, now],
    )
    return rowCount ?? 0
  })
}
