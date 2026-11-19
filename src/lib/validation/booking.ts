/**
 * Schéma Zod de la réservation d'appel (story 3.10 ; docs/reservation-appel.md §2). La Server Action
 * valide tout l'envoi ; les messages sont des codes (lib/booking/form.ts), traduits par
 * messages/*.json. Le jeton n'est pas validé ici : sa forme est vérifiée à part, et seule la base dit
 * s'il vaut encore (src/lib/booking/bookings.ts). Le créneau n'est qu'une date bien formée : la
 * transaction de réservation revérifie qu'il est encore libre (computeSlots, sous verrou).
 * Imports relatifs seulement : testé par node --test.
 */
import { z } from 'zod'

import { LANGUES, LIMITES, ORIGINES } from '../demande/champs.ts'
import {
  CHAMPS_RESERVATION,
  CODES_ERREUR_RESERVATION,
  estChampReservation,
  type CodeErreurReservation,
  type ErreursReservation,
  type ValeursReservation,
} from '../booking/form.ts'
import { telephoneValide } from './demande.ts'

// Sans compilation à la volée (CSP sans 'unsafe-eval') : voir src/lib/validation/demande.ts.
z.config({ jitless: true })

export const reservationSchema = z
  .object({
    // Instant ISO 8601 en UTC (`toISOString()`), tel que la page l'écrit dans la valeur du choix.
    creneau: z.iso.datetime({ error: 'creneau' }),
    nom: z
      .string({ error: 'nomRequis' })
      .min(LIMITES.nomMin, { error: 'nomCourt' })
      .max(LIMITES.nomMax, { error: 'nomLong' }),
    telephone: z
      .string({ error: 'telephoneRequis' })
      .max(LIMITES.telephoneMax, { error: 'telephoneFormat' })
      .refine(telephoneValide, { error: 'telephoneFormat' }),
    langue: z.enum(LANGUES, { error: 'langue' }),
    // Préférence seulement : une valeur trafiquée ne vaut pas un choix.
    sms: z.literal('oui').optional().catch(undefined),
    origine: z.enum(ORIGINES, { error: 'origine' }).optional(),
    consentement: z.literal('oui', { error: 'consentement' }),
    // Langue de l'interface (champ caché) : une valeur inconnue retombe sur le français.
    locale: z.enum(LANGUES).catch('fr'),
  })
  .transform((valeurs) => ({
    debut: new Date(valeurs.creneau),
    nom: valeurs.nom,
    telephone: valeurs.telephone,
    langue: valeurs.langue,
    sms: valeurs.sms === 'oui',
    origine: valeurs.origine ?? null,
    locale: valeurs.locale,
  }))

export type Reservation = z.output<typeof reservationSchema>

const LUS = [...CHAMPS_RESERVATION, 'jeton', 'locale'] as const

/** Lit les champs connus d'un envoi : chaînes nettoyées, champ vide absent. */
export function lireValeursReservation(donnees: FormData): ValeursReservation {
  const valeurs: ValeursReservation = {}
  for (const champ of LUS) {
    const brut = donnees.get(champ)
    if (typeof brut !== 'string') continue
    const valeur = brut.trim()
    if (valeur) valeurs[champ] = valeur
  }
  return valeurs
}

function estCode(message: string): message is CodeErreurReservation {
  return (CODES_ERREUR_RESERVATION as readonly string[]).includes(message)
}

// Code de repli d'un champ, pour une erreur sans message choisi (valeur inattendue). La case SMS ne
// lève jamais d'erreur (`catch`) : elle n'a pas de code.
const REPLI: Partial<Record<(typeof CHAMPS_RESERVATION)[number], CodeErreurReservation>> = {
  creneau: 'creneau',
  nom: 'nomRequis',
  telephone: 'telephoneFormat',
  langue: 'langue',
  origine: 'origine',
  consentement: 'consentement',
}

export type ResultatReservation =
  { succes: true; reservation: Reservation } | { succes: false; erreurs: ErreursReservation }

export function validerReservation(valeurs: ValeursReservation): ResultatReservation {
  const resultat = reservationSchema.safeParse(valeurs)
  if (resultat.success) return { succes: true, reservation: resultat.data }
  const erreurs: ErreursReservation = {}
  for (const issue of resultat.error.issues) {
    const champ = issue.path[0]
    if (typeof champ !== 'string' || !estChampReservation(champ) || erreurs[champ]) continue
    const code = estCode(issue.message) ? issue.message : REPLI[champ]
    if (code) erreurs[champ] = code
  }
  return { succes: false, erreurs }
}
