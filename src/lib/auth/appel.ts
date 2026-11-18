import type { AuthCoffre } from './auth.ts'

// Appel d'une route Better Auth depuis le serveur (Server Actions du coffre, tests d'intégration).
// On passe par `auth.handler`, comme une requête HTTP, et non par `auth.api` : la limitation de
// débit, le contrôle d'origine et la liste fermée de routes ne s'appliquent qu'aux requêtes.
// Seuls les en-têtes utiles sont transmis : cookies du coffre, origine et métadonnées de la
// requête (contrôle CSRF), navigateur, adresse IP (limitation de débit).

const ENTETES_TRANSMIS = [
  'cookie',
  'origin',
  'user-agent',
  'x-forwarded-for',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
] as const

export interface ReponseAuth {
  statut: number
  // Code d'erreur de Better Auth (`INVALID_CODE`…), null en cas de succès.
  code: string | null
  donnees: unknown
  // En-têtes Set-Cookie, un par cookie, à recopier vers le navigateur.
  cookies: string[]
}

export async function appelerAuth(
  auth: AuthCoffre,
  chemin: string,
  corps: Record<string, unknown>,
  entetes: Headers,
): Promise<ReponseAuth> {
  const contexte = await auth.$context
  const transmis = new Headers({ 'content-type': 'application/json' })
  for (const nom of ENTETES_TRANSMIS) {
    const valeur = entetes.get(nom)
    if (valeur) transmis.set(nom, valeur)
  }

  const reponse = await auth.handler(
    new Request(`${contexte.baseURL}${chemin}`, {
      method: 'POST',
      headers: transmis,
      body: JSON.stringify(corps),
    }),
  )

  let donnees: unknown = null
  try {
    donnees = JSON.parse(await reponse.text())
  } catch {
    // Réponse vide ou non JSON (429 de la limitation de débit, par exemple).
  }
  const code =
    reponse.ok || typeof donnees !== 'object' || donnees === null
      ? null
      : typeof (donnees as { code?: unknown }).code === 'string'
        ? (donnees as { code: string }).code
        : null

  return { statut: reponse.status, code, donnees, cookies: reponse.headers.getSetCookie() }
}
