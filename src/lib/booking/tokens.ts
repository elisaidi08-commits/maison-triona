/**
 * Jetons des liens de réservation (story 3.10 ; docs/reservation-appel.md §4.4). Un jeton est tiré de
 * 32 octets aléatoires (`crypto.randomBytes`) et écrit en base64url sans remplissage : 43 caractères,
 * sûrs dans une URL. La base ne garde que son empreinte SHA-256 : qui lit la base ne peut pas
 * reconstituer un lien. On retrouve un jeton par son empreinte, puis on la compare à temps constant
 * (`timingSafeEqual`). Un jeton ne va jamais dans un journal, ni dans un message d'erreur.
 * Serveur seulement (API de Node) ; imports relatifs : testé par node --test.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const TOKEN_BYTES = 32
/** Longueur du jeton en base64url sans remplissage : ⌈32 × 8 / 6⌉. */
export const TOKEN_LENGTH = 43
/** Durée de validité d'un lien d'accès (§2, D57). */
export const ACCESS_TOKEN_TTL_HOURS = 48

const HASH_BYTES = 32
const FORMAT = /^[A-Za-z0-9_-]{43}$/

export interface IssuedToken {
  /** À remettre une seule fois à la personne (lien), jamais conservé. */
  token: string
  /** Seule trace en base (`booking_tokens.token_hash`). */
  hash: Buffer
}

/** Empreinte SHA-256 du texte du jeton. */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

export function generateToken(): IssuedToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, hash: hashToken(token) }
}

/** Forme exacte d'un jeton : rien d'autre n'atteint la base. */
export function isTokenFormat(value: unknown): value is string {
  return typeof value === 'string' && FORMAT.test(value)
}

/** Le jeton correspond-il à l'empreinte enregistrée ? Comparaison à temps constant. */
export function tokenMatches(token: string, storedHash: Uint8Array): boolean {
  if (storedHash.length !== HASH_BYTES) return false
  return timingSafeEqual(hashToken(token), storedHash)
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) throw new RangeError('Date invalide')
}

/** Échéance d'un lien d'accès créé à cet instant. */
export function accessTokenExpiry(now: Date): Date {
  assertValidDate(now)
  return new Date(now.getTime() + ACCESS_TOKEN_TTL_HOURS * 3600 * 1000)
}

export interface StoredToken {
  purpose: 'access' | 'manage'
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
}

export type TokenState = 'valid' | 'expired' | 'used' | 'revoked' | 'wrong-purpose'

/**
 * État d'un lien d'accès à cet instant. Annulé l'emporte sur utilisé, utilisé sur expiré : un lien
 * qui a servi à réserver le reste, même échu (la confirmation en dépend).
 */
export function accessTokenState(token: StoredToken, now: Date): TokenState {
  assertValidDate(now)
  if (token.purpose !== 'access') return 'wrong-purpose'
  if (token.revokedAt) return 'revoked'
  if (token.usedAt) return 'used'
  if (now.getTime() >= token.expiresAt.getTime()) return 'expired'
  return 'valid'
}
