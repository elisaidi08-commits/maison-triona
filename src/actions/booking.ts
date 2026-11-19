'use server'

import { redirect } from 'next/navigation'

import { bookingConfirmationPath, bookingPath, localizedPath } from '@/i18n/pathnames'
import { retenirEtat } from '@/lib/booking/action-state'
import { bookSlot, type BookingResult } from '@/lib/booking/bookings'
import { presenterCreneaux } from '@/lib/booking/display'
import type { EtatReservation, ValeursReservation } from '@/lib/booking/form'
import { isTokenFormat } from '@/lib/booking/tokens'
import { getPool } from '@/lib/db/pool'
import { PRIVACY_POLICY_VERSION } from '@/lib/privacy'
import { lireValeursReservation, validerReservation } from '@/lib/validation/booking'
import { vaultPublicKeyFromEnv } from '@/lib/vault/config'
import { sealBooking, VaultKeyError } from '@/lib/vault/seal'

// Réservation d'un appel (story 3.10 ; docs/reservation-appel.md §2, §4.2, §5). Point d'entrée POST
// public : tout est revérifié ici, dans cet ordre :
// 1. forme du jeton (champ caché) : une forme inattendue ne vient que d'un envoi trafiqué, retour
//    au formulaire de contact, rien n'atteint la base ;
// 2. coffre configuré (base et clé publique), sinon « L'envoi n'a pas abouti », saisie conservée ;
// 3. validation Zod de la saisie ;
// 4. la personne est scellée (clé publique du coffre), puis `bookSlot` réserve dans une transaction
//    (lien verrouillé, verrou du jour, créneaux recalculés, contrainte d'exclusion) :
//    - réservé, ou déjà réservé par ce même lien (double clic, renvoi) : la confirmation (303) ;
//    - créneau qui n'est plus ouvert : « Ce créneau vient d'être pris », les créneaux encore libres,
//      les plus proches en tête, la saisie conservée ;
//    - lien qui ne vaut plus (expiré, annulé, inconnu) : sa page, qui le dit sobrement ;
//    - coffre injoignable : « L'envoi n'a pas abouti », saisie conservée, rien d'enregistré.
// Le jeton suffit comme clé (32 octets) : ni piège à robots, ni horodatage, ni limitation de débit
// ici ; ils protègent la demande de lien (story 3.9). Aucun e-mail : la notification sans nom à Cat
// et la confirmation à la personne viendront avec la boîte d'envoi (story 3.3), écrites dans la même
// transaction que la réservation.
// Sans JavaScript, l'état rendu est aussi déposé pour le rendu de la page qui suit (retenirEtat,
// src/lib/booking/action-state.ts) : Cache Components reprend la coquille de la page sans l'état du
// formulaire.
// Journaux : un statut seulement, jamais le jeton, une valeur saisie ni une erreur brute.

type Statut =
  | 'rejected:link'
  | 'rejected:invalid'
  | 'taken'
  | 'booked'
  | 'already-booked'
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
  if (!clePublique) {
    journaliser('failed:config')
    return retenirEtat({ statut: 'echec', valeurs: saisie(valeurs) })
  }

  const resultat = validerReservation(valeurs)
  if (!resultat.succes) {
    journaliser('rejected:invalid')
    return retenirEtat({ statut: 'erreurs', erreurs: resultat.erreurs, valeurs: saisie(valeurs) })
  }
  const { debut, nom, telephone, langue, sms, origine } = resultat.reservation

  let issue: BookingResult
  try {
    const sealed = await sealBooking({ nom, telephone, langue, sms, origine }, clePublique)
    issue = await bookSlot(getPool(), {
      token: jeton,
      start: debut,
      sealed,
      privacyVersion: PRIVACY_POLICY_VERSION,
      now: new Date(),
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
  redirect(bookingConfirmationPath(locale, jeton))
}
