'use server'

import { headers } from 'next/headers'
import type { EtatDemande } from '@/lib/demande/champs'
import { limiterDebit } from '@/lib/rate-limit'
import { empreinte, jourUtc } from '@/lib/security/empreinte'
import { DELAI_MINIMUM_MS, signerHorodatage, verifierHorodatage } from '@/lib/security/horodatage'
import { secretFormulaire } from '@/lib/security/secret'
import { lireValeurs, validerDemande } from '@/lib/validation/demande'

// Envoi du formulaire de contact (stories 3.1 et 3.5, docs/architecture.md §6.1 et §6.7).
// Une Server Action est un point d'entrée POST public : tout est revérifié ici, dans cet ordre :
// 1. piège à robots (champ caché rempli) : rejet silencieux, la réponse ressemble à un envoi ;
// 2. horodatage signé : falsifié, rejet silencieux ; moins de 3 secondes, « trop tôt ». Sans
//    JavaScript, la page statique n'en porte pas : le contrôle ne s'applique qu'à partir du second
//    envoi (l'horodatage est alors délivré avec la page d'erreurs) ;
// 3. validation Zod de toute la demande ;
// 4. limitation de débit (empreintes d'IP et d'adresse, sel du jour), sur les envois valides ;
// 5. envoi fermé : le coffre n'existe pas encore (lot E). Rien n'est enregistré, envoyé ni
//    journalisé ; le formulaire affiche l'état « L'envoi des demandes ouvrira bientôt ».
// Journaux : un statut de rejet ou de panne seulement, jamais une valeur du formulaire ni une
// adresse.

const LIMITE_IP = { maximum: 3, fenetreSecondes: 10 * 60 }
const LIMITE_ADRESSE = { maximum: 3, fenetreSecondes: 24 * 60 * 60 }
const PLAFOND_JOUR = { maximum: 100, fenetreSecondes: 24 * 60 * 60 }

type Statut =
  | 'rejected:honeypot'
  | 'rejected:token'
  | 'rejected:time'
  | 'rejected:invalid'
  | 'rejected:rate'
  | 'rate:unavailable'
  | 'failed:config'

function journaliser(statut: Statut) {
  console.info(`[demande] ${statut}`)
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
  try {
    return signerHorodatage(Date.now(), secretFormulaire())
  } catch {
    journaliser('failed:config')
    return null
  }
}

export async function envoyerDemande(
  _precedent: EtatDemande,
  donnees: FormData,
): Promise<EtatDemande> {
  const valeurs = lireValeurs(donnees)
  // Même réponse qu'un envoi abouti : rien ne signale au robot qu'il a été repéré.
  const silence: EtatDemande = { statut: 'ferme', valeurs }

  const piege = donnees.get('site')
  if (typeof piege === 'string' && piege.trim() !== '') {
    journaliser('rejected:honeypot')
    return silence
  }

  let secret: string
  try {
    secret = secretFormulaire()
  } catch {
    journaliser('failed:config')
    return { statut: 'echec', valeurs }
  }

  const maintenant = Date.now()
  const jeton = donnees.get('jeton')
  const horodatage = verifierHorodatage(
    typeof jeton === 'string' ? jeton : null,
    secret,
    maintenant,
  )
  if (horodatage.statut === 'invalide') {
    journaliser('rejected:token')
    return silence
  }
  if (horodatage.statut === 'valide' && horodatage.ageMs < DELAI_MINIMUM_MS) {
    journaliser('rejected:time')
    return { statut: 'trop-tot', valeurs }
  }
  // Sans JavaScript : l'horodatage part avec la réponse, le prochain envoi sera contrôlé.
  const nouveauJeton =
    horodatage.statut === 'absent' ? signerHorodatage(maintenant, secret) : undefined

  const resultat = validerDemande(valeurs)
  if (!resultat.succes) {
    journaliser('rejected:invalid')
    return { statut: 'erreurs', erreurs: resultat.erreurs, valeurs, jeton: nouveauJeton }
  }

  const aujourdhui = new Date(maintenant)
  const limites = [
    { cle: `ip:${empreinte(await adresseIp(), secret, aujourdhui)}`, ...LIMITE_IP },
    { cle: `jour:${jourUtc(aujourdhui)}`, ...PLAFOND_JOUR },
  ]
  if (resultat.demande.email) {
    limites.push({
      cle: `adresse:${empreinte(resultat.demande.email, secret, aujourdhui)}`,
      ...LIMITE_ADRESSE,
    })
  }
  const debit = await limiterDebit(limites)
  if (!debit.autorise) {
    journaliser('rejected:rate')
    return { statut: 'limite', valeurs, jeton: nouveauJeton }
  }
  if (debit.indisponible) journaliser('rate:unavailable')

  // Le coffre (lot E) écrira ici la demande chiffrée. D'ici là : rien n'est enregistré, envoyé ni
  // journalisé.
  return { statut: 'ferme', valeurs }
}
