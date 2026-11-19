/**
 * Ordre des créneaux de la page de réservation (story 3.10 ; docs/reservation-appel.md §2, étape 3) :
 * en tête, les trois prochains créneaux libres (ou, si le créneau choisi vient d'être pris, les trois
 * plus proches de lui) ; puis les autres, groupés par semaine et par jour, en liste (pas de grille de
 * calendrier). Fonctions pures sur des créneaux déjà libellés (./display.ts) : lues par le serveur et
 * par le formulaire dans le navigateur.
 * Imports relatifs seulement : testé par node --test.
 */
import type { CreneauAffiche } from './form.ts'

export const NOMBRE_EN_TETE = 3

/**
 * Les créneaux de tête : les `nombre` prochains ; ou, après un créneau pris (`autour`, instant ISO),
 * les `nombre` plus proches de lui, remis dans l'ordre du temps.
 */
export function teteDeListe(
  creneaux: CreneauAffiche[],
  autour?: string,
  nombre = NOMBRE_EN_TETE,
): CreneauAffiche[] {
  const cible = autour ? Date.parse(autour) : Number.NaN
  if (Number.isNaN(cible)) return creneaux.slice(0, nombre)
  return creneaux
    .map((creneau, index) => ({
      creneau,
      index,
      ecart: Math.abs(Date.parse(creneau.debut) - cible),
    }))
    .sort((a, b) => a.ecart - b.ecart || a.index - b.index)
    .slice(0, nombre)
    .sort((a, b) => a.index - b.index)
    .map(({ creneau }) => creneau)
}

export interface JourAffiche {
  jour: string
  libelle: string
  creneaux: CreneauAffiche[]
}

export interface SemaineAffichee {
  semaine: string
  /** Date du lundi (« 1er mars »), à placer dans « Semaine du {date} ». */
  libelle: string
  jours: JourAffiche[]
}

/** Les créneaux hors de la tête, groupés par semaine puis par jour, dans l'ordre du temps. */
export function grouperParSemaine(
  creneaux: CreneauAffiche[],
  tete: CreneauAffiche[] = [],
): SemaineAffichee[] {
  const exclus = new Set(tete.map((creneau) => creneau.debut))
  const semaines: SemaineAffichee[] = []
  for (const creneau of creneaux) {
    if (exclus.has(creneau.debut)) continue
    let semaine = semaines.at(-1)
    if (semaine?.semaine !== creneau.semaine) {
      semaine = { semaine: creneau.semaine, libelle: creneau.libelleSemaine, jours: [] }
      semaines.push(semaine)
    }
    let jour = semaine.jours.at(-1)
    if (jour?.jour !== creneau.jour) {
      jour = { jour: creneau.jour, libelle: creneau.libelleJour, creneaux: [] }
      semaine.jours.push(jour)
    }
    jour.creneaux.push(creneau)
  }
  return semaines
}
