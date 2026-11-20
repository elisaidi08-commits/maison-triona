'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { bookingPath, localizedPath, managePath } from '@/i18n/pathnames'
import { retenirEtat } from '@/lib/booking/action-state'
import {
  bookSlot,
  checkBookingLink,
  type BookingResult,
  type LinkCheck,
} from '@/lib/booking/bookings'
import { presenterCreneaux } from '@/lib/booking/display'
import type { EtatReservation, ValeursReservation } from '@/lib/booking/form'
import { smsPropose } from '@/lib/booking/options'
import { deriveManageToken, isTokenFormat } from '@/lib/booking/tokens'
import { getPool } from '@/lib/db/pool'
import { PRIVACY_POLICY_VERSION } from '@/lib/privacy'
import { limiterDebit } from '@/lib/rate-limit'
import { empreinte, reseauIp } from '@/lib/security/empreinte'
import { secretFormulaire } from '@/lib/security/secret'
import { lireValeursReservation, validerReservation } from '@/lib/validation/booking'
import { vaultPublicKeyFromEnv } from '@/lib/vault/config'
import { sealBooking, VaultKeyError } from '@/lib/vault/seal'

// Réservation d'un appel (story 3.10 ; docs/reservation-appel.md §2, §4.2, §5). Point d'entrée POST
// public : tout est revérifié ici, dans cet ordre :
// 1. forme du jeton (champ caché) : une forme inattendue ne vient que d'un envoi trafiqué, retour
//    au formulaire de contact, rien n'atteint la base ;
// 2. coffre configuré (base et clé publique) et secret des empreintes, sinon « L'envoi n'a pas
//    abouti », saisie conservée ;
// 3. validation Zod de la saisie ;
// 4. limitation de débit des envois valides par empreinte d'IP (préfixe /64 en IPv6, sel du jour),
//    comme le formulaire de contact : 5 par 10 minutes (un créneau pris ou un double envoi en
//    coûtent un) ; refusé : « Trop d'envois », saisie conservée ; Upstash en panne : on passe ;
// 5. le lien est lu (lecture seule) : sans valeur, sa page, qui le dit sobrement ; utilisé il y a
//    moins de 15 minutes pour un appel à venir (double clic, renvoi), la page de gestion. Un lien
//    sans valeur ne coûte donc ni scellement ni transaction ;
// 6. la personne est scellée (clé publique du coffre ; le choix SMS n'est retenu que si la case est
//    proposée, src/lib/booking/options.ts), puis `bookSlot` réserve dans une transaction (lien
//    verrouillé, verrou du jour, créneaux recalculés, contrainte d'exclusion) :
//    - réservé, ou déjà réservé par ce même lien il y a moins de 15 minutes (double clic, renvoi) :
//      la page de gestion de l'appel (303), par le lien de gestion déduit du lien d'accès et du
//      secret du formulaire (story 3.11, `deriveManageToken`) ; elle tient lieu de confirmation ;
//    - créneau qui n'est plus ouvert : « Ce créneau vient d'être pris », les créneaux encore libres,
//      les plus proches en tête, la saisie conservée ;
//    - lien qui ne vaut plus entre-temps : sa page ;
//    - coffre injoignable : « L'envoi n'a pas abouti », saisie conservée, rien d'enregistré.
// Le jeton (32 octets) sert de clé : ni piège à robots ni horodatage ici ; ils protégeront la demande
// de lien (story 3.9). Aucun e-mail : la notification sans nom à Cat et la confirmation à la personne
// viendront avec la boîte d'envoi, écrites dans la même transaction que la réservation.
// Sans JavaScript, l'état rendu est aussi déposé pour le rendu de la page qui suit (retenirEtat,
// src/lib/booking/action-state.ts) : Cache Components reprend la coquille de la page sans l'état du
// formulaire.
// Journaux : un statut seulement, jamais le jeton, une valeur saisie, une adresse ni une erreur brute.

const LIMITE_IP = { maximum: 5, fenetreSecondes: 10 * 60 }

type Statut =
  | 'rejected:link'
  | 'rejected:invalid'
  | 'taken'
  | 'booked'
  | 'already-booked'
  | 'rejected:rate'
  | 'rate:unavailable'
  | 'failed:rate'
  | 'failed:config'
  | 'failed:vault'

function journaliser(statut: Statut) {
  console.info(`[reservation] ${statut}`)
}

// La saisie renvoyée au formulaire, sans le jeton (il est déjà dans la page) ; sans le créneau
// quand il vient d'être pris.
function saisie(valeurs: ValeursReservation, sansCreneau = false): ValeursReservation {
  const reste = { ...valeurs }
  delete reste.jeton
  if (sansCreneau) delete reste.creneau
  return reste
}

// Comme le formulaire de contact : la première adresse transmise par l'hébergeur. Jamais écrite :
// seule son empreinte salée du jour sert de clé de limitation.
async function adresseIp(): Promise<string> {
  const entetes = await headers()
  return (
    entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    entetes.get('x-real-ip')?.trim() ||
    'inconnue'
  )
}

export async function reserverAppel(
  _precedent: EtatReservation,
  donnees: FormData,
): Promise<EtatReservation> {
  const valeurs = lireValeursReservation(donnees)
  const locale = valeurs.locale === 'en' ? 'en' : 'fr'
  const jeton = valeurs.jeton ?? ''
  if (!isTokenFormat(jeton)) {
    journaliser('rejected:link')
    redirect(localizedPath('/contact', locale))
  }

  const clePublique = vaultPublicKeyFromEnv(process.env)
  const secret = secretFormulaire()
  if (!clePublique || !secret) {
    journaliser('failed:config')
    return retenirEtat({ statut: 'echec', valeurs: saisie(valeurs) })
  }

  const resultat = validerReservation(valeurs)
  if (!resultat.succes) {
    journaliser('rejected:invalid')
    return retenirEtat({ statut: 'erreurs', erreurs: resultat.erreurs, valeurs: saisie(valeurs) })
  }
  const { debut, nom, telephone, langue, sms, origine } = resultat.reservation

  const maintenant = new Date()
  const debit = await limiterDebit([
    {
      cle: `reservation-ip:${empreinte(reseauIp(await adresseIp()), secret, maintenant)}`,
      ...LIMITE_IP,
    },
  ])
  switch (debit.statut) {
    case 'refuse':
      journaliser('rejected:rate')
      return retenirEtat({ statut: 'limite', valeurs: saisie(valeurs) })
    case 'reponse':
      journaliser('failed:rate')
      return retenirEtat({ statut: 'echec', valeurs: saisie(valeurs) })
    case 'reseau':
      journaliser('rate:unavailable')
      break
    case 'config':
      journaliser('failed:config')
      break
    case 'inactif':
    case 'autorise':
      break
  }

  // Le lien d'abord, en lecture seule : un lien sans valeur ne coûte ni scellement ni transaction.
  let lien: LinkCheck
  try {
    lien = await checkBookingLink(getPool(), jeton, maintenant)
  } catch {
    journaliser('failed:vault')
    return retenirEtat({ statut: 'echec', valeurs: saisie(valeurs) })
  }
  if (lien === 'invalid') {
    journaliser('rejected:link')
    redirect(bookingPath(locale, jeton))
  }
  // Lien de gestion de l'appel, déduit du lien d'accès : jamais conservé, jamais journalisé.
  const gestion = deriveManageToken(jeton, secret)
  if (lien === 'booked') {
    journaliser('already-booked')
    redirect(managePath(locale, gestion))
  }

  let issue: BookingResult
  try {
    const sealed = await sealBooking(
      { nom, telephone, langue, sms: smsPropose() && sms, origine },
      clePublique,
    )
    issue = await bookSlot(getPool(), {
      token: jeton,
      manageToken: gestion,
      start: debut,
      sealed,
      privacyVersion: PRIVACY_POLICY_VERSION,
      now: maintenant,
    })
  } catch (error) {
    journaliser(error instanceof VaultKeyError ? 'failed:config' : 'failed:vault')
    return retenirEtat({ statut: 'echec', valeurs: saisie(valeurs) })
  }

  // Hors du try : `redirect` lève une exception de contrôle (doc Next.js).
  switch (issue.status) {
    case 'taken':
      journaliser('taken')
      return retenirEtat({
        statut: 'pris',
        valeurs: saisie(valeurs, true),
        creneaux: presenterCreneaux(issue.slots, locale),
        creneauPris: debut.toISOString(),
      })
    case 'invalid-link':
      journaliser('rejected:link')
      redirect(bookingPath(locale, jeton))
    case 'already-booked':
      journaliser('already-booked')
      break
    case 'booked':
      journaliser('booked')
      break
  }
  redirect(managePath(locale, gestion))
}
