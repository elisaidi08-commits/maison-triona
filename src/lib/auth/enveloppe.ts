import type { Pool } from 'pg'

import { logRateLimitedOnce } from '../vault/repository.ts'
import { CHEMINS_AUTORISES } from './auth.ts'
import type { AuthCoffre } from './auth.ts'
import { BASE_PATH_AUTH, FENETRE_FREIN_S } from './config.ts'

// Enveloppe commune au gestionnaire HTTP (src/app/coffre/api/auth/[...all]/route.ts) et aux appels
// des Server Actions (src/lib/auth/appel.ts), devant `auth.handler` :
// - toute requête hors de la liste fermée (méthode ou route) répond 404 avant Better Auth : ni
//   compteur de débit, ni IP, ni ligne écrite ;
// - une réponse 429 (limite par IP, verrou par compte, disjoncteur, verrouillage du TOTP) est
//   journalisée `rate_limited`, une fois au plus par route et par 15 minutes, au nom de la route.

export function acteurLimitation(chemin: string): string {
  return `limitation:${chemin}`
}

// Route Better Auth visée (`/sign-in/email`…), ou null hors de BASE_PATH_AUTH.
export function cheminAuth(url: string): string | null {
  let chemin: string
  try {
    chemin = new URL(url).pathname
  } catch {
    return null
  }
  if (!chemin.startsWith(`${BASE_PATH_AUTH}/`)) return null
  return chemin.slice(BASE_PATH_AUTH.length)
}

// Route servie : POST sur une route de la liste fermée. Sinon null (réponse 404).
export function routeServie(requete: Request): string | null {
  const chemin = cheminAuth(requete.url)
  return requete.method === 'POST' && chemin && CHEMINS_AUTORISES.has(chemin) ? chemin : null
}

export function introuvable(): Response {
  return new Response('Not Found', { status: 404 })
}

export async function servirAuth(
  auth: AuthCoffre,
  pool: Pool,
  requete: Request,
): Promise<Response> {
  const chemin = routeServie(requete)
  if (!chemin) return introuvable()

  const reponse = await auth.handler(requete)
  if (reponse.status === 429) {
    const depuis = new Date(Date.now() - FENETRE_FREIN_S * 1000)
    // Le refus est déjà décidé : un journal indisponible ne le change pas.
    await logRateLimitedOnce(pool, acteurLimitation(chemin), depuis).catch(() => {
      console.error('[coffre] failed:journal')
    })
  }
  return reponse
}
