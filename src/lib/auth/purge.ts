import type { Pool } from 'pg'

import { FENETRE_FREIN_S, INACTIVITE_MAX_S } from './config.ts'

// Purge des données échues de l'authentification (story 3.2 C), à appeler par une tâche planifiée
// (route cron de la partie D) avec le compte du coffre. Better Auth n'efface ces lignes qu'au fil
// des requêtes, et pas toutes :
// - compteurs de débit (« IP|chemin ») dont la fenêtre est passée : la plus longue fait 15 minutes ;
// - défis du second facteur et autres valeurs de vérification expirés ;
// - sessions échues (8 heures) ou inactives depuis plus de 15 minutes.

export interface PurgeAuth {
  limites: number
  verifications: number
  sessions: number
}

export async function purgerAuth(pool: Pool, maintenant: Date = new Date()): Promise<PurgeAuth> {
  if (Number.isNaN(maintenant.getTime())) throw new RangeError('Date de purge invalide')
  const instant = maintenant.getTime()
  const limites = await pool.query('DELETE FROM "rateLimit" WHERE "lastRequest" < $1', [
    instant - FENETRE_FREIN_S * 1000,
  ])
  const verifications = await pool.query('DELETE FROM "verification" WHERE "expiresAt" < $1', [
    maintenant,
  ])
  const sessions = await pool.query(
    'DELETE FROM "session" WHERE "expiresAt" < $1 OR "updatedAt" < $2',
    [maintenant, new Date(instant - INACTIVITE_MAX_S * 1000)],
  )
  return {
    limites: limites.rowCount ?? 0,
    verifications: verifications.rowCount ?? 0,
    sessions: sessions.rowCount ?? 0,
  }
}
