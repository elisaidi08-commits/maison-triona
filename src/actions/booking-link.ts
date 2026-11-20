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
import { CAP_ALERT_TTL_SECONDS, capAlertKey, scheduleCapAlert } from '@/lib/outbox/notify-request'
import { sendAccessLinkNow, sendNow, type AccessLinkContent } from '@/lib/outbox/process'
import { enqueueCapAlert } from '@/lib/outbox/repository'
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
//    lien), secret des empreintes d'adresse, e-mails configurés, compte de l'envoi et, sur un
//    déploiement, Upstash ; sinon « ouvrira bientôt », rien n'est enregistré ni envoyé ;
// 6. usage unique de l'horodatage (Upstash) : rejoué, « trop tôt ». AVANT la limitation (relecture
//    sécurité) : la réponse à un rejeu ne dépend jamais de l'état des compteurs d'une adresse ;
// 7. limitation de débit (spec §4.4) : 3 demandes par 10 minutes par empreinte d'IP (préfixe /64 en
//    IPv6, sel du jour), 3 par 24 heures par adresse (empreinte du secret des adresses, jamais
//    l'adresse), puis, pour les seules demandes admises par ces deux limites, plafond global de 100
//    par jour, bloquant (une demande refusée par sa limite ne l'entame pas). Refusée : AUCUN lien,
//    AUCUN e-mail, et la
//    même réponse qu'une demande aboutie. Ce point envoie des e-mails à des adresses saisies par
//    n'importe qui : contrairement au contact, une panne d'Upstash (réseau, identifiants refusés) le
//    FERME (« L'envoi n'a pas abouti »), elle ne le laisse jamais ouvert sans limite.
//    Plafond global dépassé (D72) : au premier dépassement du jour UTC, une alerte technique part à
//    Sady (événement `link_cap`, la date seulement : ni adresse, ni IP, ni empreinte), comme celle
//    du plafond de notifications (src/actions/request.ts) : clé d'usage unique `lien-plafond:<jour>`
//    (une alerte par jour au plus, même sous concurrence ; tout autre résultat, aucune), écriture
//    par le compte de l'envoi dans un `after()`, puis envoi aussitôt (`alert:link-cap-sent`). Au-delà
//    du plafond, toute demande admise par les limites par IP et par adresse est refusée et fait ce
//    même appel de plus ;
// 8. après la réponse (`after()`), dans une transaction (rôle `site_public`) : les liens vivants de
//    cette adresse annulés, un lien neuf (empreinte du jeton seule), l'e-mail d'accès dans la boîte
//    d'envoi (gabarit seul) ; puis le premier essai d'envoi, avec l'adresse et le jeton gardés en
//    mémoire seulement. Redirection (303 sans JavaScript) vers « Un lien vient de vous être envoyé ».
// Réponse identique quelle que soit l'adresse : connue ou non, limitée ou non, la même page, le même
// texte. Le nombre d'appels à Upstash avant la réponse varie (1 appel de limitation si la demande est
// refusée par sa limite, 2 si elle est admise, 3 au-delà du plafond) ; l'écriture en base, faite
// après la réponse, ne se lit pas dans son délai ; une durée minimale commune (`DUREE_MINIMUM_MS`)
// masque le reste. Contrepartie : une base injoignable ne se voit plus à l'écran (le lien n'arrive
// pas, `[lien] failed:vault` au journal) ; la personne redemande un lien.
// Journaux : un statut seulement, jamais l'adresse, le jeton, une empreinte ni une erreur brute.

const LIMITE_IP = { maximum: 3, fenetreSecondes: 10 * 60 }
const LIMITE_ADRESSE = { maximum: 3, fenetreSecondes: 24 * 60 * 60 }
// Plafond global des e-mails d'accès, bloquant, avec une alerte à Sady au premier dépassement du
// jour (décision de Sady du 20/11/2026, D72).
const PLAFOND_JOUR = { maximum: 100, fenetreSecondes: 24 * 60 * 60 }
/** Durée minimale d'une réponse aboutie ou refusée en silence (piège, limite) : 600 ms. */
const DUREE_MINIMUM_MS = 600

type Statut =
  | 'rejected:honeypot'
  | 'rejected:token'
  | 'rejected:time'
  | 'rejected:replay'
  | 'rejected:invalid'
  | 'rejected:rate'
  | 'rate:unavailable'
  | 'failed:rate'
  | 'failed:config'
  | 'failed:vault'
  | 'failed:after'
  | 'mail:disabled'
  | 'alert:link-cap-sent'
  | 'failed:link-cap-alert'
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
  // Jamais sans limitation sur un déploiement : la limite est la seule protection des tiers.
  const upstash =
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (process.env.VERCEL_ENV && !upstash) {
    configurationManquante('upstash')
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

// Après la réponse : le lien et son e-mail en base (une transaction), puis le premier essai d'envoi.
// Ne lève jamais. Base injoignable : rien n'est écrit, rien ne part (`failed:vault`). Envoi manqué :
// la tâche planifiée passe le message en échec et alerte Sady (ni adresse ni jeton à reprendre).
function planifierLien(
  config: EmailConfig,
  secretAdresse: string,
  email: string,
  locale: 'fr' | 'en',
) {
  try {
    after(async () => {
      const outboxId = randomUUID()
      let lien: IssuedLink
      try {
        lien = await requestAccessLink(getPool(), {
          emailHmac: empreinteAdresse(email, secretAdresse),
          outboxId,
          now: new Date(),
        })
      } catch {
        // Jamais l'erreur elle-même : un statut seulement. Rien n'est écrit (transaction annulée).
        journaliser('failed:vault')
        return
      }
      journaliser('issued')
      let deps
      try {
        deps = createOutboxDeps(config)
      } catch {
        configurationManquante('envoi')
        return
      }
      const contenu: AccessLinkContent = { to: email, token: lien.token, locale }
      await sendAccessLinkNow(deps, outboxId, contenu)
    })
  } catch {
    journaliser('failed:after')
  }
}

// Plafond global atteint : alerte à Sady au premier dépassement du jour (D72). Seules les demandes
// admises par les limites par IP et par adresse y arrivent ; l'appel de plus à Upstash est masqué
// par la durée minimale commune. Ne lève jamais.
async function alerterPlafond(config: EmailConfig, jour: Date): Promise<void> {
  const premier = await usageUnique(capAlertKey(jour, 'link_cap'), CAP_ALERT_TTL_SECONDS)
  scheduleCapAlert(
    premier.statut,
    config,
    {
      after,
      createDeps: createOutboxDeps,
      enqueue: enqueueCapAlert,
      sendNow,
      log: journaliser,
      logOnce: configurationManquante,
    },
    'link_cap',
  )
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
      return { statut: 'echec', valeurs: saisie, jeton }
    case 'config':
      journaliser('failed:config')
      return { statut: 'echec', valeurs: saisie, jeton }
    case 'inactif':
    case 'nouveau':
      break
  }

  const jour = new Date(maintenant)
  const cleJour = `lien-jour:${jourUtc(jour)}`
  // Deux temps (D72, 20/11/2026) : le plafond du jour ne compte que les demandes admises par les
  // limites par IP et par adresse ; sinon un seul envoyeur, refusé par sa limite, épuiserait le
  // plafond de tout le monde jusqu'à minuit UTC. Le second appel ne se lit pas dans le délai de la
  // réponse : la durée minimale commune (600 ms) le couvre.
  const limites = await limiterDebit([
    { cle: `lien-ip:${empreinte(reseauIp(await adresseIp()), secret, jour)}`, ...LIMITE_IP },
    { cle: `lien-adresse:${cleDebitAdresse(email, reglage.secretAdresse)}`, ...LIMITE_ADRESSE },
  ])
  const debit =
    limites.statut === 'autorise'
      ? await limiterDebit([{ cle: cleJour, ...PLAFOND_JOUR }])
      : limites
  switch (debit.statut) {
    case 'refuse':
      // Même page qu'une demande aboutie : rien ne dit si l'adresse ou l'IP est limitée.
      journaliser('rejected:rate')
      if (debit.depassees.includes(cleJour)) await alerterPlafond(reglage.email, jour)
      await attendreAuMoins(debut)
      redirect(envoye)
    case 'reponse':
      journaliser('failed:rate')
      return { statut: 'echec', valeurs: saisie, jeton }
    case 'reseau':
      journaliser('rate:unavailable')
      return { statut: 'echec', valeurs: saisie, jeton }
    case 'config':
      journaliser('failed:config')
      return { statut: 'echec', valeurs: saisie, jeton }
    case 'inactif':
    case 'autorise':
      break
  }

  planifierLien(reglage.email, reglage.secretAdresse, email, locale)

  await attendreAuMoins(debut)
  // En dernier, hors du try : `redirect` lève une exception de contrôle (doc Next.js) ; le rappel
  // `after()` déjà posé s'exécute quand même.
  redirect(envoye)
}
