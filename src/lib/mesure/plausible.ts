// Transmission d'un événement à Plausible par notre serveur (story 5.2). Events API lue le
// 20/11/2026 (plausible.io/docs/events-api) : `POST https://plausible.io/api/event`, corps JSON
// (`name`, `url`, `domain`, `referrer`), en-têtes `User-Agent` (obligatoire) et `X-Forwarded-For`
// (IP réelle du visiteur, sinon l'IP du serveur fait écarter l'événement comme un robot). Plausible
// ne garde pas l'IP : il la hache avec le navigateur pour compter les visiteurs uniques. Réponse
// toujours 202, même quand l'événement est écarté.
// Ni cookie, ni journal, ni erreur remontée : la mesure ne doit jamais gêner la page.
// Imports relatifs seulement : testé par node --test.
import type { EvenementPlausible } from './evenements.ts'

export interface ConfigMesure {
  /** Nom du site dans Plausible. */
  domaine: string
  /** Adresse publique du site (`SITE_URL`), pour écrire des URL complètes. */
  siteUrl: string
}

const ENDPOINT = 'https://plausible.io/api/event'
const DELAI_MS = 3000
const DOMAINE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6 = /^[0-9a-f:]{2,39}$/i
const UA_MAX = 512

// Coupée sur les aperçus Vercel (`VERCEL_ENV` autre que `production`) : une visite de test ne doit
// jamais compter dans les statistiques du site. Sur un poste local (sans `VERCEL_ENV`), elle suit
// les variables, pour la vérifier.
export function lireConfigMesure(env: Record<string, string | undefined>): ConfigMesure | null {
  const vercel = env.VERCEL_ENV?.trim()
  if (vercel && vercel !== 'production') return null
  const domaine = env.PLAUSIBLE_DOMAIN?.trim()
  const brute = env.SITE_URL?.trim()
  if (!domaine || !brute) return null
  if (!DOMAINE.test(domaine))
    throw new Error('Valeur invalide : PLAUSIBLE_DOMAIN (nom de domaine seul)')
  let site: URL
  try {
    site = new URL(brute)
  } catch {
    throw new Error('Valeur invalide : SITE_URL')
  }
  if (site.protocol !== 'https:' && site.hostname !== 'localhost') {
    throw new Error('Valeur invalide : SITE_URL (https attendu)')
  }
  return { domaine, siteUrl: site.origin }
}

/**
 * Envoi venu de notre site seulement : `Sec-Fetch-Site: same-origin`, ou `Origin` égale à celle du
 * site. Un autre site ne peut pas faire compter des événements par les navigateurs de ses visiteurs.
 */
export function envoiDuSite(entetes: Headers, siteUrl: string): boolean {
  if (entetes.get('sec-fetch-site') === 'same-origin') return true
  const origine = entetes.get('origin')
  return origine !== null && origine === new URL(siteUrl).origin
}

function ipValide(valeur: string): boolean {
  return IPV4.test(valeur) || (valeur.includes(':') && IPV6.test(valeur))
}

export function ipVisiteur(entetes: Headers): string | null {
  const premiere = entetes.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (premiere) return ipValide(premiere) ? premiere : null
  const reelle = entetes.get('x-real-ip')?.trim()
  return reelle && ipValide(reelle) ? reelle : null
}

export async function transmettre(entree: {
  evenement: EvenementPlausible
  userAgent: string | null
  ip: string | null
  fetch?: typeof fetch
}): Promise<void> {
  const { evenement, userAgent, ip } = entree
  if (!userAgent || userAgent.length > UA_MAX || ip === null) return
  const fetchImpl = entree.fetch ?? fetch
  try {
    await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify(evenement),
      signal: AbortSignal.timeout(DELAI_MS),
    })
  } catch {
    // Mesure perdue : rien d'autre à faire.
  }
}
