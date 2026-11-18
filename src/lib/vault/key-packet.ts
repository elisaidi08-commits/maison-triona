import { fromBase64, loadSodium, toBase64, type Sodium } from './sodium.ts'

// Paquet de la clé privée du coffre (story 3.2, partie B ; docs/coffre-cles.md). La clé privée
// n'existe jamais en clair hors de la mémoire : elle est chiffrée par `crypto_secretbox`
// (XSalsa20-Poly1305) avec une clé tirée de la phrase de passe par Argon2id (`crypto_pwhash`).
// Le paquet est un JSON sans secret lisible : version, paramètres et sel d'Argon2id, nonce, chiffré,
// clé publique (pour vérifier l'ouverture et la comparer à `VAULT_PUBLIC_KEY`).
// La phrase est normalisée en NFC : un « é » saisi au clavier du Mac ou dans un navigateur donne
// la même clé.
// Imports relatifs seulement : testé par node --test, et prêt pour le navigateur.

export const KEY_PACKET_VERSION = 1
export const PASSPHRASE_MIN_LENGTH = 16
const ALGORITHM = 'argon2id13'
// Plafonds d'ouverture : au-delà, un paquet bloquerait le navigateur (mémoire, durée).
const OPSLIMIT_CEILING = 10

export interface KeyPacket {
  version: typeof KEY_PACKET_VERSION
  kdf: { algorithm: typeof ALGORITHM; opslimit: number; memlimit: number; salt: string }
  nonce: string
  ciphertext: string
  publicKey: string
}

/** Paramètres d'Argon2id du paquet : « moderate » de libsodium (3 passes, 256 Mio). */
export function kdfParameters(lib: Sodium): { opslimit: number; memlimit: number } {
  return {
    opslimit: lib.crypto_pwhash_OPSLIMIT_MODERATE,
    memlimit: lib.crypto_pwhash_MEMLIMIT_MODERATE,
  }
}

export function deriveKey(
  lib: Sodium,
  passphrase: string,
  salt: Uint8Array,
  kdf: { opslimit: number; memlimit: number },
): Uint8Array {
  return lib.crypto_pwhash(
    lib.crypto_secretbox_KEYBYTES,
    passphrase.normalize('NFC'),
    salt,
    kdf.opslimit,
    kdf.memlimit,
    lib.crypto_pwhash_ALG_ARGON2ID13,
  )
}

/** Refuse une phrase de passe trop courte (comptée en caractères, après normalisation NFC). */
export function assertPassphrase(passphrase: string): void {
  if ([...passphrase.normalize('NFC')].length < PASSPHRASE_MIN_LENGTH) {
    throw new RangeError(
      `Phrase de passe trop courte : ${PASSPHRASE_MIN_LENGTH} caractères au moins`,
    )
  }
}

/** Chiffre une clé privée avec une phrase de passe : un paquet, avec son propre sel et nonce. */
export function lockPrivateKey(
  lib: Sodium,
  publicKey: Uint8Array,
  privateKey: Uint8Array,
  passphrase: string,
): KeyPacket {
  assertPassphrase(passphrase)
  const kdf = kdfParameters(lib)
  const salt = lib.randombytes_buf(lib.crypto_pwhash_SALTBYTES)
  const nonce = lib.randombytes_buf(lib.crypto_secretbox_NONCEBYTES)
  const key = deriveKey(lib, passphrase, salt, kdf)
  try {
    return {
      version: KEY_PACKET_VERSION,
      kdf: { algorithm: ALGORITHM, ...kdf, salt: toBase64(lib, salt) },
      nonce: toBase64(lib, nonce),
      ciphertext: toBase64(lib, lib.crypto_secretbox_easy(privateKey, nonce, key)),
      publicKey: toBase64(lib, publicKey),
    }
  } finally {
    lib.memzero(key)
  }
}

/**
 * Génère la paire de clés du coffre et chiffre la clé privée avec la phrase de passe.
 * Renvoie le paquet (à garder hors ligne) et la clé publique en base64 (`VAULT_PUBLIC_KEY`).
 * Un second paquet de la même paire, pour une autre personne : `addPassphrase` (open.ts).
 */
export async function createKeyPacket(
  passphrase: string,
): Promise<{ packet: KeyPacket; publicKey: string }> {
  assertPassphrase(passphrase)
  const lib = await loadSodium()
  const { publicKey, privateKey } = lib.crypto_box_keypair()
  try {
    const packet = lockPrivateKey(lib, publicKey, privateKey, passphrase)
    return { packet, publicKey: packet.publicKey }
  } finally {
    lib.memzero(privateKey)
  }
}

export interface DecodedKeyPacket {
  kdf: { opslimit: number; memlimit: number }
  salt: Uint8Array
  nonce: Uint8Array
  ciphertext: Uint8Array
  publicKey: Uint8Array
}

/**
 * Lit un paquet (objet issu du JSON) ; `null` s'il est mal formé, d'une autre version, ou si ses
 * paramètres sont plus faibles que « moderate » (ou déraisonnables).
 */
export function decodeKeyPacket(lib: Sodium, value: unknown): DecodedKeyPacket | null {
  if (typeof value !== 'object' || value === null) return null
  const packet = value as Record<string, unknown>
  const kdf = packet.kdf as Record<string, unknown> | null | undefined
  if (packet.version !== KEY_PACKET_VERSION || typeof kdf !== 'object' || kdf === null) return null
  if (kdf.algorithm !== ALGORITHM) return null

  const { opslimit, memlimit } = kdf
  const minimum = kdfParameters(lib)
  if (
    !Number.isInteger(opslimit) ||
    !Number.isInteger(memlimit) ||
    (opslimit as number) < minimum.opslimit ||
    (opslimit as number) > OPSLIMIT_CEILING ||
    (memlimit as number) < minimum.memlimit ||
    (memlimit as number) > lib.crypto_pwhash_MEMLIMIT_SENSITIVE
  ) {
    return null
  }

  const salt = fromBase64(lib, kdf.salt)
  const nonce = fromBase64(lib, packet.nonce)
  const ciphertext = fromBase64(lib, packet.ciphertext)
  const publicKey = fromBase64(lib, packet.publicKey)
  if (
    salt?.length !== lib.crypto_pwhash_SALTBYTES ||
    nonce?.length !== lib.crypto_secretbox_NONCEBYTES ||
    ciphertext?.length !== lib.crypto_box_SECRETKEYBYTES + lib.crypto_secretbox_MACBYTES ||
    publicKey?.length !== lib.crypto_box_PUBLICKEYBYTES
  ) {
    return null
  }
  return {
    kdf: { opslimit: opslimit as number, memlimit: memlimit as number },
    salt,
    nonce,
    ciphertext,
    publicKey,
  }
}
