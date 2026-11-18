import type { PoolConfig } from 'pg'

// Configuration des pools PostgreSQL du coffre, lue depuis l'environnement. Deux connexions, deux
// comptes (docs/coffre-cles.md §3) :
// - DATABASE_URL : site public, rôle `site_public`, insertion seule (partie B) ;
// - COFFRE_DATABASE_URL : espace /coffre et scripts/coffre-compte.mjs, rôle `coffre` (partie C).
// Les messages d'erreur ne contiennent jamais l'URL de connexion (elle porte le mot de passe).
// TLS exigé sur tout déploiement Vercel (production, aperçus, branches) : la base est ailleurs.
// Délais de 5 s (connexion, requête) : une base lente ou injoignable fait échouer l'envoi vite,
// avec la saisie rendue au visiteur, plutôt qu'une fonction qui tourne jusqu'à son délai.

type Environnement = Record<string, string | undefined>

function configPour(
  connectionString: string | undefined,
  variable: string,
  env: Environnement,
  applicationName: string,
): PoolConfig {
  if (!connectionString) {
    throw new Error(`${variable} manquante`)
  }

  const ca = env.DATABASE_CA_CERT
  if (!ca && env.VERCEL_ENV) {
    throw new Error('TLS obligatoire sur Vercel : DATABASE_CA_CERT manquant')
  }

  return {
    connectionString,
    ssl: ca ? { ca, rejectUnauthorized: true } : false,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    application_name: applicationName,
  }
}

export function poolConfigFromEnv(env: Environnement): PoolConfig {
  return configPour(env.DATABASE_URL, 'DATABASE_URL', env, 'maison-triona')
}

// Connexion du coffre : jamais celle du site public. Sur un déploiement, une URL identique à
// DATABASE_URL est refusée (le coffre tournerait avec le compte du site, ou l'inverse).
export function coffrePoolConfigFromEnv(env: Environnement): PoolConfig {
  const url = env.COFFRE_DATABASE_URL
  if (url && env.VERCEL_ENV && url === env.DATABASE_URL) {
    throw new Error('COFFRE_DATABASE_URL doit différer de DATABASE_URL (deux comptes distincts)')
  }
  return configPour(url, 'COFFRE_DATABASE_URL', env, 'maison-triona-coffre')
}
