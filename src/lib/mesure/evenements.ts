// Mesure d'audience respectueuse (story 5.2, docs/privacy.md, CLAUDE.md « Discrétion ») : pages
// vues et trois événements agrégés, transmis à Plausible par notre serveur (aucun script tiers dans
// le navigateur). Fonctions pures, testées par node --test (imports relatifs seulement).
//
// - Liste fermée d'événements, sans aucun identifiant. Le choix d'entrée est dans le NOM de
//   l'événement, pas dans une propriété : les propriétés personnalisées de Plausible demandent
//   l'offre Business (doc lue le 20/11/2026, plausible.io/docs/custom-props/introduction).
// - Chemin sans paramètres ni ancre : `/contact?service=…&s=…` est compté comme `/contact`.
// - Liste fermée des pages (`PATHNAMES`, src/i18n/pathnames.ts, dans les deux langues) : tout autre
//   chemin sous `/fr` ou `/en` est compté comme `/404` (ni chemin forgé ni faute de frappe dans les
//   statistiques).
// - Jamais compté : les liens personnels de réservation (`/<langue>/contact/appel/<jeton>…`, le
//   jeton partirait), le coffre, la démo, tout chemin hors de `/fr` et `/en`.
// - Un événement (choix, langue, partage) est rattaché à la racine de la langue (`/fr`), jamais à
//   la page : « Partage e-mail » ne dit pas quelle page de service a été partagée.
// - Référent : l'origine d'un site externe seulement (jamais le chemin ni la requête, jamais une
//   page de notre site).

export const NOMS_EVENEMENTS = {
  'entree:conciergerie': 'Entrée conciergerie',
  'entree:grand-age': 'Entrée grand âge',
  'entree:enfants': 'Entrée enfants',
  'entree:indecis': 'Entrée demande particulière',
  'langue:fr': 'Langue fr',
  'langue:en': 'Langue en',
  'partage:email': 'Partage e-mail',
  'partage:lien': 'Partage lien',
} as const

import { LOCALES, PATHNAMES, localizedPath, type InternalPath } from '../../i18n/pathnames.ts'

export type CodeEvenement = keyof typeof NOMS_EVENEMENTS
export type Evenement = 'pageview' | CodeEvenement

export interface EvenementPlausible {
  name: string
  url: string
  domain: string
  referrer?: string
}

const LANGUE = /^\/(fr|en)(\/|$)/
const LIEN_PERSONNEL = /^\/(fr|en)\/contact\/appel\/./
const EXCLUS = [/^\/(fr|en)\/demo(\/|$)/]
const LONGUEUR_MAX = 200
const PAGE_INCONNUE = '/404'

// Pages publiques mesurables, dans les deux langues (la démo exclue).
const PAGES = new Set(
  (Object.keys(PATHNAMES) as InternalPath[])
    .filter((page) => page !== '/demo')
    .flatMap((page) => LOCALES.map((langue) => localizedPath(page, langue))),
)

export function estEvenement(valeur: unknown): valeur is Evenement {
  return (
    valeur === 'pageview' || (typeof valeur === 'string' && Object.hasOwn(NOMS_EVENEMENTS, valeur))
  )
}

export function cheminMesurable(brut: string): string | null {
  if (typeof brut !== 'string' || !brut.startsWith('/')) return null
  const chemin = brut.split(/[?#]/, 1)[0]!
  if (chemin.length > LONGUEUR_MAX) return null
  if (PAGES.has(chemin)) return chemin
  if (LIEN_PERSONNEL.test(chemin)) return null
  if (EXCLUS.some((motif) => motif.test(chemin))) return null
  return LANGUE.test(chemin) ? PAGE_INCONNUE : null
}

export function referentExterne(brut: string | null | undefined, siteUrl: string): string | null {
  if (!brut) return null
  let referent: URL
  let site: URL
  try {
    referent = new URL(brut)
    site = new URL(siteUrl)
  } catch {
    return null
  }
  if (referent.protocol !== 'https:' && referent.protocol !== 'http:') return null
  if (referent.hostname === site.hostname) return null
  return referent.origin
}

function racineLangue(chemin: string): string | null {
  const langue = LANGUE.exec(chemin)?.[1]
  return langue ? `/${langue}` : null
}

export function construireEvenement(entree: {
  evenement: string
  chemin: string
  referent: string | null
  siteUrl: string
  domaine: string
}): EvenementPlausible | null {
  const { evenement, siteUrl, domaine } = entree
  if (!estEvenement(evenement)) return null
  const chemin = cheminMesurable(entree.chemin)
  if (chemin === null) return null
  const page = evenement === 'pageview' ? chemin : racineLangue(entree.chemin)
  if (page === null) return null
  const nom = evenement === 'pageview' ? 'pageview' : NOMS_EVENEMENTS[evenement]
  const resultat: EvenementPlausible = {
    name: nom,
    url: new URL(page, siteUrl).toString(),
    domain: domaine,
  }
  // Le référent n'a de sens que pour l'arrivée sur le site (page vue).
  const referent = evenement === 'pageview' ? referentExterne(entree.referent, siteUrl) : null
  if (referent !== null) resultat.referrer = referent
  return resultat
}
