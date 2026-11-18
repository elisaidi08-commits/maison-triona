import { timingSafeEqual } from 'node:crypto'

// Authentification de la tâche planifiée Vercel (story 3.3) : Vercel envoie
// `Authorization: Bearer <CRON_SECRET>`. Comparaison en temps constant ; un secret absent ou de
// moins de 16 caractères (minimum exigé par Vercel) ferme la route.
// Imports relatifs seulement : testé par node --test.

const MIN_SECRET_LENGTH = 16

export function cronAutorise(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH || header === null) return false
  const attendu = Buffer.from(`Bearer ${secret}`)
  const recu = Buffer.from(header)
  // timingSafeEqual lève si les longueurs diffèrent : on répond non avant.
  if (recu.length !== attendu.length) return false
  return timingSafeEqual(recu, attendu)
}
