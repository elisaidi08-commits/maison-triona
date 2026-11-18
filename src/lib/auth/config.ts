// Paramètres de l'authentification du coffre (story 3.2, partie C ; D67), lus depuis
// l'environnement. Fonctions pures, testées par node --test : ni Next ni base de données ici.
// Imports relatifs avec extension : ce module est aussi chargé par node (tests, scripts/).

type Environnement = Record<string, string | undefined>

// Espace du coffre, hors du site public. Le gestionnaire Better Auth est monté dessous : le chemin
// des cookies (/coffre) couvre ainsi les pages et les routes d'authentification, rien d'autre.
export const CHEMIN_COFFRE = '/coffre'
export const BASE_PATH_AUTH = `${CHEMIN_COFFRE}/api/auth`

// Sessions courtes (docs/architecture.md §6.5). Repère : OWASP ASVS 4.0.3, V3.3.2, niveau 3
// (nouvelle authentification au plus tard après 12 heures, ou 15 minutes d'inactivité). La durée
// maximale est ramenée à une journée de travail ; l'inactivité suit le niveau 3, le coffre
// affichera des demandes qui peuvent révéler une situation de santé.
export const DUREE_MAX_SESSION_S = 8 * 60 * 60
export const INACTIVITE_MAX_S = 15 * 60
// Délai pour saisir le code TOTP après le mot de passe (10 minutes par défaut chez Better Auth).
export const DELAI_SECOND_FACTEUR_S = 5 * 60

// Deux comptes nominatifs, créés à la main (scripts/coffre-compte.mjs) : Cat et Sady.
export const MAX_COMPTES = 2

// Mots de passe : 12 caractères au moins (phrase de passe encouragée), 128 au plus (défaut de
// Better Auth, borne le coût du hachage).
export const MOT_DE_PASSE_MIN = 12
export const MOT_DE_PASSE_MAX = 128

const LONGUEUR_MIN_SECRET = 32
// Repli du poste local et de la CI seulement (VERCEL_ENV absent) : refusé sur tout déploiement.
// Il est fixe, car Better Auth chiffre les secrets TOTP avec lui : un secret tiré au hasard à chaque
// démarrage rendrait illisibles les TOTP déjà enrôlés en local.
const REPLI_DEVELOPPEMENT = 'coffre-repli-local-jamais-deploye-7Qm2vX9pLr4tKw8sNc3hBz6dFy1gJe5a'

export interface ParametresAuth {
  secret: string
  baseURL: string
  cookiesSecurises: boolean
}

export function estPosteLocal(env: Environnement): boolean {
  return !env.VERCEL_ENV
}

// `BETTER_AUTH_SECRET` : obligatoire hors poste local (32 caractères au moins). Il signe les cookies
// et chiffre les secrets TOTP et les codes de secours : le changer les rend illisibles (prévoir la
// rotation `BETTER_AUTH_SECRETS` de Better Auth avant tout changement). Message sans la valeur.
export function secretAuth(env: Environnement): string {
  const secret = env.BETTER_AUTH_SECRET?.trim()
  if (secret && secret.length >= LONGUEUR_MIN_SECRET) return secret
  if (!estPosteLocal(env)) {
    throw new Error(
      'BETTER_AUTH_SECRET manquant ou trop court (32 caractères au moins) : obligatoire hors poste local',
    )
  }
  return REPLI_DEVELOPPEMENT
}

// Origine publique du coffre : BETTER_AUTH_URL, sinon SITE_URL, sinon l'adresse de l'aperçu
// Vercel ; localhost:3000 sur le poste local. Seule l'origine compte (le chemin est BASE_PATH_AUTH).
export function urlAuth(env: Environnement): string {
  const brute = (env.BETTER_AUTH_URL || env.SITE_URL)?.trim()
  if (brute) return new URL(brute).origin
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) return `https://${env.VERCEL_URL}`
  if (!estPosteLocal(env)) {
    throw new Error('BETTER_AUTH_URL ou SITE_URL manquante : obligatoire hors poste local')
  }
  return 'http://localhost:3000'
}

export function parametresAuth(env: Environnement = process.env): ParametresAuth {
  const baseURL = urlAuth(env)
  return {
    secret: secretAuth(env),
    baseURL,
    // `Secure` dès que le coffre est servi en https (tout déploiement) ; pas en local (http).
    cookiesSecurises: baseURL.startsWith('https://'),
  }
}

// Règle des deux comptes, appliquée par le script de création (la base la double d'un déclencheur).
export function peutCreerCompte(nombreDeComptes: number): boolean {
  return Number.isInteger(nombreDeComptes) && nombreDeComptes >= 0 && nombreDeComptes < MAX_COMPTES
}
