/**
 * Schéma Zod de la demande de lien (story 3.9 ; docs/reservation-appel.md §2) : l'adresse e-mail
 * seule, même règle que le formulaire de contact (format, 254 caractères au plus). Les messages sont
 * des codes (lib/booking/link-form.ts), traduits par messages/*.json.
 * Imports relatifs seulement : testé par node --test.
 */
import { z } from 'zod'

import type { CodeErreurLien, ValeursLien } from '../booking/link-form.ts'
import { CHAMP_PIEGE, LANGUES, LIMITES } from '../demande/champs.ts'

// Sans compilation à la volée (CSP sans 'unsafe-eval') : voir src/lib/validation/demande.ts.
z.config({ jitless: true })

const demandeSchema = z.object({
  email: z
    .email({ error: 'emailFormat' })
    .max(LIMITES.emailMax, { error: 'emailFormat' })
    .optional(),
  // Langue de l'interface (champ caché) : une valeur inconnue retombe sur le français.
  locale: z.enum(LANGUES).catch('fr'),
})

export type DemandeLien = { email: string; locale: 'fr' | 'en' }

const LUS = ['email', 'locale', 'jeton'] as const

// Une valeur démesurée n'est pas une adresse : elle n'est ni gardée ni renvoyée telle quelle.
const LONGUEUR_LUE_MAX = 1000

/** Lit les champs connus d'un envoi : chaînes nettoyées, champ vide absent. */
export function lireValeursLien(donnees: FormData): ValeursLien {
  const valeurs: ValeursLien = {}
  for (const champ of LUS) {
    const brut = donnees.get(champ)
    if (typeof brut !== 'string') continue
    const valeur = brut.trim().slice(0, LONGUEUR_LUE_MAX)
    if (valeur) valeurs[champ] = valeur
  }
  return valeurs
}

/** Le piège à robots (champ caché) est-il rempli ? */
export function piegeRempli(donnees: FormData): boolean {
  const valeur = donnees.get(CHAMP_PIEGE)
  return typeof valeur === 'string' && valeur.trim() !== ''
}

export function validerDemandeLien(
  valeurs: ValeursLien,
): { succes: true; demande: DemandeLien } | { succes: false; erreur: CodeErreurLien } {
  if (!valeurs.email) return { succes: false, erreur: 'emailRequis' }
  const resultat = demandeSchema.safeParse({ email: valeurs.email, locale: valeurs.locale })
  if (!resultat.success || !resultat.data.email) return { succes: false, erreur: 'emailFormat' }
  return { succes: true, demande: { email: resultat.data.email, locale: resultat.data.locale } }
}
