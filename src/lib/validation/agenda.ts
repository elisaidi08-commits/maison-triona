/**
 * Validation des actions de /coffre/appels (story 3.13). Tout arrive du navigateur et tout est
 * revérifié ici : identifiant d'appel, statut choisi (« fait » ou « pas de réponse » seulement),
 * demande à rattacher (identifiant, ou « aucune »), identifiants des appels à déchiffrer. Une erreur
 * ne rend qu'un code, jamais la valeur reçue. La base a le dernier mot (déclencheur des statuts, clé
 * étrangère du rattachement, db/migrations/0011_agenda.sql).
 * Imports relatifs seulement : testé par node --test.
 */
import { z } from 'zod'

import { QUALIFICATIONS, type Qualification } from '../booking/agenda.ts'

// Sans compilation à la volée (`new Function`), que la CSP du coffre refuse : voir demande.ts.
z.config({ jitless: true })

export type CodeErreurAgenda = 'identifiant' | 'statut' | 'demande'

export type ResultatAgenda<T> = { ok: true; valeur: T } | { ok: false; erreur: CodeErreurAgenda }

/** Appels déchiffrés en une fois : ceux d'une semaine et ceux qui restent à qualifier. */
export const LECTURE_MAX = 100

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const identifiant = z
  .string()
  .regex(UUID)
  .transform((valeur) => valeur.toLowerCase())

function champ(donnees: FormData, nom: string): unknown {
  const valeur = donnees.get(nom)
  return typeof valeur === 'string' ? valeur.trim() : valeur
}

function appel(donnees: FormData): string | null {
  const lu = identifiant.safeParse(champ(donnees, 'id'))
  return lu.success ? lu.data : null
}

/** « Fait » ou « pas de réponse » sur un appel (formulaire : `id`, `statut`). */
export function validerQualification(
  donnees: FormData,
): ResultatAgenda<{ id: string; statut: Qualification }> {
  const id = appel(donnees)
  if (!id) return { ok: false, erreur: 'identifiant' }
  const statut = z.enum(QUALIFICATIONS).safeParse(champ(donnees, 'statut'))
  if (!statut.success) return { ok: false, erreur: 'statut' }
  return { ok: true, valeur: { id, statut: statut.data } }
}

/** Valeur de la liste qui retire le rattachement. */
export const AUCUNE_DEMANDE = 'aucune'

/** Rattachement d'un appel à une demande, ou retrait (formulaire : `id`, `demande`). */
export function validerRattachement(
  donnees: FormData,
): ResultatAgenda<{ id: string; demande: string | null }> {
  const id = appel(donnees)
  if (!id) return { ok: false, erreur: 'identifiant' }
  const brute = champ(donnees, 'demande')
  if (brute === AUCUNE_DEMANDE) return { ok: true, valeur: { id, demande: null } }
  const demande = identifiant.safeParse(brute)
  if (!demande.success) return { ok: false, erreur: 'demande' }
  return { ok: true, valeur: { id, demande: demande.data } }
}

/**
 * Identifiants des appels dont le navigateur demande les octets scellés : un tableau de 1 à 100
 * identifiants, sans doublon. Autre chose : null, rien n'est lu.
 */
export function validerIdentifiantsAppels(valeur: unknown): string[] | null {
  const lu = z.array(identifiant).min(1).max(LECTURE_MAX).safeParse(valeur)
  if (!lu.success) return null
  return [...new Set(lu.data)]
}
