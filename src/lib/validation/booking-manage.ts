/**
 * Validation du lien de gestion (story 3.11 ; docs/reservation-appel.md §2, étape 6) : déplacer
 * (jeton, langue, créneau) et annuler (jeton, langue). Le jeton n'a qu'une forme à respecter : seule
 * la base dit s'il vaut encore. Le créneau n'est qu'une date bien formée : la transaction du
 * déplacement revérifie qu'il est encore libre (computeSlots, sous verrou). Une erreur ne rend qu'un
 * code, jamais la valeur reçue.
 * Imports relatifs seulement : testé par node --test.
 */
import { z } from 'zod'

import { isTokenFormat } from '../booking/tokens.ts'

// Sans compilation à la volée (CSP sans 'unsafe-eval') : voir src/lib/validation/demande.ts.
z.config({ jitless: true })

export type LangueGestion = 'fr' | 'en'

function champ(donnees: FormData, nom: string): string | undefined {
  const valeur = donnees.get(nom)
  if (typeof valeur !== 'string') return undefined
  const propre = valeur.trim()
  return propre === '' ? undefined : propre
}

const creneau = z.iso.datetime()

export interface EnvoiGestion {
  /** Absent si la forme n'est pas celle d'un jeton : envoi trafiqué, rien n'atteint la base. */
  jeton: string | null
  locale: LangueGestion
}

/** Jeton et langue de tout envoi du lien de gestion. Une langue inconnue retombe sur le français. */
export function lireEnvoiGestion(donnees: FormData): EnvoiGestion {
  const jeton = champ(donnees, 'jeton')
  return {
    jeton: isTokenFormat(jeton) ? jeton : null,
    locale: champ(donnees, 'locale') === 'en' ? 'en' : 'fr',
  }
}

export type ResultatDeplacement =
  { ok: true; debut: Date; creneau: string } | { ok: false; erreur: 'creneau'; creneau?: string }

/** Le nouveau créneau : un instant ISO 8601 en UTC, tel que la page l'écrit dans la valeur du choix. */
export function validerDeplacement(donnees: FormData): ResultatDeplacement {
  const brut = champ(donnees, 'creneau')
  const lu = creneau.safeParse(brut)
  if (!lu.success) return { ok: false, erreur: 'creneau' }
  const debut = new Date(lu.data)
  if (Number.isNaN(debut.getTime())) return { ok: false, erreur: 'creneau' }
  return { ok: true, debut, creneau: lu.data }
}
