'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { localizedPath } from '@/i18n/pathnames'
import { getPool } from '@/lib/db/pool'
import type { EtatDemande } from '@/lib/demande/champs'
import { limiterDebit, usageUnique } from '@/lib/rate-limit'
import { empreinte, jourUtc, reseauIp } from '@/lib/security/empreinte'
import {
  DELAI_MINIMUM_MS,
  DUREE_MAXIMUM_MS,
  signerHorodatage,
  verifierHorodatage,
} from '@/lib/security/horodatage'
import { secretFormulaire } from '@/lib/security/secret'
import { lireValeurs, validerDemande } from '@/lib/validation/demande'
import { vaultPublicKeyFromEnv } from '@/lib/vault/config'
import { VaultKeyError } from '@/lib/vault/seal'
import { storeRequest } from '@/lib/vault/store'

// Envoi du formulaire de contact (stories 3.1, 3.5 et 3.2 B, docs/architecture.md §6.1 et §6.7).
// Une Server Action est un point d'entrée POST public : tout est revérifié ici, dans cet ordre :
// 1. piège à robots (champ caché rempli) : rejet silencieux, la réponse ressemble à un envoi
//    abouti (coffre ouvert : la page de remerciement ; fermé : « ouvrira bientôt ») ;
// 2. secret absent sur un déploiement Vercel : formulaire fermé, aucun repli (aperçu public D62) ;
// 3. horodatage signé : falsifié, rejet silencieux ; absent (page statique, sans JavaScript) ou de
//    plus de 2 heures, « trop tôt » avec un horodatage neuf ; moins de 3 secondes, « trop tôt ».
//    La saisie revient toujours, avec l'horodatage à renvoyer ;
// 4. validation Zod de toute la demande ;
// 5. limitation de débit des envois valides (empreintes d'IP, préfixe /64 en IPv6, et d'adresse ;
//    sel du jour) ; le plafond global du jour alerte sans bloquer ;
// 6. usage unique de l'horodatage, quand Upstash est configuré : rejoué, rejet silencieux ;
// 7. coffre : sans `DATABASE_URL` ou sans `VAULT_PUBLIC_KEY`, envoi fermé ; rien n'est enregistré,
//    envoyé ni journalisé, et le formulaire affiche « L'envoi des demandes ouvrira bientôt ».
//    Configuré : la demande est scellée avec la clé publique puis écrite dans le coffre
//    (`stored`), et le visiteur part vers /contact/merci (303 sans JavaScript). Échec d'écriture
//    (`failed:vault`, ou `failed:config` si la clé publique est invalide) : « L'envoi n'a pas
//    abouti », la saisie revient avec un horodatage neuf (le précédent a pu être consommé).
//    Les e-mails (boîte d'envoi, même transaction) viendront avec la story 3.3.
// Upstash : une panne réseau laisse passer ; des identifiants refusés aussi, journalisés
// `failed:config` ; toute autre réponse inattendue refuse (« L'envoi n'a pas abouti »).
// Journaux : un statut seulement, jamais une valeur du formulaire, une adresse ni une erreur brute.

const LIMITE_IP = { maximum: 3, fenetreSecondes: 10 * 60 }
const LIMITE_ADRESSE = { maximum: 3, fenetreSecondes: 24 * 60 * 60 }
const PLAFOND_JOUR = { maximum: 100, fenetreSecondes: 24 * 60 * 60, alerte: true }

type Statut =
  | 'rejected:honeypot'
  | 'rejected:token'
  | 'rejected:replay'
  | 'rejected:time'
  | 'rejected:invalid'
  | 'rejected:rate'
  | 'alert:global-cap'
  | 'rate:unavailable'
  | 'failed:rate'
  | 'failed:config'
  | 'failed:vault'
  | 'stored'

function journaliser(statut: Statut) {
  console.info(`[demande] ${statut}`)
}

// Configuration manquante (secret, variables d'Upstash) : signalée une fois par instance.
const signalees = new Set<string>()
function configurationManquante(element: string) {
  if (signalees.has(element)) return
  signalees.add(element)
  journaliser('failed:config')
}

async function adresseIp(): Promise<string> {
  const entetes = await headers()
  return (
    entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    entetes.get('x-real-ip')?.trim() ||
    'inconnue'
  )
}

/** Horodatage signé, demandé par le formulaire quand il s'affiche (avec JavaScript). */
export async function obtenirJeton(): Promise<string | null> {
  const secret = secretFormulaire()
  if (!secret) {
    configurationManquante('secret')
    return null
  }
  return signerHorodatage(Date.now(), secret)
}

export async function envoyerDemande(
  _precedent: EtatDemande,
  donnees: FormData,
): Promise<EtatDemande> {
  const valeurs = lireValeurs(donnees)
  // Coffre configuré (base et clé publique) : l'envoi est ouvert.
  const clePublique = vaultPublicKeyFromEnv(process.env)
  const fermee: EtatDemande = { statut: 'ferme', valeurs }
  // Page de remerciement, dans la langue de l'interface (champ caché, français par défaut).
  const merci = localizedPath('/contact/merci', valeurs.locale === 'en' ? 'en' : 'fr')
  // Même réponse qu'un envoi abouti : rien ne signale au robot qu'il a été repéré.
  const silence = (): EtatDemande => {
    if (clePublique) redirect(merci)
    return fermee
  }

  const piege = donnees.get('site')
  if (typeof piege === 'string' && piege.trim() !== '') {
    journaliser('rejected:honeypot')
    return silence()
  }

  // Sans secret, le formulaire est fermé, même si le coffre est prêt : jamais de faux remerciement.
  const secret = secretFormulaire()
  if (!secret) {
    configurationManquante('secret')
    return fermee
  }

  const maintenant = Date.now()
  const recu = donnees.get('jeton')
  const horodatage = verifierHorodatage(typeof recu === 'string' ? recu : null, secret, maintenant)
  if (horodatage.statut === 'invalide') {
    journaliser('rejected:token')
    return silence()
  }
  if (horodatage.statut !== 'valide') {
    // Absent (premier envoi sans JavaScript) ou périmé : un horodatage neuf, à renvoyer.
    journaliser('rejected:time')
    return { statut: 'trop-tot', valeurs, jeton: signerHorodatage(maintenant, secret) }
  }
  // L'horodatage reçu accompagne chaque réponse : sans JavaScript, la page le renvoie tel quel.
  const jeton = recu as string
  if (horodatage.ageMs < DELAI_MINIMUM_MS) {
    journaliser('rejected:time')
    return { statut: 'trop-tot', valeurs, jeton }
  }

  const resultat = validerDemande(valeurs)
  if (!resultat.succes) {
    journaliser('rejected:invalid')
    return { statut: 'erreurs', erreurs: resultat.erreurs, valeurs, jeton }
  }

  const aujourdhui = new Date(maintenant)
  const limites = [
    { cle: `ip:${empreinte(reseauIp(await adresseIp()), secret, aujourdhui)}`, ...LIMITE_IP },
    { cle: `jour:${jourUtc(aujourdhui)}`, ...PLAFOND_JOUR },
  ]
  if (resultat.demande.email) {
    limites.push({
      cle: `adresse:${empreinte(resultat.demande.email, secret, aujourdhui)}`,
      ...LIMITE_ADRESSE,
    })
  }
  const debit = await limiterDebit(limites)
  switch (debit.statut) {
    case 'refuse':
      journaliser('rejected:rate')
      return { statut: 'limite', valeurs, jeton }
    case 'reponse':
      journaliser('failed:rate')
      return { statut: 'echec', valeurs, jeton }
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

  // Usage unique, après la limitation : un envoi refusé pour débit garde son horodatage.
  const unique = await usageUnique(
    `jeton:${horodatage.identifiant}`,
    Math.ceil(DUREE_MAXIMUM_MS / 1000),
  )
  switch (unique.statut) {
    case 'deja-vu':
      journaliser('rejected:replay')
      return silence()
    case 'reponse':
      journaliser('failed:rate')
      return { statut: 'echec', valeurs, jeton }
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

  // Coffre non configuré : rien n'est enregistré, envoyé ni journalisé.
  if (!clePublique) return fermee

  try {
    await storeRequest(getPool(), resultat.demande, clePublique, new Date(maintenant))
  } catch (error) {
    // Jamais l'erreur elle-même : un statut seulement.
    journaliser(error instanceof VaultKeyError ? 'failed:config' : 'failed:vault')
    return { statut: 'echec', valeurs, jeton: signerHorodatage(Date.now(), secret) }
  }
  journaliser('stored')
  // Hors du try : `redirect` lève une exception de contrôle (doc Next.js).
  redirect(merci)
}
