import sodium from 'libsodium-wrappers-sumo'

// libsodium (variante « sumo », docs/architecture.md §1) : la variante standard 0.8.4 déclare
// `crypto_pwhash` dans ses types, mais ne le contient pas à l'exécution. WebAssembly, initialisé
// une seule fois. Aucune API de Node : ces modules tourneront aussi dans le navigateur (/coffre).
// Imports relatifs seulement : testé par node --test.

export type Sodium = typeof sodium

export async function loadSodium(): Promise<Sodium> {
  await sodium.ready
  return sodium
}

// Base64 standard, avec remplissage : celui de `VAULT_PUBLIC_KEY` et du paquet de clés.
export function toBase64(lib: Sodium, bytes: Uint8Array): string {
  return lib.to_base64(bytes, lib.base64_variants.ORIGINAL)
}

// Décodage strict ; `null` si le texte n'est pas du base64 standard.
export function fromBase64(lib: Sodium, text: unknown): Uint8Array | null {
  if (typeof text !== 'string' || text === '') return null
  try {
    return lib.from_base64(text, lib.base64_variants.ORIGINAL)
  } catch {
    return null
  }
}
