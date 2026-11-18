import { getSessionCookie } from 'better-auth/cookies'
import { headers } from 'next/headers'

import { getCoffrePool } from '../db/pool.ts'
import { lireAcces } from './acces.ts'
import type { AccesCoffre } from './acces.ts'
import { creerAuth } from './auth.ts'
import type { AuthCoffre } from './auth.ts'

// Côté Next seulement (pages, Server Actions et gestionnaire du coffre). Instance créée à la
// première requête, jamais au build : sans BETTER_AUTH_SECRET sur un déploiement, seul le coffre
// échoue, le site public reste servi.

const globalForAuth = globalThis as unknown as { __maisonTrionaAuth?: AuthCoffre }

export function getAuth(): AuthCoffre {
  globalForAuth.__maisonTrionaAuth ??= creerAuth(getCoffrePool())
  return globalForAuth.__maisonTrionaAuth
}

// Accès de la requête en cours. Sans cookie de session, inutile d'interroger la base : la page de
// connexion s'affiche sans requête SQL.
export async function lireAccesRequete(): Promise<AccesCoffre> {
  const entetes = await headers()
  if (!getSessionCookie(entetes, { cookiePrefix: 'coffre' })) return { etat: 'anonyme' }
  return lireAcces(getAuth(), getCoffrePool(), entetes)
}

export async function defiEnCours(): Promise<boolean> {
  return Boolean(
    getSessionCookie(await headers(), { cookiePrefix: 'coffre', cookieName: 'two_factor' }),
  )
}
