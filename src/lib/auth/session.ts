import { DUREE_MAX_SESSION_S, INACTIVITE_MAX_S } from './config.ts'

// Règle d'accès au coffre (story 3.2, partie C), sans dépendance : testée par node --test.
// - Durée maximale : Better Auth fixe l'échéance de la session à sa création (rafraîchissement
//   coupé) ; on revérifie l'âge ici, au cas où une session aurait reçu une autre échéance.
// - Inactivité : Better Auth ne la mesure pas sans rafraîchir l'échéance ; le coffre note la
//   dernière activité dans `session.updatedAt` (src/lib/auth/acces.ts) et la compare ici.
// - Un compte sans TOTP ne peut qu'enrôler son TOTP ; une session ouverte sans second facteur
//   (avant l'enrôlement, par exemple) ne donne jamais accès au contenu, même après l'enrôlement.

export type EtatSession = 'expiree' | 'enrolement' | 'second-facteur-manquant' | 'autorisee'

export interface SessionLue {
  createdAt: Date
  updatedAt: Date
  // Session créée par la vérification d'un code TOTP ou d'un code de secours.
  twoFactorVerified: boolean
  // TOTP enrôlé et confirmé sur le compte.
  twoFactorEnabled: boolean
}

export function evaluerSession(session: SessionLue, maintenant: Date): EtatSession {
  const instant = maintenant.getTime()
  const age = instant - session.createdAt.getTime()
  const inactivite = instant - session.updatedAt.getTime()
  if (!Number.isFinite(age) || !Number.isFinite(inactivite)) return 'expiree'
  if (age > DUREE_MAX_SESSION_S * 1000) return 'expiree'
  if (inactivite > INACTIVITE_MAX_S * 1000) return 'expiree'
  if (!session.twoFactorEnabled) return 'enrolement'
  if (!session.twoFactorVerified) return 'second-facteur-manquant'
  return 'autorisee'
}
