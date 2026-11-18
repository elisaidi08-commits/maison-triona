import {
  assertPassphrase,
  decodeKeyPacket,
  deriveKey,
  lockPrivateKey,
  type KeyPacket,
} from './key-packet.ts'
import {
  SEALED_BYTES,
  SEALED_KEYS,
  SEALED_PLAINTEXT_BYTES,
  SEALED_VERSION,
  type SealedFields,
} from './seal.ts'
import { loadSodium } from './sodium.ts'

// Ouverture des demandes (story 3.2, partie B). Écrit pour le navigateur de l'administratrice ou
// de l'administrateur (futur /coffre, partie C) : libsodium seulement, aucune API de Node. La clé
// privée ne quitte jamais la mémoire de la page ; le serveur n'en a aucune copie.
// Les erreurs sont génériques : ni contenu, ni octets, ni cause chaînée.
// Imports relatifs seulement : testé par node --test.

export interface VaultKeys {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

export class VaultOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultOpenError'
  }
}

/**
 * Déchiffre la clé privée du paquet avec la phrase de passe (Argon2id, puis `crypto_secretbox`),
 * et vérifie qu'elle correspond bien à la clé publique du paquet.
 */
export async function unlockPrivateKey(paquet: unknown, phraseDePasse: string): Promise<VaultKeys> {
  const lib = await loadSodium()
  const decoded = decodeKeyPacket(lib, paquet)
  if (!decoded) throw new VaultOpenError('Paquet de clé illisible ou trop faible')

  const key = deriveKey(lib, phraseDePasse, decoded.salt, decoded.kdf)
  let privateKey: Uint8Array
  try {
    privateKey = lib.crypto_secretbox_open_easy(decoded.ciphertext, decoded.nonce, key)
  } catch {
    throw new VaultOpenError('Phrase de passe incorrecte ou paquet altéré')
  } finally {
    lib.memzero(key)
  }

  const derived = lib.crypto_scalarmult_base(privateKey)
  if (!lib.memcmp(derived, decoded.publicKey)) {
    lib.memzero(privateKey)
    throw new VaultOpenError('La clé privée ne correspond pas à la clé publique du paquet')
  }
  return { publicKey: decoded.publicKey, privateKey }
}

/**
 * Paquet d'une seconde personne pour la même paire de clés (docs/coffre-cles.md) : le paquet
 * existant est ouvert avec sa phrase, puis la clé privée est chiffrée avec la nouvelle phrase
 * (nouveau sel, nouveau nonce). Chacun garde son paquet et sa phrase ; aucune n'est partagée.
 */
export async function addPassphrase(
  paquet: unknown,
  phraseActuelle: string,
  nouvellePhrase: string,
): Promise<KeyPacket> {
  assertPassphrase(nouvellePhrase)
  if (nouvellePhrase.normalize('NFC') === phraseActuelle.normalize('NFC')) {
    throw new RangeError('La nouvelle phrase de passe doit différer de la phrase actuelle')
  }
  const lib = await loadSodium()
  const cles = await unlockPrivateKey(paquet, phraseActuelle)
  try {
    return lockPrivateKey(lib, cles.publicKey, cles.privateKey, nouvellePhrase)
  } finally {
    lib.memzero(cles.privateKey)
  }
}

function isSealedFields(value: unknown): value is SealedFields & { v: number } {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record.v !== SEALED_VERSION || typeof record.nom !== 'string') return false
  return SEALED_KEYS.every((key) => record[key] === null || typeof record[key] === 'string')
}

/** Rouvre les octets scellés d'une demande. Échoue sur une autre clé ou des octets altérés. */
export async function openSealed(octets: Uint8Array, cles: VaultKeys): Promise<SealedFields> {
  const lib = await loadSodium()
  if (octets.length !== SEALED_BYTES)
    throw new VaultOpenError('Demande illisible : taille inconnue')
  let clair: Uint8Array
  try {
    clair = lib.crypto_box_seal_open(octets, cles.publicKey, cles.privateKey)
  } catch {
    throw new VaultOpenError('Demande illisible : autre clé ou octets altérés')
  }

  let payload: unknown
  try {
    payload = JSON.parse(lib.to_string(lib.unpad(clair, SEALED_PLAINTEXT_BYTES)))
  } catch {
    payload = null
  } finally {
    lib.memzero(clair)
  }
  if (!isSealedFields(payload)) throw new VaultOpenError('Demande illisible : format inconnu')

  const champs = {} as SealedFields
  for (const key of SEALED_KEYS) (champs as unknown as Record<string, unknown>)[key] = payload[key]
  return champs
}
