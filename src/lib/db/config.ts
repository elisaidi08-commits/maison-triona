import type { PoolConfig } from 'pg'

// Configuration du pool PostgreSQL du coffre, lue depuis l'environnement.
// Les messages d'erreur ne contiennent jamais l'URL de connexion (elle porte le mot de passe).
export function poolConfigFromEnv(env: Record<string, string | undefined>): PoolConfig {
  const connectionString = env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL manquante')
  }

  const ca = env.DATABASE_CA_CERT
  if (!ca && env.VERCEL_ENV === 'production') {
    throw new Error('TLS obligatoire en production : DATABASE_CA_CERT manquant')
  }

  return {
    connectionString,
    ssl: ca ? { ca, rejectUnauthorized: true } : false,
    max: 5,
    idleTimeoutMillis: 10_000,
    application_name: 'maison-triona',
  }
}
