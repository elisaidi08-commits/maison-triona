import type { Pool } from 'pg'

import { purgerAuth } from '../auth/purge.ts'
import { withTransaction } from '../db/transaction.ts'
import { autorisationCron } from '../security/cron.ts'
import { logRetention, purgeExpired, VaultError, type RetentionCounts } from './repository.ts'

// Conservation planifiée du coffre (story 3.2, partie D ; docs/architecture.md §6.5), appelée chaque
// jour par Vercel Cron (vercel.json → GET /api/cron/retention), avec le compte du coffre :
// 1. efface les demandes échues non gelées (une ligne `purge` chacune, au nom de `system`) ;
// 2. purge les sessions échues ou inactives, les compteurs de limitation de débit périmés et les
//    défis du second facteur expirés (purgerAuth) ;
// 3. inscrit au journal un résumé en nombres seulement (`retention`).
// Le tout dans une transaction, sous verrou consultatif : Vercel peut livrer deux fois le même
// passage ; le second attend le premier, ne trouve plus rien et inscrit un résumé à zéro. Une
// passe manquée se rattrape le lendemain (tout ce qui est échu depuis est effacé).
// La plage de conservation (RETENTION_MONTHS, D05) reste [À VALIDER] : elle fixe l'échéance de
// chaque demande à son enregistrement, cette tâche ne fait qu'appliquer les échéances posées.
// Imports relatifs seulement : testé par node --test.

const VERROU = "SELECT pg_advisory_xact_lock(hashtext('maison-triona:conservation'))"
const SANS_CACHE = { 'Cache-Control': 'no-store' }

export async function runRetention(pool: Pool, now: Date): Promise<RetentionCounts> {
  if (Number.isNaN(now.getTime())) throw new RangeError('Date de conservation invalide')
  try {
    return await withTransaction(pool, async (client) => {
      await client.query(VERROU)
      const requests = (await purgeExpired(client, now)).length
      const auth = await purgerAuth(client, now)
      const counts: RetentionCounts = {
        requests,
        sessions: auth.sessions,
        rateLimits: auth.limites,
        verifications: auth.verifications,
      }
      await logRetention(client, counts)
      return counts
    })
  } catch (error) {
    // Erreur de PostgreSQL brute (verrou, purge de l'authentification) : son code seulement.
    if (error instanceof VaultError) throw error
    throw new VaultError('runRetention', error)
  }
}

export interface RetentionRoute {
  env: Record<string, string | undefined>
  // Ouverte seulement après la vérification du secret : un appel refusé ne touche pas la base.
  pool: () => Pool
  now?: () => Date
}

// Gestionnaire de la route : 401 sans le bon secret (rien n'est lu ni écrit), 200 et le résumé en
// nombres, ou 500 sans détail. Le journal du serveur ne reçoit qu'un statut et un code SQL.
export async function handleRetention(
  request: Request,
  { env, pool, now = () => new Date() }: RetentionRoute,
): Promise<Response> {
  if (!autorisationCron(request.headers.get('authorization'), env)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { ...SANS_CACHE, 'WWW-Authenticate': 'Bearer' },
    })
  }
  try {
    const counts = await runRetention(pool(), now())
    return Response.json(counts, { headers: SANS_CACHE })
  } catch (error) {
    const code = error instanceof VaultError && error.code ? `:${error.code}` : ''
    console.error(`[conservation] failed:retention${code}`)
    return new Response('Internal Server Error', { status: 500, headers: SANS_CACHE })
  }
}
