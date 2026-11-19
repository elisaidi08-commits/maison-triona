import type { Pool } from 'pg'

import { createBookingLink, type IssuedLink } from '../booking/bookings.ts'
import { outboxHealth } from '../outbox/health.ts'
import type { OutboxHealth } from '../outbox/health.ts'
import {
  deleteRequest,
  getRequest,
  lastRetentionRun,
  listRequestsLogged,
  logExport,
  readSealed,
  setFrozen,
} from '../vault/repository.ts'
import type { VaultRequestSummary } from '../vault/repository.ts'
import type { AuthCoffre } from './auth.ts'
import { INACTIVITE_MAX_S } from './config.ts'
import { evaluerSession } from './session.ts'

// Accès au coffre (story 3.2, partie C), vérifié par chaque page côté serveur.
// - anonyme : aucune session valide (absente, trop ancienne, inactive, ou sans second facteur
//   pour un compte qui a un TOTP) ; les sessions refusées sont supprimées ;
// - enrolement : compte sans TOTP, qui ne peut qu'enrôler le sien ;
// - autorise : TOTP vérifié à l'ouverture de la session.
// Aucun contenu n'est lu ici : la liste passe par listeDuCoffre, la lecture d'une demande (octets
// scellés) par scelleDuCoffre, l'export, le gel et l'effacement par leurs fonctions ; toutes
// journalisées au nom du compte. demandeDuCoffre ne rend que les colonnes de tri. Toutes refusées
// (rien n'est lu ni écrit) sans accès autorisé.

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

// Liste des demandes (colonnes en clair seulement), pour un accès autorisé ; la lecture est
// journalisée au nom du compte dans la même transaction. Sinon : null, rien n'est lu.
export async function listeDuCoffre(
  pool: Pool,
  acces: AccesCoffre,
): Promise<VaultRequestSummary[] | null> {
  if (acces.etat !== 'autorise') return null
  return listRequestsLogged(pool, acces.compte.email)
}

// Une demande (partie D), pour sa page : colonnes en clair seulement (les mêmes que la liste), sans
// journal. Sans accès autorisé, ou demande inconnue : null.
export async function demandeDuCoffre(
  pool: Pool,
  acces: AccesCoffre,
  id: string,
): Promise<VaultRequestSummary | null> {
  if (acces.etat !== 'autorise') return null
  return getRequest(pool, id)
}

// Lecture (partie D) : les octets scellés, remis au navigateur qui les déchiffre ; la lecture est
// journalisée (`read`) dans la même transaction. Sans accès autorisé, ou demande inconnue : null.
export async function scelleDuCoffre(
  pool: Pool,
  acces: AccesCoffre,
  id: string,
): Promise<Uint8Array | null> {
  if (acces.etat !== 'autorise') return null
  return readSealed(pool, id, acces.compte.email)
}

// Export (partie D) : le fichier se compose dans le navigateur ; ici, seulement la ligne `export`.
export async function exportDuCoffre(pool: Pool, acces: AccesCoffre, id: string): Promise<boolean> {
  if (acces.etat !== 'autorise') return false
  return logExport(pool, id, acces.compte.email)
}

// Gel ou dégel (`freeze`, `unfreeze`) : une demande gelée échappe à la conservation automatique.
export async function gelDuCoffre(
  pool: Pool,
  acces: AccesCoffre,
  id: string,
  gel: boolean,
): Promise<boolean> {
  if (acces.etat !== 'autorise') return false
  return setFrozen(pool, id, gel, acces.compte.email)
}

// Effacement à la demande (`delete`) ; la ligne du journal survit à la demande.
export async function effacementDuCoffre(
  pool: Pool,
  acces: AccesCoffre,
  id: string,
): Promise<boolean> {
  if (acces.etat !== 'autorise') return false
  return deleteRequest(pool, id, acces.compte.email)
}

// Dernier passage de la conservation planifiée (accueil du coffre), pour un accès autorisé. Une date,
// rien d'autre : sans journal.
export async function dernierPassageConservation(
  pool: Pool,
  acces: AccesCoffre,
): Promise<Date | null> {
  if (acces.etat !== 'autorise') return null
  return lastRetentionRun(pool)
}

// État de l'envoi des e-mails (accueil du coffre, story 3.3, suites C), pour un accès autorisé. Des
// comptes, rien d'autre : sans journal (aucune demande n'est ouverte ni affichée).
export async function etatEnvoiDuCoffre(
  pool: Pool,
  acces: AccesCoffre,
  maintenant: Date,
): Promise<OutboxHealth | null> {
  if (acces.etat !== 'autorise') return null
  return outboxHealth(pool, maintenant)
}

// Lien de réservation d'un appel (story 3.10, pont en attendant l'e-mail de la story 3.9) : un jeton
// neuf, 48 heures, sans cible ; `booking_link` au journal au nom du compte, sans valeur, dans la même
// transaction. Le jeton n'est rendu qu'ici, pour être affiché une fois. Sans accès autorisé : null.
export async function lienDeReservationDuCoffre(
  pool: Pool,
  acces: AccesCoffre,
  maintenant: Date = new Date(),
): Promise<IssuedLink | null> {
  if (acces.etat !== 'autorise') return null
  return createBookingLink(pool, acces.compte.email, maintenant)
}
