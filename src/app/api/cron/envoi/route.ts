import { runCronPass } from '@/lib/outbox/cron'
import { createOutboxDeps } from '@/lib/outbox/deps'
import { runOutbox } from '@/lib/outbox/process'

// Tâche planifiée Vercel Cron (toutes les 5 minutes, vercel.json) : reprises des envois, suivi de
// la livraison, purge de la boîte d'envoi (story 3.3).
// Segment config : `cacheComponents` est actif (next.config.ts) ; d'après la doc embarquée
// (docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md, historique
// v16.0.0), `dynamic` y est retiré : on ne l'exporte pas. Un GET qui lit la requête (en-tête
// Authorization) est dynamique, jamais prérendu (route.md, v15.0.0-RC : GET dynamique par défaut) ;
// `Cache-Control: no-store` ferme en plus tout cache en aval. `maxDuration` : maxDuration.md.
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const { status, body } = await runCronPass({
    authorization: request.headers.get('authorization'),
    env: process.env,
    createDeps: createOutboxDeps,
    run: runOutbox,
    log: (s) => console.info(`[envoi] ${s}`),
  })
  const headers = { 'Cache-Control': 'no-store' }
  if (body !== null) return Response.json(body, { status, headers })
  return new Response(null, { status, headers })
}
