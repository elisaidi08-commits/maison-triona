import { fromBase64, loadSodium, type Sodium } from './sodium.ts'

// Chiffrement des demandes (story 3.2, partie B ; docs/architecture.md §6.5). Sealed box libsodium
// (`crypto_box_seal`) : une paire de clés éphémère par demande, X25519 puis XSalsa20-Poly1305.
// Le serveur ne connaît que la clé publique : il peut sceller, jamais rouvrir. Seuls les champs
// hors des colonnes en clair sont scellés. Le texte est complété par blocs de 256 octets
// (`sodium.pad`) : la taille des octets ne trahit pas la longueur exacte du message.
// Aucune erreur levée ne cite la clé ni un champ.
// Imports relatifs seulement : testé par node --test, et prêt pour le navigateur.

export const SEALED_VERSION = 1
export const PAD_BLOCK = 256

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

/** Scelle les champs d'une demande pour la clé publique du coffre (base64 standard). */
export async function sealRequest(
  champs: SealedFields,
  publicKeyBase64: string,
): Promise<Uint8Array> {
  const lib = await loadSodium()
  const publicKey = decodePublicKey(lib, publicKeyBase64)
  const payload: Record<string, unknown> = { v: SEALED_VERSION }
  for (const key of SEALED_KEYS) payload[key] = champs[key] ?? null
  const clair = lib.pad(lib.from_string(JSON.stringify(payload)), PAD_BLOCK)
  try {
    return lib.crypto_box_seal(clair, publicKey)
  } finally {
    lib.memzero(clair)
  }
}
