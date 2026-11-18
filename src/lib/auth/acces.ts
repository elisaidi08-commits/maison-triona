import type { Pool } from 'pg'

import { listRequestsLogged } from '../vault/repository.ts'
import type { VaultRequestSummary } from '../vault/repository.ts'
import type { AuthCoffre } from './auth.ts'
import { INACTIVITE_MAX_S } from './config.ts'
import { evaluerSession } from './session.ts'

// Accès au coffre (story 3.2, partie C), vérifié par chaque page côté serveur.
// - anonyme : aucune session valide (absente, trop ancienne, inactive, ou sans second facteur
//   pour un compte qui a un TOTP) ; les sessions refusées sont supprimées ;
// - enrolement : compte sans TOTP, qui ne peut qu'enrôler le sien ;
// - autorise : TOTP vérifié à l'ouverture de la session.
// Aucun contenu n'est lu ici : la liste passe par listeDuCoffre, journalisée.

export interface CompteCoffre {
  id: string
  email: string
  nom: string
}

export type AccesCoffre =
  | { etat: 'anonyme' }
  | { etat: 'enrolement'; compte: CompteCoffre }
  | { etat: 'autorise'; compte: CompteCoffre }

async function revoquer(auth: AuthCoffre, jeton: string): Promise<void> {
  const contexte = await auth.$context
  await contexte.internalAdapter.deleteSession(jeton)
}

export async function lireAcces(
  auth: AuthCoffre,
  pool: Pool,
  entetes: Headers,
  maintenant: Date = new Date(),
): Promise<AccesCoffre> {
  const lue = await auth.api.getSession({ headers: entetes })
  if (!lue) return { etat: 'anonyme' }

  const etat = evaluerSession(
    {
      createdAt: new Date(lue.session.createdAt),
      updatedAt: new Date(lue.session.updatedAt),
      twoFactorVerified: lue.session.twoFactorVerified === true,
      twoFactorEnabled: lue.user.twoFactorEnabled === true,
    },
    maintenant,
  )
  if (etat === 'expiree' || etat === 'second-facteur-manquant') {
    await revoquer(auth, lue.session.token)
    return { etat: 'anonyme' }
  }

  // Dernière activité, d'où se mesure l'inactivité. La condition est répétée dans la requête :
  // deux pages servies au même instant ne prolongent pas une session déjà inactive.
  const limite = new Date(maintenant.getTime() - INACTIVITE_MAX_S * 1000)
  const { rowCount } = await pool.query(
    'UPDATE "session" SET "updatedAt" = $2 WHERE "id" = $1 AND "updatedAt" >= $3',
    [lue.session.id, maintenant, limite],
  )
  if (!rowCount) {
    await revoquer(auth, lue.session.token)
    return { etat: 'anonyme' }
  }

  const compte = { id: lue.user.id, email: lue.user.email, nom: lue.user.name }
  return etat === 'enrolement' ? { etat: 'enrolement', compte } : { etat: 'autorise', compte }
}

// Liste des demandes (colonnes en clair seulement), pour une session autorisée ; la lecture est
// journalisée au nom du compte dans la même transaction. Sinon : null, rien n'est lu.
export async function listeDuCoffre(
  auth: AuthCoffre,
  pool: Pool,
  entetes: Headers,
  maintenant: Date = new Date(),
): Promise<{ compte: CompteCoffre; demandes: VaultRequestSummary[] } | null> {
  const acces = await lireAcces(auth, pool, entetes, maintenant)
  if (acces.etat !== 'autorise') return null
  return { compte: acces.compte, demandes: await listRequestsLogged(pool, acces.compte.email) }
}
