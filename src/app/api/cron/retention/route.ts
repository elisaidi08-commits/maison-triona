import { getCoffrePool } from '@/lib/db/pool'
import { handleRetention } from '@/lib/vault/conservation'

// Conservation planifiée du coffre (story 3.2, partie D) : appelée chaque jour par Vercel Cron
// (vercel.json), en GET, avec `Authorization: Bearer <CRON_SECRET>`. Sans le bon secret : 401, sans
// ouvrir la base. Hors du proxy (le motif de src/proxy.ts écarte /api) ; en-têtes de sécurité et
// noindex du site public (next.config.ts). Rendu à chaque appel : le gestionnaire lit l'en-tête
// de la requête avant toute autre chose (Cache Components ne prérend donc pas cette route).
// GET seulement : toute autre méthode reçoit 405 de Next.

export async function GET(request: Request): Promise<Response> {
  return handleRetention(request, { env: process.env, pool: getCoffrePool })
}
