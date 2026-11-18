/**
 * Limitation de débit des envois et usage unique de l'horodatage (story 3.5, docs/architecture.md
 * §6.7), derrière un adaptateur :
 * - si `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` existent, Upstash Redis (région UE)
 *   par son API REST, appelée côté serveur avec `fetch` (aucune dépendance npm) ;
 * - sinon, inactive : tout passe. Sur un déploiement Vercel, l'absence est signalée
 *   (`configManquante`) pour que l'action la journalise ; sur un poste ou en CI, elle est normale.
 * Commandes en une transaction (`/multi-exec`, format vérifié dans la documentation Upstash le
 * 18/11/2026) :
 * - fenêtre fixe par clé : `SET clé 0 EX fenêtre NX` puis `INCR clé` ;
 * - usage unique : `SET clé 1 EX durée NX` (déjà posée : jeton rejoué).
 * Issues : seule une panne réseau (Upstash injoignable, délai dépassé) laisse passer sans rien dire
 * d'autre ; 401 ou 403 (identifiants refusés) laisse passer en signalant la configuration ; toute
 * autre réponse inattendue refuse. Les clés ne portent que des empreintes, jamais une adresse en
 * clair. Imports relatifs seulement : testé par node --test.
 */

export type Limite = {
  cle: string
  maximum: number
  fenetreSecondes: number
  // Plafond d'alerte : son dépassement est signalé, jamais bloquant (plafond global du jour).
  alerte?: boolean
}

// Issues communes : adaptateur non configuré, panne réseau, identifiants refusés, réponse
// inattendue.
type Commun =
  | { statut: 'inactif'; configManquante: boolean }
  | { statut: 'reseau' }
  | { statut: 'config' }
  | { statut: 'reponse' }

export type ResultatLimite =
  Commun | { statut: 'autorise'; alertes: string[] } | { statut: 'refuse' }

export type ResultatUnique = Commun | { statut: 'nouveau' } | { statut: 'deja-vu' }

type Environnement = Record<string, string | undefined>

export type Options = {
  env?: Environnement
  fetch?: typeof fetch
  delaiMs?: number
}

const PREFIXE = 'mt:'

type Execution = Commun | { statut: 'ok'; resultats: unknown[] }

async function executer(
  commandes: string[][],
  { env = process.env, fetch: requete = fetch, delaiMs = 1500 }: Options,
): Promise<Execution> {
  const url = env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, '')
  const jeton = env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !jeton) return { statut: 'inactif', configManquante: Boolean(env.VERCEL_ENV) }

  let reponse: Response
  try {
    reponse = await requete(`${url}/multi-exec`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commandes),
      cache: 'no-store',
      signal: AbortSignal.timeout(delaiMs),
    })
  } catch {
    return { statut: 'reseau' }
  }
  if (reponse.status === 401 || reponse.status === 403) return { statut: 'config' }
  if (!reponse.ok) return { statut: 'reponse' }
  try {
    const resultats: unknown = await reponse.json()
    if (!Array.isArray(resultats) || resultats.length !== commandes.length) {
      return { statut: 'reponse' }
    }
    return { statut: 'ok', resultats }
  } catch {
    return { statut: 'reponse' }
  }
}

function resultat(element: unknown): unknown {
  return element !== null && typeof element === 'object' && 'result' in element
    ? element.result
    : undefined
}

export async function limiterDebit(
  limites: readonly Limite[],
  options: Options = {},
): Promise<ResultatLimite> {
  if (limites.length === 0) return { statut: 'autorise', alertes: [] }
  const execution = await executer(
    limites.flatMap(({ cle, fenetreSecondes }) => [
      ['SET', `${PREFIXE}debit:${cle}`, '0', 'EX', String(fenetreSecondes), 'NX'],
      ['INCR', `${PREFIXE}debit:${cle}`],
    ]),
    options,
  )
  if (execution.statut !== 'ok') return execution

  const comptes = limites.map((_, index) => resultat(execution.resultats[index * 2 + 1]))
  if (comptes.some((compte) => typeof compte !== 'number')) return { statut: 'reponse' }
  const depassees = limites.filter((limite, index) => (comptes[index] as number) > limite.maximum)
  if (depassees.some((limite) => !limite.alerte)) return { statut: 'refuse' }
  return { statut: 'autorise', alertes: depassees.map((limite) => limite.cle) }
}

/** Pose une clé une seule fois : `nouveau` la première, `deja-vu` ensuite (jeton rejoué). */
export async function usageUnique(
  cle: string,
  dureeSecondes: number,
  options: Options = {},
): Promise<ResultatUnique> {
  const execution = await executer(
    [['SET', `${PREFIXE}unique:${cle}`, '1', 'EX', String(dureeSecondes), 'NX']],
    options,
  )
  if (execution.statut !== 'ok') return execution
  const pose = resultat(execution.resultats[0])
  if (pose === 'OK') return { statut: 'nouveau' }
  if (pose === null) return { statut: 'deja-vu' }
  return { statut: 'reponse' }
}
