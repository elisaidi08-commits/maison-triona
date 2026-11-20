'use server'

import { randomUUID } from 'node:crypto'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { localizedPath } from '@/i18n/pathnames'
import { requestAccessLink, type IssuedLink } from '@/lib/booking/bookings'
import { cleDebitAdresse, empreinteAdresse, secretEmpreinteAdresse } from '@/lib/booking/email-hmac'
import type { EtatLien } from '@/lib/booking/link-form'
import { getPool } from '@/lib/db/pool'
import { emailConfigFromEnv, type EmailConfig } from '@/lib/email/config'
import { createOutboxDeps } from '@/lib/outbox/deps'
import { sendAccessLinkNow, type AccessLinkContent } from '@/lib/outbox/process'
import { limiterDebit, usageUnique } from '@/lib/rate-limit'
import { empreinte, jourUtc, reseauIp } from '@/lib/security/empreinte'
import {
  DELAI_MINIMUM_MS,
  DUREE_MAXIMUM_MS,
  signerHorodatage,
  verifierHorodatage,
} from '@/lib/security/horodatage'
import { secretFormulaire } from '@/lib/security/secret'
import { lireValeursLien, piegeRempli, validerDemandeLien } from '@/lib/validation/booking-link'
import { vaultPublicKeyFromEnv } from '@/lib/vault/config'

// Demande d'un lien de réservation d'appel (story 3.9 ; docs/reservation-appel.md §2, §4.4, §4.5).
// Point d'entrée POST public : tout est revérifié ici, dans cet ordre, comme le formulaire de contact
// (src/actions/request.ts, story 3.5) :
// 1. piège à robots rempli : rejet silencieux, la réponse est celle d'une demande aboutie ;
// 2. secret du formulaire absent sur un déploiement : demande fermée ;
// 3. horodatage signé : falsifié, absent (page statique, premier envoi sans JavaScript), périmé ou
//    de moins de 3 secondes, « trop tôt » avec un horodatage et la saisie ;
// 4. validation Zod de l'adresse ;
// 5. ouverture : base du site, clé publique du coffre (sans elle, la page de réservation refuse tout
//    lien), secret des empreintes d'adresse, e-mails configurés, compte de l'envoi ; sinon « ouvrira
//    bientôt », rien n'est enregistré ni envoyé ;
// 6. limitation de débit (spec §4.4) : 3 demandes par 10 minutes par empreinte d'IP (préfixe /64 en
//    IPv6, sel du jour), 3 par 24 heures par adresse (empreinte du secret des adresses, jamais
//    l'adresse), plafond global de 100 par jour qui alerte sans bloquer. Refusée : AUCUN lien, AUCUN
//    e-mail, et la même réponse qu'une demande aboutie ;
// 7. usage unique de l'horodatage (Upstash) : rejoué, « trop tôt » ;
// 8. dans une transaction (rôle `site_public`) : les liens vivants de cette adresse annulés, un lien
//    neuf (empreinte du jeton seule), l'e-mail d'accès dans la boîte d'envoi (gabarit seul) ;
// 9. premier essai d'envoi après la réponse (`after()`), avec l'adresse et le jeton gardés en mémoire
//    seulement ; redirection (303 sans JavaScript) vers « Un lien vient de vous être envoyé ».
// Réponse identique quelle que soit l'adresse : connue ou non, limitée ou non, la même page et le même
// texte ; et une durée minimale commune (`DUREE_MINIMUM_MS`) pour que l'écriture en base, absente
// quand la demande est refusée, ne se lise pas dans le délai de la réponse.
// Journaux : un statut seulement, jamais l'adresse, le jeton, une empreinte ni une erreur brute.

const LIMITE_IP = { maximum: 3, fenetreSecondes: 10 * 60 }
const LIMITE_ADRESSE = { maximum: 3, fenetreSecondes: 24 * 60 * 60 }
const PLAFOND_JOUR = { maximum: 100, fenetreSecondes: 24 * 60 * 60, alerte: true }
/** Durée minimale d'une réponse aboutie ou refusée en silence (piège, limite) : 600 ms. */
const DUREE_MINIMUM_MS = 600

type Statut =
  | 'rejected:honeypot'
  | 'rejected:token'
  | 'rejected:time'
  | 'rejected:replay'
  | 'rejected:invalid'
  | 'rejected:rate'
  | 'alert:global-cap'
  | 'rate:unavailable'
  | 'failed:rate'
  | 'failed:config'
  | 'failed:vault'
  | 'failed:after'
  | 'mail:disabled'
  | 'issued'

function journaliser(statut: Statut) {
  console.info(`[lien] ${statut}`)
}

// Configuration manquante : signalée une fois par instance.
const signalees = new Set<string>()
function configurationManquante(
  element: string,
  statut: 'failed:config' | 'mail:disabled' = 'failed:config',
) {
  if (signalees.has(element)) return
  signalees.add(element)
  journaliser(statut)
}

type Reglage = { secretAdresse: string; email: EmailConfig }

// La demande de lien n'ouvre que si tout ce qu'il faut pour envoyer un lien qui marche est posé.
// Rien n'est cité : ni valeur, ni nom de variable dans un journal.
function reglageLien(): Reglage | null {
  if (!process.env.DATABASE_URL?.trim() || !vaultPublicKeyFromEnv(process.env)) return null
  const secretAdresse = secretEmpreinteAdresse()
  if (!secretAdresse) {
    configurationManquante('secret-adresse')
    return null
  }
  let email: EmailConfig | null
  try {
    email = emailConfigFromEnv(process.env)
  } catch {
    configurationManquante('e-mails')
    return null
  }
  if (!email) {
    configurationManquante('e-mails', 'mail:disabled')
    return null
  }
  if (!process.env.ENVOI_DATABASE_URL?.trim()) {
    configurationManquante('envoi')
    return null
  }
  return { secretAdresse, email }
}

async function adresseIp(): Promise<string> {
  const entetes = await headers()
  return (
    entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    entetes.get('x-real-ip')?.trim() ||
    'inconnue'
  )
}

async function attendreAuMoins(debut: number): Promise<void> {
  const reste = DUREE_MINIMUM_MS - (Date.now() - debut)
  if (reste > 0) await new Promise((resolve) => setTimeout(resolve, reste))
}

// Premier essai d'envoi, après la réponse. Ne lève jamais : le message est en base ; s'il n'aboutit
// pas, la tâche planifiée le passe en échec et alerte Sady (ni adresse ni jeton à reprendre).
function planifierEnvoi(config: EmailConfig, id: string, contenu: AccessLinkContent): void {
  try {
    after(async () => {
      let deps
      try {
        deps = createOutboxDeps(config)
      } catch {
        configurationManquante('envoi')
        return
      }
      await sendAccessLinkNow(deps, id, contenu)
    })
  } catch {
    journaliser('failed:after')
  }
}

export async function demanderLien(_precedent: EtatLien, donnees: FormData): Promise<EtatLien> {
  const debut = Date.now()
  const valeurs = lireValeursLien(donnees)
  const locale = valeurs.locale === 'en' ? 'en' : 'fr'
  const envoye = localizedPath('/contact/appel/envoye', locale)
  const saisie = valeurs.email ? { email: valeurs.email } : {}
  const reglage = reglageLien()

  // Piège rempli : même réponse qu'une demande aboutie, rien ne signale au robot qu'il a été repéré.
  if (piegeRempli(donnees)) {
    journaliser('rejected:honeypot')
    if (!reglage) return { statut: 'ferme', valeurs: saisie }
    await attendreAuMoins(debut)
    redirect(envoye)
  }

  const secret = secretFormulaire()
  if (!secret) {
    configurationManquante('secret')
    return { statut: 'ferme', valeurs: saisie }
  }

  const maintenant = Date.now()
  const recu = valeurs.jeton ?? null
  const horodatage = verifierHorodatage(recu, secret, maintenant)
  if (horodatage.statut === 'invalide') {
    journaliser('rejected:token')
    return { statut: 'trop-tot', valeurs: saisie, jeton: signerHorodatage(maintenant, secret) }
  }
  if (horodatage.statut !== 'valide') {
    journaliser('rejected:time')
    return { statut: 'trop-tot', valeurs: saisie, jeton: signerHorodatage(maintenant, secret) }
  }
  const jeton = recu as string
  if (horodatage.ageMs < DELAI_MINIMUM_MS) {
    journaliser('rejected:time')
    return { statut: 'trop-tot', valeurs: saisie, jeton }
  }

  const resultat = validerDemandeLien(valeurs)
  if (!resultat.succes) {
    journaliser('rejected:invalid')
    return { statut: 'erreurs', erreurs: { email: resultat.erreur }, valeurs: saisie, jeton }
  }
  if (!reglage) return { statut: 'ferme', valeurs: saisie, jeton }
  const { email } = resultat.demande

  const jour = new Date(maintenant)
  const debit = await limiterDebit([
    { cle: `lien-ip:${empreinte(reseauIp(await adresseIp()), secret, jour)}`, ...LIMITE_IP },
    { cle: `lien-adresse:${cleDebitAdresse(email, reglage.secretAdresse)}`, ...LIMITE_ADRESSE },
    { cle: `lien-jour:${jourUtc(jour)}`, ...PLAFOND_JOUR },
  ])
  switch (debit.statut) {
    case 'refuse':
      // Même page qu'une demande aboutie : rien ne dit si l'adresse ou l'IP est limitée.
      journaliser('rejected:rate')
      await attendreAuMoins(debut)
      redirect(envoye)
    case 'reponse':
      journaliser('failed:rate')
      return { statut: 'echec', valeurs: saisie, jeton }
    case 'reseau':
      journaliser('rate:unavailable')
      break
    case 'config':
      journaliser('failed:config')
      break
    case 'inactif':
      if (debit.configManquante) configurationManquante('upstash')
      break
    case 'autorise':
      if (debit.alertes.length > 0) journaliser('alert:global-cap')
      break
  }

  const unique = await usageUnique(
    `jeton:${horodatage.identifiant}`,
    Math.ceil(DUREE_MAXIMUM_MS / 1000),
  )
  switch (unique.statut) {
    case 'deja-vu':
      journaliser('rejected:replay')
      return { statut: 'trop-tot', valeurs: saisie, jeton: signerHorodatage(Date.now(), secret) }
    case 'reponse':
      journaliser('failed:rate')
      return { statut: 'echec', valeurs: saisie, jeton }
    case 'reseau':
      journaliser('rate:unavailable')
      break
    case 'config':
      journaliser('failed:config')
      break
    case 'inactif':
    case 'nouveau':
      break
  }

  const outboxId = randomUUID()
  let lien: IssuedLink
  try {
    lien = await requestAccessLink(getPool(), {
      emailHmac: empreinteAdresse(email, reglage.secretAdresse),
      outboxId,
      now: new Date(),
    })
  } catch {
    // Jamais l'erreur elle-même : un statut seulement. Rien n'est écrit (transaction annulée).
    journaliser('failed:vault')
    return { statut: 'echec', valeurs: saisie, jeton: signerHorodatage(Date.now(), secret) }
  }
  journaliser('issued')
  planifierEnvoi(reglage.email, outboxId, { to: email, token: lien.token, locale })

  await attendreAuMoins(debut)
  // En dernier, hors du try : `redirect` lève une exception de contrôle (doc Next.js) ; le rappel
  // `after()` déjà posé s'exécute quand même.
  redirect(envoye)
}
