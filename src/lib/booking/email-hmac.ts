/**
 * Empreinte d'une adresse e-mail pour la réservation d'appel (story 3.9 ; docs/reservation-appel.md
 * §4.1, §4.4). L'adresse n'est jamais gardée en clair : la base ne reçoit que `email_hmac`, HMAC-SHA256
 * de l'adresse normalisée avec un secret serveur (`BOOKING_EMAIL_HMAC_SECRET`). Elle sert à annuler le
 * lien précédent d'une même adresse (« un nouveau lien annule l'ancien ») et, plus tard, à retrouver un
 * appel à venir. Sans le secret, on ne remonte pas d'une empreinte à l'adresse, même en essayant une
 * liste d'adresses connues.
 * - Le secret est STABLE (contrairement au sel du jour des limites du formulaire, empreinte.ts) : le
 *   changer rend les empreintes déjà en base sans rapport avec les nouvelles (les liens vivants ne
 *   sont plus annulés par un nouveau lien, au plus pendant 48 heures).
 * - La clé de limitation par adresse (Upstash, 3 demandes par 24 heures) est une seconde empreinte,
 *   dérivée du même secret avec une autre étiquette : Upstash ne voit jamais la valeur de la base.
 * - Validé au démarrage : sur un déploiement Vercel, 32 caractères visibles au moins, sans espace, ou
 *   rien (`null` : la demande de lien reste fermée) ; en production, le build échoue si la demande de
 *   lien est configurée sans lui (`verifierSecretAdresseAuBuild`, next.config.ts). Hors Vercel (poste,
 *   CI), un repli de développement s'applique quand la variable est absente.
 * Fonctions pures, imports relatifs : testé par node --test.
 */
import { createHmac } from 'node:crypto'

export const SECRET_ADRESSE_VARIABLE = 'BOOKING_EMAIL_HMAC_SECRET'
const FORMAT = /^[\x21-\x7e]{32,512}$/
const REPLI_DEVELOPPEMENT = 'maison-triona-repli-empreinte-adresse-jamais-deploye'

type Environnement = Record<string, string | undefined>

/** Secret des empreintes d'adresse, ou `null` s'il manque (déploiement) ou s'il est mal formé. */
export function secretEmpreinteAdresse(env: Environnement = process.env): string | null {
  const brut = env[SECRET_ADRESSE_VARIABLE]
  if (brut === undefined || brut.trim() === '') return env.VERCEL_ENV ? null : REPLI_DEVELOPPEMENT
  return FORMAT.test(brut) ? brut : null
}

/** Adresse normalisée : sans espaces autour, en minuscules, en forme Unicode composée. */
export function normaliserAdresse(adresse: string): string {
  return adresse.trim().normalize('NFC').toLowerCase()
}

function hmac(etiquette: string, adresse: string, secret: string): Buffer {
  if (typeof secret !== 'string' || secret.length === 0) throw new RangeError('Secret manquant')
  return createHmac('sha256', secret)
    .update(`${etiquette}:${normaliserAdresse(adresse)}`, 'utf8')
    .digest()
}

/** `booking_tokens.email_hmac` : 32 octets. */
export function empreinteAdresse(adresse: string, secret: string): Buffer {
  return hmac('adresse', adresse, secret)
}

/** Clé de la limitation de débit par adresse, sans lien avec la valeur de la base. */
export function cleDebitAdresse(adresse: string, secret: string): string {
  return hmac('debit-lien', adresse, secret).toString('base64url')
}

/**
 * Garde du build (next.config.ts), comme `verifierCronAuBuild` : en production Vercel, dès que la
 * demande de lien peut s'ouvrir (base du site `DATABASE_URL` et e-mails `TEM_SECRET_KEY` posés), un
 * secret valable est exigé. Ailleurs (aperçus, poste, CI) : rien, la demande reste fermée sans lui.
 * Le message ne cite aucune valeur.
 */
export function verifierSecretAdresseAuBuild(env: Environnement): void {
  if (env.VERCEL_ENV !== 'production') return
  const base = Boolean(env.DATABASE_URL?.trim())
  const envoi = Boolean(env.TEM_SECRET_KEY?.trim())
  if (!base || !envoi) return
  if (secretEmpreinteAdresse(env)) return
  throw new Error(
    `${SECRET_ADRESSE_VARIABLE} manquant ou mal formé (32 caractères visibles au moins, sans espace) : obligatoire en production dès que la base (DATABASE_URL) et les e-mails (TEM_SECRET_KEY) sont configurés.`,
  )
}
