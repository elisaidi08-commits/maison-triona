import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Réglages partagés par playwright.config.ts et les parcours avec base (projet `reservation`) :
// port des doubles de test (faux-services.mjs), secret factice des empreintes d'adresse (le test
// recalcule `email_hmac`), journal du serveur dédié (le test vérifie qu'il ne contient ni adresse ni
// jeton). Le port peut changer pour un lancement local à côté d'autres serveurs (variable
// `FAUX_SERVICES_PORT`). Valeurs factices uniquement.

export const FAUX_SERVICES_PORT = Number(process.env.FAUX_SERVICES_PORT ?? 3201)
export const FAUX_SERVICES_URL = `http://127.0.0.1:${FAUX_SERVICES_PORT}`
export const FAUX_UPSTASH_TOKEN = 'jeton-factice-upstash-e2e'
export const SECRET_ADRESSE_E2E = 'secret-factice-e2e-empreintes-adresse-0123456789'
export const JOURNAL_SERVEUR = join(
  tmpdir(),
  `maison-triona-serveur-reservation-${FAUX_SERVICES_PORT}.log`,
)

/** Remet les doubles de test à zéro (limites et e-mails reçus). */
export async function remettreAZero(): Promise<void> {
  const reponse = await fetch(`${FAUX_SERVICES_URL}/__reset`, { method: 'POST' })
  if (!reponse.ok) throw new Error('Doubles de test injoignables')
}

/** Pose une clé du double d'Upstash (clé complète, préfixe `mt:` compris). */
export async function poserCle(cle: string, valeur: string, duree: number): Promise<void> {
  const reponse = await fetch(`${FAUX_SERVICES_URL}/__cle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cle, valeur, duree }),
  })
  if (!reponse.ok) throw new Error('Doubles de test injoignables')
}

/** Valeur d'une clé du double d'Upstash (compteur), 0 si elle n'existe pas. */
export async function lireCompteur(cle: string): Promise<number> {
  const reponse = await fetch(`${FAUX_SERVICES_URL}/__cle?cle=${encodeURIComponent(cle)}`)
  if (!reponse.ok) throw new Error('Doubles de test injoignables')
  const { valeur } = (await reponse.json()) as { valeur: string | null }
  return valeur === null ? 0 : Number(valeur)
}

export interface EmailRecu {
  id: string
  to: string
  subject: string
  text: string
}

export async function emailsRecus(): Promise<EmailRecu[]> {
  const reponse = await fetch(`${FAUX_SERVICES_URL}/__emails`)
  return (await reponse.json()) as EmailRecu[]
}
