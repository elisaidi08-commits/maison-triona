import { fromBase64, loadSodium, type Sodium } from './sodium.ts'

// Chiffrement des demandes (story 3.2, partie B ; docs/architecture.md §6.5). Sealed box libsodium
// (`crypto_box_seal`) : une paire de clés éphémère par demande, X25519 puis XSalsa20-Poly1305.
// Le serveur ne connaît que la clé publique : il peut sceller, jamais rouvrir. Seuls les champs
// hors des colonnes en clair sont scellés. Le texte est complété à une taille fixe de 16 Kio
// (`sodium.pad`, ISO/IEC 7816-4) : toutes les demandes scellées font 16 432 octets, la taille ne
// dit rien du message. La plus longue demande que la validation accepte (mot libre de 2 000
// caractères, chacun échappé en 6 octets au pire) tient en moins de 14 Kio ; au-delà, refus.
// Aucune erreur levée ne cite la clé ni un champ.
// Imports relatifs seulement : testé par node --test, et prêt pour le navigateur.

export const SEALED_VERSION = 1
// Texte complété (un octet de marque au moins) ; plus les 48 octets de la sealed box.
export const SEALED_PLAINTEXT_BYTES = 16 * 1024
export const SEALED_BYTES = SEALED_PLAINTEXT_BYTES + 48

/** Ce qui ne figure dans aucune colonne en clair : tout ce qui touche à la personne. */
export interface SealedFields {
  nom: string
  email: string | null
  telephone: string | null
  pourQui: string | null
  creneau: string | null
  message: string | null
}

export const SEALED_KEYS = [
  'nom',
  'email',
  'telephone',
  'pourQui',
  'creneau',
  'message',
] as const satisfies readonly (keyof SealedFields)[]

/** Clé publique absente ou invalide (configuration). Le message ne cite jamais la valeur reçue. */
export class VaultKeyError extends Error {
  constructor() {
    super('Clé publique du coffre invalide : 32 octets en base64 attendus')
    this.name = 'VaultKeyError'
  }
}

export function decodePublicKey(lib: Sodium, base64: string): Uint8Array {
  const key = fromBase64(lib, base64.trim())
  if (!key || key.length !== lib.crypto_box_PUBLICKEYBYTES) throw new VaultKeyError()
  return key
}

// JSON complété à `taille` octets puis scellé ; au-delà, refus sans citer le texte.
async function sealJson(
  payload: Record<string, unknown>,
  publicKeyBase64: string,
  taille: number,
  tropLong: string,
): Promise<Uint8Array> {
  const lib = await loadSodium()
  const publicKey = decodePublicKey(lib, publicKeyBase64)
  const texte = lib.from_string(JSON.stringify(payload))
  if (texte.length >= taille) {
    lib.memzero(texte)
    throw new RangeError(tropLong)
  }
  const clair = lib.pad(texte, taille)
  try {
    return lib.crypto_box_seal(clair, publicKey)
  } finally {
    lib.memzero(clair)
  }
}

/** Scelle les champs d'une demande pour la clé publique du coffre (base64 standard). */
export async function sealRequest(
  champs: SealedFields,
  publicKeyBase64: string,
): Promise<Uint8Array> {
  const payload: Record<string, unknown> = { v: SEALED_VERSION }
  for (const key of SEALED_KEYS) payload[key] = champs[key] ?? null
  return sealJson(
    payload,
    publicKeyBase64,
    SEALED_PLAINTEXT_BYTES,
    'Demande trop longue pour le coffre : 16 Kio au plus',
  )
}

// Réservation d'appel (story 3.10, db/migrations/0008_reservations.sql) : même sealed box, même clé
// publique, taille fixe plus petite. Restent en clair le créneau, le statut et la version de la
// politique acceptée ; tout ce qui touche à la personne est scellé ici. Le plus long contenu accepté
// par la validation (nom de 120 caractères échappés chacun en 6 octets, numéro de 30) tient en moins
// d'1 Kio : toute réservation scellée fait 2 096 octets. `t: 'appel'` distingue ce format de celui
// d'une demande : l'un ne s'ouvre jamais comme l'autre.
export const BOOKING_SEALED_VERSION = 1
export const BOOKING_SEALED_PLAINTEXT_BYTES = 2 * 1024
export const BOOKING_SEALED_BYTES = BOOKING_SEALED_PLAINTEXT_BYTES + 48
export const BOOKING_SEALED_TYPE = 'appel'

/** La personne qui convient d'un appel : nom, numéro, langue de l'appel, choix SMS, origine. */
export interface SealedBookingFields {
  nom: string
  telephone: string
  langue: 'fr' | 'en'
  /** Préférence « me prévenir aussi par SMS » (aucun envoi avant la story 3.12). */
  sms: boolean
  /** « Comment avez-vous connu la maison ? » (liste fermée de D41), facultatif. */
  origine: string | null
}

export const SEALED_BOOKING_KEYS = [
  'nom',
  'telephone',
  'langue',
  'sms',
  'origine',
] as const satisfies readonly (keyof SealedBookingFields)[]

/** Scelle la personne d'une réservation pour la clé publique du coffre (base64 standard). */
export async function sealBooking(
  champs: SealedBookingFields,
  publicKeyBase64: string,
): Promise<Uint8Array> {
  const payload: Record<string, unknown> = { v: BOOKING_SEALED_VERSION, t: BOOKING_SEALED_TYPE }
  for (const key of SEALED_BOOKING_KEYS) payload[key] = champs[key] ?? null
  return sealJson(
    payload,
    publicKeyBase64,
    BOOKING_SEALED_PLAINTEXT_BYTES,
    'Réservation trop longue pour le coffre : 2 Kio au plus',
  )
}
