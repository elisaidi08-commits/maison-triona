/**
 * Limitation de débit des envois (story 3.5, docs/architecture.md §6.7), derrière un adaptateur :
 * - si `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` existent, Upstash Redis (région UE)
 *   par son API REST, appelée côté serveur avec `fetch` (aucune dépendance npm) ;
 * - sinon, inactive : tout passe (poste local, CI, tant que le compte n'existe pas).
 * Fenêtre fixe par clé : `SET clé 0 EX fenêtre NX` puis `INCR clé`, en une transaction
 * (`/multi-exec`, format vérifié dans la documentation Upstash le 18/11/2026). Les clés ne portent
 * que des empreintes (lib/security/empreinte.ts), jamais une adresse en clair.
 * Upstash injoignable : on laisse passer (une panne ne doit pas bloquer une vraie demande) et le
 * statut le dit. Imports relatifs seulement : testé par node --test.
 */

export type Limite = {
  cle: string
  maximum: number
  fenetreSecondes: number
}

export type ResultatLimite =
  // `actif` : faux quand l'adaptateur n'est pas configuré.
  { autorise: true; actif: boolean; indisponible?: true } | { autorise: false; actif: true }

type Environnement = Record<string, string | undefined>

type Options = {
  env?: Environnement
  fetch?: typeof fetch
  delaiMs?: number
}

const PREFIXE = 'mt:debit:'

export async function limiterDebit(
  limites: readonly Limite[],
  { env = process.env, fetch: requete = fetch, delaiMs = 1500 }: Options = {},
): Promise<ResultatLimite> {
  const url = env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, '')
  const jeton = env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !jeton || limites.length === 0) return { autorise: true, actif: false }

  const commandes = limites.flatMap(({ cle, fenetreSecondes }) => [
    ['SET', PREFIXE + cle, '0', 'EX', String(fenetreSecondes), 'NX'],
    ['INCR', PREFIXE + cle],
  ])

  try {
    const reponse = await requete(`${url}/multi-exec`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commandes),
      cache: 'no-store',
      signal: AbortSignal.timeout(delaiMs),
    })
    if (!reponse.ok) return { autorise: true, actif: true, indisponible: true }
    const resultats: unknown = await reponse.json()
    if (!Array.isArray(resultats) || resultats.length !== commandes.length) {
      return { autorise: true, actif: true, indisponible: true }
    }
    const depasse = limites.some((limite, index) => {
      const compte = (resultats[index * 2 + 1] as { result?: unknown } | null)?.result
      return typeof compte === 'number' && compte > limite.maximum
    })
    return depasse ? { autorise: false, actif: true } : { autorise: true, actif: true }
  } catch {
    return { autorise: true, actif: true, indisponible: true }
  }
}
