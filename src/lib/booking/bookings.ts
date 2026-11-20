import { randomUUID } from 'node:crypto'

import type { Pool, PoolClient } from 'pg'

import { withTransaction } from '../db/transaction.ts'
import { enqueueAccessLink } from '../outbox/repository.ts'
import { VaultError } from '../vault/repository.ts'
import { BOOKING_SEALED_BYTES } from '../vault/seal.ts'
import { bookingWindow, type SlotConfig } from './config.ts'
import type { BookingStatus } from './agenda.ts'
import { callPhase, type CallPhase } from './manage.ts'
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
  manageTokenState,
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
// - Story 3.11 : la réservation crée aussi le lien de gestion de l'appel (fonction de la base
//   `issue_manage_token`) ; `readManageLink` lit la page de gestion, `moveBookingByToken` et
//   `cancelBookingByToken` déplacent et annulent par ce lien (rôle `site_public`). `moveBookingLocked`
//   et `cancelBookingLocked` servent aussi au coffre (agenda-repository.ts, rôle `coffre`).

type Db = Pool | PoolClient

const MINUTE_MS = 60_000
const EXCLUSION = '23P01'
const UNIQUE = '23505'
const CONTROLE = '23514'

interface TokenRow {
  id: string
  purpose: 'access' | 'manage'
  booking_id: string | null
  expires_at: Date
  used_at: Date | null
  revoked_at: Date | null
  /** Lien d'accès consommé il y a moins de 15 minutes, à l'heure de la base (0014). */
  replayable: boolean
}

interface FoundToken extends StoredToken {
  id: string
  /** Appel visé par un lien de gestion (story 3.11) ; null pour un lien d'accès. */
  bookingId: string | null
  /** Reprise du double envoi possible (moins de 15 minutes après la réservation, heure de la base). */
  replayable: boolean
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

// Retrouve un jeton par son empreinte. Une forme inattendue n'atteint pas la base. Depuis la story
// 3.11 (relecture sécurité), par les fonctions de la base `find_booking_token` et `lock_booking_token`
// (0014) : le site public ne lit plus aucune empreinte, qui devient ainsi une capacité (sans le jeton,
// on ne vise aucun lien). La base compare les empreintes (SHA-256 de 32 octets aléatoires : une
// comparaison qui s'arrête tôt n'apprend rien d'utile). `forUpdate` : verrou de ligne jusqu'à la fin
// de la transaction (deux envois du même lien passent l'un après l'autre).
async function findToken(db: Db, token: string, forUpdate = false): Promise<FoundToken | null> {
  if (!isTokenFormat(token)) return null
  const { rows } = await db.query<TokenRow>(
    `SELECT id, purpose, booking_id, expires_at, used_at, revoked_at, replayable
     FROM ${forUpdate ? 'lock_booking_token' : 'find_booking_token'}($1)`,
    [hashToken(token)],
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    purpose: row.purpose,
    bookingId: row.booking_id,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    replayable: row.replayable === true,
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
    // Sans RETURNING : depuis la story 3.11, le site public ne lit aucune colonne des jetons.
    // L'échéance rendue est celle de l'heure de l'application (à quelques millisecondes près de
    // celle de la base, qui fait foi).
    await client.query(
      `INSERT INTO booking_tokens (id, token_hash, email_hmac, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
      [id, hash, emailHmac, ACCESS_TOKEN_TTL_HOURS],
    )
    return { token, expiresAt }
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
// `exclude` : l'appel qu'on déplace, dont la plage et la place dans le plafond sont rendues au calcul.
async function loadOpenSlotsWith(
  db: Db,
  now: Date,
  config?: SlotConfig,
  exclude?: string,
): Promise<OpenSlots> {
  const today = zonedParts(now, DEFAULT_BOOKING_SETTINGS.timeZone).date
  const lue = config ?? (await loadSlotConfig(db, { since: today }))
  const { from, to } = bookingWindow(lue.settings, now)
  const bookings = await listConfirmedCalls(db, from, to, { exclude })
  return { config: lue, slots: computeSlots({ ...lue, bookings, busy: [], now }) }
}

/** Créneaux ouverts ; avec `exclude`, ceux où cet appel pourrait être déplacé. */
export async function loadOpenSlots(db: Db, now: Date, exclude?: string): Promise<Slot[]> {
  assertValidDate(now, 'Date')
  return guard(
    'loadOpenSlots',
    async () => (await loadOpenSlotsWith(db, now, undefined, exclude)).slots,
  )
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
 * le lien vient de servir à un appel confirmé à venir (double clic, renvoi, moins de
 * ACCESS_REPLAY_MINUTES), le lien de gestion suffit. Passé ce délai, un lien d'accès consommé ne vaut
 * plus rien (§2, étape 4). Un lien sans valeur ne coûte ainsi ni scellement ni transaction ;
 * `bookSlot` revérifie de toute façon, sous verrou.
 */
export async function checkBookingLink(db: Db, token: string, now: Date): Promise<LinkCheck> {
  assertValidDate(now, 'Date')
  if (!isTokenFormat(token)) return 'invalid'
  return guard('checkBookingLink', async () => {
    const found = await findToken(db, token)
    if (!found) return 'invalid'
    const state = accessTokenState(found, now)
    if (state === 'valid') return 'valid'
    if (state !== 'used' || !found.replayable) return 'invalid'
    const booking = await bookingOfToken(db, found.id)
    return booking?.status === 'confirmed' && booking.ends_at.getTime() > now.getTime()
      ? 'booked'
      : 'invalid'
  })
}

export interface NewBooking {
  token: string
  /**
   * Lien de gestion de l'appel, déduit du lien d'accès (`deriveManageToken`) : la base n'en reçoit que
   * l'empreinte, dans la transaction de la réservation.
   */
  manageToken: string
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
 * 4. depuis la story 3.11 (troisième relecture sécurité), une seule fonction de la base,
 *    `book_slot_as_guest` : lien d'accès revérifié et verrouillé, appel inséré dans les bornes de la
 *    base (`bookings_insert_guard` : durée, pause, délai minimal, horizon, échéance de conservation ;
 *    la contrainte d'exclusion reste le dernier mot : une violation rend `taken`), lien consommé
 *    (`used_at`) et lien de gestion créé (empreinte seule, échéance à la fin de l'appel).
 * Rien n'est écrit si le lien ne vaut plus ou si le créneau n'est plus ouvert. Un second envoi du même
 * lien (moins de ACCESS_REPLAY_MINUTES) rend la réservation faite ; plus tard, `invalid-link`.
 */
export async function bookSlot(pool: Pool, input: NewBooking): Promise<BookingResult> {
  const { token, manageToken, start, sealed, privacyVersion, now } = input
  assertValidDate(start, 'Début')
  assertValidDate(now, 'Date')
  if (sealed.length !== BOOKING_SEALED_BYTES) throw new RangeError('Réservation scellée invalide')
  if (!isTokenFormat(token)) return { status: 'invalid-link' }
  if (!isTokenFormat(manageToken) || manageToken === token) {
    throw new RangeError('Lien de gestion invalide')
  }

  try {
    return await guard('bookSlot', () =>
      withTransaction(pool, async (client): Promise<BookingResult> => {
        const found = await findToken(client, token, true)
        if (!found) return { status: 'invalid-link' }
        const state = accessTokenState(found, now)
        if (state === 'used') {
          if (!found.replayable) return { status: 'invalid-link' }
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

        const occupiedUntil = new Date(
          slot.end.getTime() + config.settings.bufferMinutes * MINUTE_MS,
        )
        // Fonction de la base (0014) : lien d'accès revérifié et verrouillé, appel inséré dans les
        // bornes de la base (échéance de conservation comprise), lien consommé, lien de gestion
        // créé, dans cette transaction. Le site public n'a aucun autre droit d'écriture.
        const { rows } = await client.query<{ id: string | null }>(
          `SELECT book_slot_as_guest($1, $2::timestamptz, $3::timestamptz, $4::timestamptz, $5, $6,
             $7) AS id`,
          [
            hashToken(token),
            slot.start,
            slot.end,
            occupiedUntil,
            privacyVersion,
            sealed,
            hashToken(manageToken),
          ],
        )
        const id = rows[0]?.id
        if (!id) return { status: 'invalid-link' }
        return { status: 'booked', bookingId: id }
      }),
    )
  } catch (error) {
    // Créneau pris par une autre transaction (contrainte d'exclusion) : la transaction est annulée ;
    // les créneaux encore ouverts sont relus. Même lien déjà inscrit (unicité) : la réservation faite.
    const code = codeOf(error)
    if (code === EXCLUSION) return { status: 'taken', slots: await loadOpenSlots(pool, now) }
    // Bornes refusées par la base (délai minimal franchi entre le calcul et l'insertion, réglages
    // changés) : le créneau n'est plus ouvert.
    if (code === CONTROLE) return { status: 'taken', slots: await loadOpenSlots(pool, now) }
    if (code === UNIQUE) {
      const found = await guard('bookSlot', () => findToken(pool, token))
      const booking =
        found?.replayable
          ? await guard('bookSlot', () => bookingOfToken(pool, found.id))
          : null
      if (booking?.status === 'confirmed')
        return { status: 'already-booked', bookingId: booking.id }
    }
    throw error
  }
}

/**
 * Même tâche (D78, story 3.11) : efface le contenu scellé des appels annulés (par la personne ou par
 * la maison) dont le créneau d'origine est fini ; le créneau et le statut restent jusqu'à l'échéance
 * de la réservation. Jusque-là, Cat peut encore rappeler la personne. La base n'accepte qu'une remise
 * à NULL d'un appel annulé (déclencheur `bookings_sealed_guard`). Rend le nombre effacé.
 */
export async function purgeCancelledContents(db: Db, now: Date): Promise<number> {
  assertValidDate(now, 'Date de purge')
  return guard('purgeCancelledContents', async () => {
    const { rowCount } = await db.query(
      `UPDATE bookings SET sealed = NULL
       WHERE status IN ('cancelled_by_guest', 'cancelled_by_house')
         AND ends_at <= $1 AND sealed IS NOT NULL`,
      [now],
    )
    return rowCount ?? 0
  })
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
 * Même tâche : efface les jetons expirés depuis plus de 48 heures. Depuis la story 3.11, un lien
 * d'accès consommé n'est plus la clé de la confirmation (le lien de gestion l'a remplacé) : aucune
 * exception. Un lien de gestion expire à la fin de son appel (la base suit les déplacements) et part
 * avec lui s'il est effacé. Rend le nombre effacé.
 */
export async function purgeTokens(db: Db, now: Date): Promise<number> {
  assertValidDate(now, 'Date de purge')
  const limite = new Date(now.getTime() - TOKEN_PURGE_DELAY_HOURS * 3600 * 1000)
  return guard('purgeTokens', async () => {
    const { rowCount } = await db.query('DELETE FROM booking_tokens WHERE expires_at <= $1', [
      limite,
    ])
    return rowCount ?? 0
  })
}

// --- Lien de gestion : déplacer, annuler (story 3.11 ; docs/reservation-appel.md §2, étape 6) ---

/** Un appel tel que la page de gestion et le coffre le voient : des instants et un statut. */
export interface ManagedCall {
  id: string
  start: Date
  end: Date
  status: BookingStatus
  /** Séquence de l'invitation (`bookings.sequence`) : +1 à chaque déplacement et à l'annulation. */
  sequence: number
}

interface ManagedRow {
  id: string
  starts_at: Date
  ends_at: Date
  status: BookingStatus
  sequence: number
}

function toManaged(row: ManagedRow): ManagedCall {
  return {
    id: row.id,
    start: row.starts_at,
    end: row.ends_at,
    status: row.status,
    sequence: row.sequence,
  }
}

function phaseOf(call: ManagedCall, now: Date): CallPhase {
  return callPhase({ status: call.status, startsAt: call.start, endsAt: call.end }, now)
}

async function selectCall(db: Db, id: string, forUpdate = false): Promise<ManagedCall | null> {
  const { rows } = await db.query<ManagedRow>(
    `SELECT id, starts_at, ends_at, status, sequence FROM bookings WHERE id = $1${
      forUpdate ? ' FOR UPDATE' : ''
    }`,
    [id],
  )
  return rows[0] ? toManaged(rows[0]) : null
}

// Appel visé par un lien de gestion encore valable ; sinon null (inconnu, expiré, annulé, autre usage).
async function callOfManageToken(db: Db, token: string, now: Date): Promise<string | null> {
  const found = await findToken(db, token)
  if (!found || manageTokenState(found, now) !== 'valid' || !found.bookingId) return null
  return found.bookingId
}

export type ManageLink =
  | { state: 'invalid' }
  | {
      state: 'valid'
      call: ManagedCall
      phase: CallPhase
      /** Créneaux où l'appel peut aller (sans lui), seulement s'il se déplace encore et si demandés. */
      slots: Slot[]
    }

/**
 * Page de gestion (GET) : le lien vaut-il encore, où en est l'appel, et (`withSlots`) où peut-il
 * aller. Ne fait que lire (un GET n'engage rien, §4.4). Inconnu, mal formé, expiré ou annulé :
 * `invalid`, sans dire pourquoi.
 */
export async function readManageLink(
  db: Db,
  token: string,
  now: Date,
  options: { withSlots?: boolean } = {},
): Promise<ManageLink> {
  assertValidDate(now, 'Date')
  if (!isTokenFormat(token)) return { state: 'invalid' }
  return guard('readManageLink', async () => {
    const id = await callOfManageToken(db, token, now)
    const call = id ? await selectCall(db, id) : null
    if (!call) return { state: 'invalid' }
    const phase = phaseOf(call, now)
    if (phase === 'over') return { state: 'invalid' }
    const slots =
      options.withSlots && phase === 'upcoming'
        ? (await loadOpenSlotsWith(db, now, undefined, call.id)).slots
        : []
    return { state: 'valid', call, phase, slots }
  })
}

export type MoveResult =
  | { status: 'moved'; call: ManagedCall }
  /** Même créneau que l'actuel (double envoi) : rien n'est écrit. */
  | { status: 'unchanged'; call: ManagedCall }
  /** L'appel a commencé, est annulé ou fini : il ne se déplace plus. */
  | { status: 'not-movable' }
  | { status: 'not-found' }
  /** Le créneau choisi n'est plus ouvert : pris, plafond du jour, réglages changés. */
  | { status: 'taken'; slots: Slot[] }

/**
 * Accès à UN appel dans une transaction : par le lien de gestion de la personne (fonctions de la base
 * qui exigent l'empreinte d'un lien valable, rôle `site_public`, qui n'a aucun droit d'écriture sur
 * `bookings`) ou par son identifiant (coffre, rôle `coffre`, requêtes directes). Les règles et les
 * bornes sont celles des déclencheurs de 0014, sous tout rôle.
 */
export interface CallAccess {
  /** L'appel, verrouillé (FOR UPDATE) jusqu'à la fin de la transaction ; null s'il n'est pas visé. */
  lock(client: PoolClient): Promise<ManagedCall | null>
  /** Déplace l'appel verrouillé ; faux s'il n'a pas bougé. */
  move(client: PoolClient, slot: { start: Date; end: Date; occupiedUntil: Date }): Promise<boolean>
  /** Annule l'appel verrouillé (par la personne, ou par la maison) ; faux s'il n'a pas été annulé. */
  cancel(client: PoolClient): Promise<boolean>
}

/**
 * Par le lien de gestion (rôle `site_public`) : le lien est d'abord vérifié à l'heure de
 * l'application (`manageTokenState`), puis la base le revérifie à la sienne dans chaque fonction.
 */
export function guestAccess(token: string, now: Date): CallAccess {
  const hash = hashToken(token)
  return {
    async lock(client) {
      if (!(await callOfManageToken(client, token, now))) return null
      const { rows } = await client.query<ManagedRow>(
        'SELECT id, starts_at, ends_at, status, sequence FROM lock_call_as_guest($1)',
        [hash],
      )
      return rows[0] ? toManaged(rows[0]) : null
    },
    async move(client, slot) {
      const { rows } = await client.query<{ fait: boolean }>(
        'SELECT move_booking_as_guest($1, $2::timestamptz, $3::timestamptz, $4::timestamptz) AS fait',
        [hash, slot.start, slot.end, slot.occupiedUntil],
      )
      return rows[0]?.fait === true
    },
    async cancel(client) {
      const { rows } = await client.query<{ fait: boolean }>(
        'SELECT cancel_booking_as_guest($1) AS fait',
        [hash],
      )
      return rows[0]?.fait === true
    },
  }
}

/** Par l'identifiant de l'appel (coffre, rôle `coffre`) ; une annulation est « par la maison ». */
export function houseAccess(id: string): CallAccess {
  return {
    lock: (client) => selectCall(client, id, true),
    async move(client, slot) {
      const { rowCount } = await client.query(
        `UPDATE bookings
         SET starts_at = $2::timestamptz, ends_at = $3::timestamptz,
             slot = tstzrange($2::timestamptz, $4::timestamptz, '[)')
         WHERE id = $1 AND status = 'confirmed'`,
        [id, slot.start, slot.end, slot.occupiedUntil],
      )
      return rowCount === 1
    },
    async cancel(client) {
      const { rowCount } = await client.query(
        "UPDATE bookings SET status = 'cancelled_by_house' WHERE id = $1 AND status = 'confirmed'",
        [id],
      )
      return rowCount === 1
    },
  }
}

/**
 * Déplace un appel (§2, étape 6 ; §3.2), dans la transaction donnée :
 * 1. l'appel est verrouillé (FOR UPDATE) : deux déplacements, ou un déplacement et une annulation,
 *    passent l'un après l'autre ;
 * 2. seul un appel confirmé qui n'a pas commencé se déplace ;
 * 3. verrou consultatif sur le jour local du nouveau créneau (le même que la réservation) : le
 *    plafond se compte sans course ;
 * 4. les créneaux ouverts sont recalculés SANS cet appel (sa plage et sa place dans le plafond lui
 *    sont rendues) ; le début choisi doit en être ;
 * 5. une seule mise à jour de la ligne : nouvelle plage prise et ancienne libérée dans la même
 *    instruction ; la contrainte d'exclusion refuse un chevauchement (23P01, l'ancienne plage reste
 *    alors). La durée de l'appel ne change pas (celle de la réservation, que le déclencheur de 0014
 *    impose) ; la pause est celle des réglages du moment. La base pose la séquence de l'invitation,
 *    l'échéance de conservation et celle du lien de gestion.
 * Rend `taken` sans rien écrire si le créneau n'est plus ouvert ; une violation de la contrainte lève
 * (code 23P01) : à l'appelant d'annuler la transaction et de relire les créneaux.
 */
export async function moveBookingLocked(
  client: PoolClient,
  access: CallAccess,
  start: Date,
  now: Date,
): Promise<MoveResult> {
  assertValidDate(start, 'Début')
  assertValidDate(now, 'Date')
  const call = await access.lock(client)
  if (!call) return { status: 'not-found' }
  if (phaseOf(call, now) !== 'upcoming') return { status: 'not-movable' }
  if (call.start.getTime() === start.getTime()) return { status: 'unchanged', call }

  const today = zonedParts(now, DEFAULT_BOOKING_SETTINGS.timeZone).date
  const config = await loadSlotConfig(client, { since: today })
  const day = zonedParts(start, config.settings.timeZone).date
  await client.query("SELECT pg_advisory_xact_lock(hashtext('maison-triona:appels:' || $1))", [day])
  const { slots } = await loadOpenSlotsWith(client, now, config, call.id)
  const slot = slots.find((candidate) => candidate.start.getTime() === start.getTime())
  if (!slot) return { status: 'taken', slots }

  const end = new Date(slot.start.getTime() + (call.end.getTime() - call.start.getTime()))
  const occupiedUntil = new Date(end.getTime() + config.settings.bufferMinutes * MINUTE_MS)
  if (!(await access.move(client, { start: slot.start, end, occupiedUntil }))) {
    return { status: 'not-movable' }
  }
  const moved = await access.lock(client)
  if (!moved) return { status: 'not-movable' }
  return { status: 'moved', call: moved }
}

export type CancelResult = 'cancelled' | 'already-cancelled' | 'not-cancellable' | 'not-found'

/**
 * Annule un appel confirmé qui n'a pas commencé, dans la transaction donnée : sa plage et sa place
 * dans le plafond du jour sont libérées (seuls `confirmed`, `done` et `no_answer` y comptent). La base
 * incrémente la séquence (fichier « Retirer de mon agenda ») et refuse toute autre annulation
 * (déclencheur de 0014). Jamais de retour en arrière.
 */
export async function cancelBookingLocked(
  client: PoolClient,
  access: CallAccess,
  now: Date,
): Promise<CancelResult> {
  assertValidDate(now, 'Date')
  const call = await access.lock(client)
  if (!call) return 'not-found'
  const phase = phaseOf(call, now)
  if (phase === 'cancelled') return 'already-cancelled'
  if (phase !== 'upcoming') return 'not-cancellable'
  return (await access.cancel(client)) ? 'cancelled' : 'not-cancellable'
}

/**
 * LE dépôt d'un déplacement (story 3.11), pour la personne (`guestAccess`) comme pour Cat
 * (`houseAccess`) : une transaction, `moveBookingLocked`, puis, si l'appel est déplacé, `onMoved`
 * (journal du coffre) et le point d'accroche de la 3.12, dans la même transaction. Une violation de la
 * contrainte d'exclusion (créneau pris par une autre transaction) annule tout et rend les créneaux
 * encore ouverts pour cet appel ; un refus d'un déclencheur (l'heure de la base dit que l'appel a
 * commencé, ou un créneau hors des bornes) rend `not-movable`.
 */
export async function moveBooking(
  pool: Pool,
  operation: string,
  access: CallAccess,
  input: { start: Date; now: Date },
  onMoved?: (client: PoolClient, call: ManagedCall) => Promise<void>,
): Promise<MoveResult> {
  try {
    return await guard(operation, () =>
      withTransaction(pool, async (client) => {
        const result = await moveBookingLocked(client, access, input.start, input.now)
        if (result.status === 'moved') {
          if (onMoved) await onMoved(client, result.call)
          // 3.12 : effacer contact_kms et abandonner les rappels en attente de cet appel (puis
          // programmer ceux du nouveau créneau), ici, dans cette transaction.
          // 3.3 / 3.12 : message de déplacement à la personne et invitation mise à jour à Cat
          // (boîte d'envoi), ici aussi.
        }
        return result
      }),
    )
  } catch (error) {
    const code = codeOf(error)
    if (code === EXCLUSION) {
      // L'appel n'a pas bougé : ses créneaux possibles, relus sans lui (lecture seule).
      const call = await guard(operation, () =>
        withTransaction(pool, (client) => access.lock(client)),
      )
      return { status: 'taken', slots: await loadOpenSlots(pool, input.now, call?.id) }
    }
    if (code === CONTROLE) return { status: 'not-movable' }
    throw error
  }
}

/**
 * LE dépôt d'une annulation (story 3.11), pour la personne (`cancelled_by_guest`, `guestAccess`)
 * comme pour Cat (`cancelled_by_house`, `houseAccess`) : une transaction, `cancelBookingLocked`,
 * puis, si l'appel est annulé, `onCancelled` (journal du coffre) et le point d'accroche de la 3.12,
 * dans la même transaction. Un refus d'un déclencheur rend `not-cancellable`.
 */
export async function cancelBooking(
  pool: Pool,
  operation: string,
  access: CallAccess,
  input: { now: Date },
  onCancelled?: (client: PoolClient, bookingId: string) => Promise<void>,
): Promise<CancelResult> {
  try {
    return await guard(operation, () =>
      withTransaction(pool, async (client): Promise<CancelResult> => {
        const call = await access.lock(client)
        if (!call) return 'not-found'
        const result = await cancelBookingLocked(client, access, input.now)
        if (result === 'cancelled') {
          if (onCancelled) await onCancelled(client, call.id)
          // 3.12 : effacer contact_kms et abandonner les rappels en attente de cet appel, ici, dans
          // cette transaction.
          // 3.3 / 3.12 : message d'annulation à la personne (« annulé par la maison » : avec un lien
          // pour choisir un autre créneau, §3.2) et invitation retirée chez Cat, ici aussi.
        }
        return result
      }),
    )
  } catch (error) {
    if (codeOf(error) === CONTROLE) return 'not-cancellable'
    throw error
  }
}

/**
 * Déplacer par le lien de gestion (rôle `site_public`). `invalid-link` : le lien ne vaut plus (ou n'a
 * jamais valu) ; rien n'est écrit.
 */
export async function moveBookingByToken(
  pool: Pool,
  input: { token: string; start: Date; now: Date },
): Promise<MoveResult | { status: 'invalid-link' }> {
  assertValidDate(input.start, 'Début')
  assertValidDate(input.now, 'Date')
  if (!isTokenFormat(input.token)) return { status: 'invalid-link' }
  const result = await moveBooking(
    pool,
    'moveBookingByToken',
    guestAccess(input.token, input.now),
    input,
  )
  return result.status === 'not-found' ? { status: 'invalid-link' } : result
}

/** Annuler par le lien de gestion (rôle `site_public`) : toujours « annulé par la personne ». */
export async function cancelBookingByToken(
  pool: Pool,
  input: { token: string; now: Date },
): Promise<CancelResult | 'invalid-link'> {
  assertValidDate(input.now, 'Date')
  if (!isTokenFormat(input.token)) return 'invalid-link'
  const result = await cancelBooking(
    pool,
    'cancelBookingByToken',
    guestAccess(input.token, input.now),
    { now: input.now },
  )
  return result === 'not-found' ? 'invalid-link' : result
}

/** Un appel par son identifiant (coffre), avec les créneaux où le déplacer s'il se déplace encore. */
export async function readCallWithSlots(
  db: Db,
  id: string,
  now: Date,
): Promise<{ call: ManagedCall; phase: CallPhase; slots: Slot[] } | null> {
  const call = await selectCall(db, id)
  if (!call) return null
  const phase = phaseOf(call, now)
  const slots =
    phase === 'upcoming' ? (await loadOpenSlotsWith(db, now, undefined, call.id)).slots : []
  return { call, phase, slots }
}
