// Configuration du coffre lue dans l'environnement (story 3.2, partie B). L'envoi des demandes
// n'ouvre que si la base (`DATABASE_URL`) **et** la clé publique (`VAULT_PUBLIC_KEY`) sont posées ;
// sinon le formulaire garde son état « L'envoi des demandes ouvrira bientôt ». La clé privée n'est
// jamais dans l'environnement (docs/architecture.md §9.2).
// Imports relatifs seulement : testé par node --test.

/** Clé publique du coffre (base64), ou `null` tant que le coffre n'est pas configuré. */
export function vaultPublicKeyFromEnv(env: Record<string, string | undefined>): string | null {
  const database = env.DATABASE_URL?.trim()
  const publicKey = env.VAULT_PUBLIC_KEY?.trim()
  return database && publicKey ? publicKey : null
}
