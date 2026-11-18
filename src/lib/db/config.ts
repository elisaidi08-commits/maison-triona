import type { PoolConfig } from 'pg'

// Configuration du pool PostgreSQL du coffre, lue depuis l'environnement.
// Les messages d'erreur ne contiennent jamais l'URL de connexion (elle porte le mot de passe).
// TLS exigé sur tout déploiement Vercel (production, aperçus, branches) : la base est ailleurs.
// Délais de 5 s (connexion, requête) : une base lente ou injoignable fait échouer l'envoi vite,
// avec la saisie rendue au visiteur, plutôt qu'une fonction qui tourne jusqu'à son délai.
export function poolConfigFromEnv(env: Record<string, string | undefined>): PoolConfig {
  const connectionString = env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL manquante')
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
    application_name: 'maison-triona',
  }
}
