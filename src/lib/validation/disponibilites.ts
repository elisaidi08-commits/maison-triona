/**
 * Validation des formulaires de /coffre/disponibilites (story 3.8, partie B). Tout arrive du
 * navigateur (FormData) et tout est revérifié ici, même ce que les champs natifs bornent déjà
 * (min, max, step) ; la base double les bornes (db/migrations/0007_disponibilites.sql). Une erreur
 * ne rend qu'un code, jamais la valeur reçue ; la page le traduit en message.
 * Imports relatifs seulement : testé par node --test.
 */
import { z } from 'zod'

import {
  SETTINGS_LIMITS,
  type AvailabilityRule,
  type EditableBookingSettings,
  type SettingLimit,
} from '../booking/settings.ts'
import { addDays, type IsoWeekday } from '../booking/zoned-time.ts'

// Sans compilation à la volée (`new Function`), que la CSP du coffre refuse : voir demande.ts.
z.config({ jitless: true })

export type CodeErreurDisponibilites =
  | 'duree'
  | 'pause'
  | 'delai'
  | 'horizon'
  | 'plafond'
  | 'jour-semaine'
  | 'debut'
  | 'fin'
  | 'plage-ordre'
  | 'du'
  | 'au'
  | 'absence-ordre'
  | 'absence-longue'
  | 'date'
  | 'feries'
  | 'identifiant'
  | 'annee'

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreur: CodeErreurDisponibilites }

/** Délai minimal saisi en heures, enregistré en minutes. */
export const MINUTES_PAR_HEURE = 60
/** Une absence dure au plus 366 jours, bornes comprises (année bissextile). */
export const ABSENCE_MAX_JOURS = 366
/** Jours fériés envoyés par un formulaire : deux années au plus. */
const FERIES_MAX = 40
const ANNEE_MIN = 2026
const ANNEE_MAX = 2100

const ENTIER = /^\d{1,5}$/
const HEURE = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function echec<T>(erreur: CodeErreurDisponibilites): Resultat<T> {
  return { ok: false, erreur }
}

// Entier saisi dans l'unité du formulaire (`unite` minutes), rendu dans l'unité des réglages.
function entier(limite: SettingLimit, unite = 1) {
  return z
    .string()
    .trim()
    .regex(ENTIER)
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(limite.min / unite)
        .max(limite.max / unite)
        .multipleOf(limite.step / unite),
    )
    .transform((valeur) => valeur * unite)
}

const REGLAGES = z.object({
  duree: entier(SETTINGS_LIMITS.durationMinutes),
  pause: entier(SETTINGS_LIMITS.bufferMinutes),
  delai: entier(SETTINGS_LIMITS.minNoticeMinutes, MINUTES_PAR_HEURE),
  horizon: entier(SETTINGS_LIMITS.horizonDays),
  plafond: entier(SETTINGS_LIMITS.dailyCap),
})

type ChampReglage = keyof z.infer<typeof REGLAGES>
const CHAMPS_REGLAGES: ChampReglage[] = ['duree', 'pause', 'delai', 'horizon', 'plafond']

// Premier champ fautif, dans l'ordre du formulaire.
function premierChamp<T extends string>(erreur: z.ZodError, champs: readonly T[]): T | undefined {
  const fautifs = new Set(erreur.issues.map((issue) => issue.path[0]))
  return champs.find((champ) => fautifs.has(champ))
}

function lire(donnees: FormData, champs: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(champs.map((champ) => [champ, donnees.get(champ)]))
}

export function validerReglages(donnees: FormData): Resultat<EditableBookingSettings> {
  const lu = REGLAGES.safeParse(lire(donnees, CHAMPS_REGLAGES))
  if (!lu.success) return echec(premierChamp(lu.error, CHAMPS_REGLAGES) ?? 'duree')
  return {
    ok: true,
    valeur: {
      durationMinutes: lu.data.duree,
      bufferMinutes: lu.data.pause,
      minNoticeMinutes: lu.data.delai,
      horizonDays: lu.data.horizon,
      dailyCap: lu.data.plafond,
    },
  }
}

// « 09:00 » ou « 09:00:00 » (certains navigateurs ajoutent les secondes) → « 09:00 ».
const heure = z
  .string()
  .regex(HEURE)
  .transform((valeur) => valeur.slice(0, 5))

const PLAGE = z.object({
  jour: z.enum(['1', '2', '3', '4', '5', '6', '7']),
  debut: heure,
  fin: heure,
})

const CHAMPS_PLAGE = ['jour', 'debut', 'fin'] as const
const ERREURS_PLAGE: Record<(typeof CHAMPS_PLAGE)[number], CodeErreurDisponibilites> = {
  jour: 'jour-semaine',
  debut: 'debut',
  fin: 'fin',
}

export function validerPlage(donnees: FormData): Resultat<AvailabilityRule> {
  const lu = PLAGE.safeParse(lire(donnees, CHAMPS_PLAGE))
  if (!lu.success) return echec(ERREURS_PLAGE[premierChamp(lu.error, CHAMPS_PLAGE) ?? 'jour'])
  // Heures sur 24 h, toutes deux « HH:MM » : l'ordre du texte est celui du temps.
  if (lu.data.fin <= lu.data.debut) return echec('plage-ordre')
  return {
    ok: true,
    valeur: { weekday: Number(lu.data.jour) as IsoWeekday, start: lu.data.debut, end: lu.data.fin },
  }
}

/** Date locale « YYYY-MM-DD » qui existe au calendrier. */
export function estDateLocale(valeur: unknown): valeur is string {
  if (typeof valeur !== 'string') return false
  try {
    return addDays(valeur, 0) === valeur
  } catch {
    return false
  }
}

function joursEntre(debut: string, fin: string): number {
  return (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000
}

/** Congé : du … au …, dates incluses ; une absence déjà passée n'a pas de sens. */
export function validerAbsence(
  donnees: FormData,
  aujourdhui: string,
): Resultat<{ startDate: string; endDate: string }> {
  const du = donnees.get('du')
  const au = donnees.get('au')
  if (!estDateLocale(du)) return echec('du')
  if (!estDateLocale(au) || au < aujourdhui) return echec('au')
  if (au < du) return echec('absence-ordre')
  if (joursEntre(du, au) >= ABSENCE_MAX_JOURS) return echec('absence-longue')
  return { ok: true, valeur: { startDate: du, endDate: au } }
}

/** Journée à bloquer : aujourd'hui ou plus tard. */
export function validerJournee(donnees: FormData, aujourdhui: string): Resultat<string> {
  const date = donnees.get('date')
  if (!estDateLocale(date) || date < aujourdhui) return echec('date')
  return { ok: true, valeur: date }
}

export function validerIdentifiant(donnees: FormData): Resultat<string> {
  const id = donnees.get('id')
  if (typeof id !== 'string' || !UUID.test(id)) return echec('identifiant')
  return { ok: true, valeur: id }
}

export function validerAnnee(donnees: FormData): Resultat<number> {
  const annee = donnees.get('annee')
  if (typeof annee !== 'string' || !/^\d{4}$/.test(annee)) return echec('annee')
  const valeur = Number(annee)
  if (valeur < ANNEE_MIN || valeur > ANNEE_MAX) return echec('annee')
  return { ok: true, valeur }
}

/**
 * Jours fériés : `affiches` liste ceux que montrait le formulaire, `fermes` ceux qui restent cochés
 * (fermés aux appels). Un jour affiché et non coché est décoché ; un jour coché doit être affiché.
 */
export function validerJoursFeries(
  donnees: FormData,
): Resultat<{ affiches: string[]; fermes: string[] }> {
  const affiches = donnees.getAll('affiches')
  const fermes = donnees.getAll('fermes')
  if (affiches.length === 0 || affiches.length > FERIES_MAX) return echec('feries')
  if (!affiches.every(estDateLocale) || !fermes.every(estDateLocale)) return echec('feries')
  const uniques = new Set(affiches)
  if (uniques.size !== affiches.length) return echec('feries')
  if (!fermes.every((date) => uniques.has(date))) return echec('feries')
  return { ok: true, valeur: { affiches, fermes: [...new Set(fermes)] } }
}
