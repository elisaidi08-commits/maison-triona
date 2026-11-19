// Redirection de l'adresse vercel.app vers le domaine (next.config.ts, `redirects()`). Le jour de
// l'ouverture, l'adresse vercel.app redirige vers le domaine (308) : sinon elle serait indexable en
// double (audit du 06/11/2026, §3.1 n° 7). Inactive d'ici là, jamais sur un aperçu, et jamais vers
// une adresse vercel.app (boucle) : siteUrl() refuse alors le build.
// Imports relatifs seulement : testé par node --test.

// Tout sauf les tâches planifiées : Vercel Cron appelle `/api/cron/retention` et `/api/cron/envoi`
// sur l'adresse du déploiement et ne suit aucune redirection ; une 308 ferait échouer chaque
// passage sans bruit. Les deux routes restent protégées par `CRON_SECRET`
// (src/lib/security/cron.ts), quelle que soit l'adresse.
export const HORS_TACHES_PLANIFIEES = '/:path((?!api/cron/).*)'

export interface RedirectionHote {
  source: string
  has: { type: 'host'; value: string }[]
  destination: string
  permanent: boolean
}

export function redirectionsVercelApp(options: {
  ouvert: boolean
  siteUrl: string | undefined
}): RedirectionHote[] {
  const site = options.siteUrl?.trim().replace(/\/+$/, '')
  if (!options.ouvert || !site || new URL(site).hostname.endsWith('.vercel.app')) return []
  return [
    {
      source: HORS_TACHES_PLANIFIEES,
      has: [{ type: 'host', value: '.*\\.vercel\\.app' }],
      destination: `${site}/:path`,
      permanent: true,
    },
  ]
}
