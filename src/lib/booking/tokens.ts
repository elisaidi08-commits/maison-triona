/**
 * Jetons des liens de réservation (story 3.10 ; docs/reservation-appel.md §4.4). Un jeton est tiré de
 * 32 octets aléatoires (`crypto.randomBytes`) et écrit en base64url sans remplissage : 43 caractères,
 * sûrs dans une URL. La base ne garde que son empreinte SHA-256 : qui lit la base ne peut pas
 * reconstituer un lien. On retrouve un jeton par son empreinte, puis on la compare à temps constant
 * (`timingSafeEqual`). Un jeton ne va jamais dans un journal, ni dans un message d'erreur.
 * Serveur seulement (API de Node) ; imports relatifs : testé par node --test.
 */
import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto'

export const TOKEN_BYTES = 32
/** Longueur du jeton en base64url sans remplissage : ⌈32 × 8 / 6⌉. */
export const TOKEN_LENGTH = 43
/** Durée de validité d'un lien d'accès (§2, D57). */
export const ACCESS_TOKEN_TTL_HOURS = 48
/**
 * Lien d'accès qui vient de servir (story 3.11) : pendant ce délai après la réservation, un second
 * envoi du même formulaire (double clic, renvoi sans JavaScript) mène encore au lien de gestion ;
 * ensuite, le lien d'accès ne vaut plus rien (§2, étape 4 : seul le lien de gestion reste valable).
 * Mesuré à l'heure de la base (`replayable` de `find_booking_token`, 0014, qui recopie cette valeur) :
 * `used_at` est posé par la base, jamais par l'appelant.
 */
export const ACCESS_REPLAY_MINUTES = 15

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

/**
 * Lien de gestion d'un appel (story 3.11 ; §2, étapes 4 et 6) : déduit du lien d'accès qui l'a réservé
 * et d'une sous-clé propre (HKDF-SHA256 de `FORM_SIGNING_SECRET`, étiquette « gestion » : la clé du
 * lien n'est ni celle de l'horodatage ni celle du sel des empreintes d'IP), puis HMAC-SHA256 ; même
 * forme qu'un jeton (43 caractères). Le déduire plutôt que le tirer au hasard permet de le rendre une
 * seconde fois au double envoi du formulaire, sans le garder nulle part ; la base n'en reçoit que
 * l'empreinte, comme tout jeton. Sans le secret, le lien d'accès seul ne le donne pas ; passé
 * ACCESS_REPLAY_MINUTES, le serveur ne le rend plus.
 * Changer `FORM_SIGNING_SECRET` ne casse aucun lien de gestion déjà émis (son empreinte est en base) :
 * seul un double envoi dans les 15 minutes qui suivent une réservation mène alors à « Ce lien n'est
 * plus valable » (l'appel, lui, est réservé).
 */
export function deriveManageToken(accessToken: string, secret: string): string {
  if (!isTokenFormat(accessToken)) throw new RangeError('Jeton invalide')
  if (typeof secret !== 'string' || secret.length === 0) throw new RangeError('Secret manquant')
  const cle = Buffer.from(hkdfSync('sha256', secret, '', 'maison-triona:gestion', 32))
  return createHmac('sha256', cle).update(accessToken, 'utf8').digest('base64url')
}

export type ManageTokenState = 'valid' | 'expired' | 'revoked' | 'wrong-purpose'

/**
 * État d'un lien de gestion à cet instant : il vaut jusqu'à la fin de l'appel (`expires_at`, que la
 * base garde égale à la fin, même après un déplacement), sauf s'il est annulé.
 */
export function manageTokenState(token: StoredToken, now: Date): ManageTokenState {
  assertValidDate(now)
  if (token.purpose !== 'manage') return 'wrong-purpose'
  if (token.revokedAt) return 'revoked'
  if (now.getTime() >= token.expiresAt.getTime()) return 'expired'
  return 'valid'
}
