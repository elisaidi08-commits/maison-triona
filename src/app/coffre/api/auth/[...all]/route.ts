import { getAuth } from '@/lib/auth/serveur'
import { servirAuth } from '@/lib/auth/enveloppe'
import { getCoffrePool } from '@/lib/db/pool'

// Gestionnaire Better Auth du coffre (story 3.2, partie C), monté sous /coffre (`basePath`) : le
// chemin des cookies, /coffre, couvre aussi ces routes. Les formulaires passent par les Server
// Actions, qui appellent la même enveloppe : liste fermée des routes (404 avant Better Auth, rien
// d'écrit), journal des réponses 429. POST seulement : aucune route GET n'est servie.

export function POST(request: Request): Promise<Response> {
  return servirAuth(getAuth(), getCoffrePool(), request)
}
