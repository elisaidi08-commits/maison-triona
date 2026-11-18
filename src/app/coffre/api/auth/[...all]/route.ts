import { getAuth } from '@/lib/auth/serveur'

// Gestionnaire Better Auth du coffre (story 3.2, partie C), monté sous /coffre (`basePath`) : le
// chemin des cookies, /coffre, couvre aussi ces routes. Les formulaires passent par les Server
// Actions, qui appellent le même gestionnaire ; la liste fermée des routes servies est dans
// src/lib/auth/auth.ts (les autres répondent 404). POST seulement : aucune route GET n'est servie.

export function POST(request: Request): Promise<Response> {
  return getAuth().handler(request)
}
