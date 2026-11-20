import type { Pool } from 'pg'

import { purgerAuth } from '../auth/purge.ts'
import { purgeBookings, purgeCancelledContents, purgeTokens } from '../booking/bookings.ts'
import { withTransaction } from '../db/transaction.ts'
import { autorisationCron, secretCron } from '../security/cron.ts'
import { logRetention, purgeExpired, VaultError, type RetentionCounts } from './repository.ts'

// Conservation planifiée du coffre (story 3.2, partie D ; docs/architecture.md §6.5), appelée chaque
// jour par Vercel Cron (vercel.json → GET /api/cron/retention), avec le compte du coffre :
// 1. efface les demandes échues non gelées (une ligne `purge` chacune, au nom de `system`) ;
// 2. purge les sessions échues ou inactives, les compteurs de limitation de débit périmés et les
//    défis du second facteur expirés (purgerAuth) ;
// 3. efface les réservations d'appel échues et les jetons de lien expirés depuis plus de 48 heures
//    (story 3.10, src/lib/booking/bookings.ts), et le contenu scellé des appels annulés dont le
//    créneau d'origine est fini (D78, story 3.11 ; le créneau et le statut restent) ;
// 4. inscrit au journal un résumé en nombres seulement (`retention`).
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
      // Réservations d'abord : un jeton n'est plus retenu par une réservation effacée.
      const bookings = await purgeBookings(client, now)
      const tokens = await purgeTokens(client, now)
      const cancelledCalls = await purgeCancelledContents(client, now)
      const counts: RetentionCounts = {
        requests,
        sessions: auth.sessions,
        rateLimits: auth.limites,
        verifications: auth.verifications,
        bookings,
        tokens,
        cancelledCalls,
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
// nombres, ou 500 sans détail. Le journal du serveur ne reçoit qu'un statut et un code SQL ; un
// secret absent (ou mal formé) y laisse une ligne fixe, `refused:no-secret`, pour qu'une tâche qui
// ne fait plus rien se voie dans les journaux de Vercel.
export async function handleRetention(
  request: Request,
  { env, pool, now = () => new Date() }: RetentionRoute,
): Promise<Response> {
  const entete = request.headers.get('authorization')
  if (!secretCron(env)) console.error('[conservation] refused:no-secret')
  if (!autorisationCron(entete, env)) {
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
