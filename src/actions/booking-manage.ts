'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { localizedPath, manageCancelPath, managePath } from '@/i18n/pathnames'
import { retenirEtat } from '@/lib/booking/action-state'
import { cancelBookingByToken, moveBookingByToken, type CancelResult } from '@/lib/booking/bookings'
import { presenterCreneaux } from '@/lib/booking/display'
import type { EtatDeplacement } from '@/lib/booking/manage-form'
import { getPool } from '@/lib/db/pool'
import { limiterDebit } from '@/lib/rate-limit'
import { empreinte, reseauIp } from '@/lib/security/empreinte'
import { secretFormulaire } from '@/lib/security/secret'
import { lireEnvoiGestion, validerDeplacement } from '@/lib/validation/booking-manage'

// Lien de gestion d'un appel (story 3.11 ; docs/reservation-appel.md §2, étape 6, §4.4, §5) : déplacer
// et annuler. Points d'entrée POST publics : tout est revérifié ici, dans cet ordre :
// 1. forme du jeton (champ caché) : une forme inattendue ne vient que d'un envoi trafiqué, retour
//    au formulaire de contact, rien n'atteint la base ;
// 2. secret du formulaire (clé de la limitation de débit), sinon « L'envoi n'a pas abouti » ;
// 3. (déplacer) validation Zod du créneau ;
// 4. limitation de débit par empreinte d'IP (préfixe /64 en IPv6, sel du jour), comme la réservation :
//    10 envois par 10 minutes ; refusé : « Trop d'envois » ; Upstash en panne : on passe ;
// 5. la base, dans une transaction (src/lib/booking/bookings.ts) : lien de gestion valable, appel
//    verrouillé, confirmé et pas encore commencé ; créneaux recalculés sans lui, verrou du jour,
//    contrainte d'exclusion. L'ancien créneau n'est libéré qu'au moment où le nouveau est pris.
// Issues : déplacé, la page de gestion avec « Votre appel est déplacé » (`?deplace=1`, rien de
// personnel dans l'adresse) ; même créneau, lien qui ne vaut plus, appel commencé ou annulé : la page
// de gestion, qui dit où en est l'appel ; créneau pris : « Ce créneau vient d'être pris », les
// créneaux encore libres, les plus proches en tête ; base injoignable : « L'envoi n'a pas abouti »,
// rien n'a changé. Annulé : la page de gestion, qui le dit.
// Aucun message ne part : l'e-mail et le SMS de déplacement ou d'annulation (et l'invitation mise à
// jour envoyée à Cat) attendent la boîte d'envoi et le Key Manager (stories 3.3, 3.12). Points
// d'accroche : dans la transaction des deux seules fonctions de dépôt, `moveBooking` et
// `cancelBooking` (src/lib/booking/bookings.ts), communes à la personne et au coffre.
// Sans JavaScript, l'état rendu est aussi déposé pour le rendu de la page qui suit (retenirEtat).
// Journaux : un statut seulement, jamais le jeton, un créneau, une adresse ni une erreur brute.
// `redirect()` lève une exception de contrôle : toujours hors des try.

const LIMITE_IP = { maximum: 10, fenetreSecondes: 10 * 60 }

type Statut =
  | 'rejected:link'
  | 'rejected:invalid'
  | 'rejected:rate'
  | 'rate:unavailable'
  | 'failed:rate'
  | 'failed:config'
  | 'failed:vault'
  | 'moved'
  | 'unchanged'
  | 'not-movable'
  | 'taken'
  | 'cancelled'
  | 'already-cancelled'
  | 'not-cancellable'

function journaliser(statut: Statut) {
  console.info(`[gestion] ${statut}`)
}

async function adresseIp(): Promise<string> {
  const entetes = await headers()
  return (
    entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    entetes.get('x-real-ip')?.trim() ||
    'inconnue'
  )
}

// Limitation de débit commune aux deux gestes : `true` si l'envoi peut passer.
async function debitAutorise(secret: string, maintenant: Date): Promise<'ok' | 'limite' | 'echec'> {
  const debit = await limiterDebit([
    {
      cle: `gestion-ip:${empreinte(reseauIp(await adresseIp()), secret, maintenant)}`,
      ...LIMITE_IP,
    },
  ])
  switch (debit.statut) {
    case 'refuse':
      journaliser('rejected:rate')
      return 'limite'
    case 'reponse':
      journaliser('failed:rate')
      return 'echec'
    case 'reseau':
      journaliser('rate:unavailable')
      return 'ok'
    case 'config':
      journaliser('failed:config')
      return 'ok'
    case 'inactif':
    case 'autorise':
      return 'ok'
  }
}

export async function deplacerAppel(
  _precedent: EtatDeplacement,
  donnees: FormData,
): Promise<EtatDeplacement> {
  const { jeton, locale } = lireEnvoiGestion(donnees)
  if (!jeton) {
    journaliser('rejected:link')
    redirect(localizedPath('/contact', locale))
  }
  const secret = secretFormulaire()
  if (!secret) {
    journaliser('failed:config')
    return retenirEtat<EtatDeplacement>({ statut: 'echec' })
  }

  const choix = validerDeplacement(donnees)
  if (!choix.ok) {
    journaliser('rejected:invalid')
    return retenirEtat<EtatDeplacement>({ statut: 'erreurs' })
  }

  const maintenant = new Date()
  const debit = await debitAutorise(secret, maintenant)
  if (debit !== 'ok') {
    return retenirEtat<EtatDeplacement>({
      statut: debit === 'limite' ? 'limite' : 'echec',
      creneau: choix.creneau,
    })
  }

  let issue: Awaited<ReturnType<typeof moveBookingByToken>>
  try {
    issue = await moveBookingByToken(getPool(), {
      token: jeton,
      start: choix.debut,
      now: maintenant,
    })
  } catch {
    journaliser('failed:vault')
    return retenirEtat<EtatDeplacement>({ statut: 'echec', creneau: choix.creneau })
  }

  switch (issue.status) {
    case 'taken':
      journaliser('taken')
      return retenirEtat<EtatDeplacement>({
        statut: 'pris',
        creneaux: presenterCreneaux(issue.slots, locale),
        creneauPris: choix.debut.toISOString(),
      })
    case 'moved':
      journaliser('moved')
      redirect(`${managePath(locale, jeton)}?deplace=1`)
    case 'unchanged':
      journaliser('unchanged')
      break
    case 'not-movable':
    case 'not-found':
      journaliser('not-movable')
      break
    case 'invalid-link':
      journaliser('rejected:link')
      break
  }
  redirect(managePath(locale, jeton))
}

export async function annulerAppel(donnees: FormData): Promise<void> {
  const { jeton, locale } = lireEnvoiGestion(donnees)
  if (!jeton) {
    journaliser('rejected:link')
    redirect(localizedPath('/contact', locale))
  }
  const secret = secretFormulaire()
  if (!secret) {
    journaliser('failed:config')
    redirect(`${manageCancelPath(locale, jeton)}?echec=1`)
  }
  const maintenant = new Date()
  const debit = await debitAutorise(secret, maintenant)
  if (debit !== 'ok') redirect(`${manageCancelPath(locale, jeton)}?${debit}=1`)

  let issue: CancelResult | 'invalid-link'
  try {
    issue = await cancelBookingByToken(getPool(), { token: jeton, now: maintenant })
  } catch {
    journaliser('failed:vault')
    redirect(`${manageCancelPath(locale, jeton)}?echec=1`)
  }
  switch (issue) {
    case 'cancelled':
    case 'already-cancelled':
    case 'not-cancellable':
      journaliser(issue)
      break
    case 'not-found':
      journaliser('not-cancellable')
      break
    case 'invalid-link':
      journaliser('rejected:link')
      break
  }
  redirect(managePath(locale, jeton))
}
